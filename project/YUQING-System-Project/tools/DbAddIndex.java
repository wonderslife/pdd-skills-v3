import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import java.util.regex.*;

/**
 * 纯增量补索引：只 ADD 缺失的 KEY，绝不 DROP、绝不改列。
 *
 * 为什么需要它：本项目「新增表走 DbAddTable（只 CREATE）」，
 * 但表一旦建成，后续在 yq_schema.sql 里给它补的索引就不会自动生效
 * —— DbAddTable 见到表已存在就跳过。于是「生成了索引 DDL」与
 * 「线上库真有这个索引」之间出现静默缺口，表现为审计/列表查询慢，
 * 且没有任何报错（校验器只看 SQL 文件，不看库）。
 *
 * 本工具把 yq_schema.sql 里某张表的 KEY 定义与线下库的
 * information_schema.statistics 比对，只补差集。
 *
 * 用法：
 *   java -cp "<driver>" tools\DbAddIndex.java --dry-run yq_ledger_export_log
 *   java -cp "<driver>" tools\DbAddIndex.java yq_ledger_export_log yq_opinion
 *   java -cp "<driver>" tools\DbAddIndex.java --from yq-code/sql/yq_schema.sql yq_xxx
 *
 * 安全约束：
 *   - 表名必须以 yq_ 开头（拒绝误伤他人表）；
 *   - 只识别单列/多列 KEY 行，不解析 PRIMARY KEY（主键建表时已有，不重复加）；
 *   - 索引名已存在即跳过；仅新增，永不删除或修改既有索引；
 *   - --dry-run 只打印将执行的 DDL，不连库；
 *   - 凭据优先从环境变量读取（YQ_DB_URL / YQ_DB_USER / YQ_DB_PASS），
 *     便于在 CI 或临时环境替换，不把生产口令写死在脚本里。
 */
public class DbAddIndex {

    static final String DEFAULT_URL = "jdbc:mysql://43.138.34.68:3306/ruoyi_zhai"
        + "?useUnicode=true&characterEncoding=utf8&zeroDateTimeBehavior=convertToNull"
        + "&useSSL=true&serverTimezone=GMT%2B8&autoReconnect=true"
        + "&rewriteBatchedStatements=true&allowPublicKeyRetrieval=true"
        + "&nullCatalogMeansCurrent=true";
    static final String DEFAULT_USER = "ruoyi_zhai";
    static final String DEFAULT_PASS = "BWnSwWmCSAyLtAr4";

    static String env(String k, String d) {
        String v = System.getenv(k);
        return v == null || v.isBlank() ? d : v;
    }

    public static void main(String[] args) throws Exception {
        List<String> tables = new ArrayList<>();
        String from = "yq-code/sql/yq_schema.sql";
        boolean dry = false;

        for (int i = 0; i < args.length; i++) {
            if ("--from".equals(args[i]) && i + 1 < args.length) {
                from = args[++i];
            } else if ("--dry-run".equals(args[i])) {
                dry = true;
            } else {
                tables.add(args[i]);
            }
        }
        if (tables.isEmpty()) {
            System.out.println("用法: DbAddIndex [--from <sql>] [--dry-run] <表名>...");
            return;
        }
        for (String t : tables) {
            if (!t.startsWith("yq_")) {
                System.out.println("拒绝：表名必须以 yq_ 开头 -> " + t);
                return;
            }
        }

        Path sqlPath = Paths.get(from);
        if (!Files.exists(sqlPath)) {
            System.out.println("✗ 源 SQL 不存在: " + sqlPath.toAbsolutePath());
            return;
        }
        String all = new String(Files.readAllBytes(sqlPath), StandardCharsets.UTF_8);

        System.out.println("=== 纯增量补索引（不 DROP / 不改列）===");
        System.out.println("  源脚本: " + sqlPath);
        System.out.println("  目标表: " + tables);
        System.out.println();

        /* ---- 本地先解析出期望索引，避免连库后才发现解析不出 ---- */
        Map<String, Map<String, String>> wanted = new LinkedHashMap<>();
        int total = 0;
        for (String t : tables) {
            String body = extractBody(all, t);
            if (body == null) {
                System.out.println("✗ 源脚本里找不到 " + t + " 的建表语句");
                return;
            }
            Map<String, String> idx = parseIndexes(body);
            wanted.put(t, idx);
            total += idx.size();
        }
        System.out.println("  期望索引合计 " + total + " 个");

        if (dry) {
            for (Map.Entry<String, Map<String, String>> e : wanted.entrySet()) {
                System.out.println();
                System.out.println("  -- " + e.getKey());
                for (Map.Entry<String, String> x : e.getValue().entrySet()) {
                    System.out.println("     ALTER TABLE " + e.getKey()
                        + " ADD INDEX " + x.getKey() + " (" + x.getValue() + ")");
                }
            }
            System.out.println();
            System.out.println("  （dry-run，未连库）");
            return;
        }

        String url = env("YQ_DB_URL", DEFAULT_URL);
        String user = env("YQ_DB_USER", DEFAULT_USER);
        String pass = env("YQ_DB_PASS", DEFAULT_PASS);
        String db = dbOf(url);

        int added = 0, skipped = 0;
        StringBuilder applied = new StringBuilder();

        try (Connection conn = DriverManager.getConnection(url, user, pass)) {
            System.out.println("  已连接: " + db);
            for (Map.Entry<String, Map<String, String>> e : wanted.entrySet()) {
                String table = e.getKey();
                if (!tableExists(conn, db, table)) {
                    System.out.println("  ! 表不存在，跳过（请先跑 DbAddTable）: " + table);
                    skipped += e.getValue().size();
                    continue;
                }
                Set<String> existing = existingIndexNames(conn, db, table);
                System.out.println();
                System.out.println("  -- " + table + "（现有索引 " + existing.size() + " 个）");
                for (Map.Entry<String, String> x : e.getValue().entrySet()) {
                    String name = x.getKey();
                    String cols = x.getValue();
                    if (existing.contains(name)) {
                        System.out.println("     = " + name + " 已存在，跳过");
                        skipped++;
                        continue;
                    }
                    String ddl = "ALTER TABLE " + table + " ADD INDEX " + name + " (" + cols + ")";
                    try (Statement st = conn.createStatement()) {
                        st.execute(ddl);
                        System.out.println("     + " + ddl);
                        added++;
                        applied.append(ddl).append(";\n");
                    } catch (SQLException ex) {
                        System.out.println("     ✗ " + ddl + "  -> " + ex.getMessage());
                    }
                }
            }
        }

        /* DDL 归档：留痕，便于回滚与复盘 */
        if (applied.length() > 0) {
            Path dir = Paths.get("tools/backup");
            Files.createDirectories(dir);
            String stamp = new java.text.SimpleDateFormat("yyyyMMdd-HHmmss").format(new java.util.Date());
            Path out = dir.resolve("add-index-" + stamp + ".sql");
            Files.write(out, applied.toString().getBytes(StandardCharsets.UTF_8));
            System.out.println();
            System.out.println("  DDL 已归档: " + out.toAbsolutePath());
        }

        System.out.println();
        System.out.println("  结果: 新增 " + added + " / 跳过 " + skipped);
    }

    /* ------------------------------------------------------------------ 解析 */

    /** 取出某张表的 CREATE TABLE 主体（括号内），返回 null 表示未找到 */
    static String extractBody(String all, String table) {
        Pattern p = Pattern.compile("CREATE TABLE\\s+`?" + Pattern.quote(table) + "`?\\s*\\(([\\s\\S]*?)\\n\\)\\s*ENGINE",
            Pattern.CASE_INSENSITIVE);
        Matcher m = p.matcher(all);
        return m.find() ? m.group(1) : null;
    }

    /** 解析 KEY / UNIQUE KEY 行 -> 索引名 : 列清单。PRIMARY KEY 不参与（建表时已有） */
    static Map<String, String> parseIndexes(String body) {
        Map<String, String> out = new LinkedHashMap<>();
        /* 逐行处理，避免跨行误匹配 */
        for (String raw : body.split("\n")) {
            String line = raw.trim();
            if (line.isEmpty() || line.startsWith("--")) {
                continue;
            }
            /* 去掉行尾逗号 */
            if (line.endsWith(",")) {
                line = line.substring(0, line.length() - 1).trim();
            }
            if (!line.toUpperCase().startsWith("KEY") && !line.toUpperCase().startsWith("UNIQUE KEY")) {
                continue;
            }
            Matcher m = Pattern.compile("^(?:UNIQUE\\s+)?KEY\\s+`?(\\w+)`?\\s*\\(([^)]*)\\)", Pattern.CASE_INSENSITIVE)
                .matcher(line);
            if (!m.find()) {
                continue;
            }
            String name = m.group(1);
            String cols = m.group(2).trim().replaceAll("\\s+", " ");
            /* 去掉列的长度前缀与 ASC/DESC，保持与 information_schema 比对口径一致 */
            StringBuilder clean = new StringBuilder();
            for (String c : cols.split(",")) {
                String cc = c.trim().replaceAll("\\(\\d+\\)", "").replaceAll("(?i)\\s+(ASC|DESC)$", "");
                if (clean.length() > 0) {
                    clean.append(',');
                }
                clean.append(cc);
            }
            out.put(name, clean.toString());
        }
        return out;
    }

    /* ------------------------------------------------------------------ 库查询 */

    static boolean tableExists(Connection conn, String db, String table) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
            "select count(*) from information_schema.tables where table_schema = ? and table_name = ?")) {
            ps.setString(1, db);
            ps.setString(2, table);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() && rs.getInt(1) > 0;
            }
        }
    }

    static Set<String> existingIndexNames(Connection conn, String db, String table) throws SQLException {
        Set<String> names = new LinkedHashSet<>();
        try (PreparedStatement ps = conn.prepareStatement(
            "select distinct index_name from information_schema.statistics where table_schema = ? and table_name = ?")) {
            ps.setString(1, db);
            ps.setString(2, table);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    names.add(rs.getString(1));
                }
            }
        }
        return names;
    }

    static String dbOf(String url) {
        String s = url;
        int q = s.indexOf('?');
        if (q > 0) {
            s = s.substring(0, q);
        }
        int slash = s.lastIndexOf('/');
        return slash > 0 ? s.substring(slash + 1) : s;
    }
}
