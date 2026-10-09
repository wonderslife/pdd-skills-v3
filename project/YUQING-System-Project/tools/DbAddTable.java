import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

/**
 * 纯增量建表：只在目标表【不存在】时执行 CREATE TABLE，绝不 DROP。
 *
 * 与 DbRebuild 的区别：
 *   - DbRebuild   = 定向重建（DROP + CREATE），用于修结构错误，会清空该表数据；
 *   - DbAddTable  = 纯新增（仅 CREATE），用于给已上线库补新表，零破坏。
 *
 * 这是本项目「纯增量，不 DROP」建表策略的落地工具：新增表走这里，
 * 而不是重跑 yq_schema.sql（那份脚本含 25 条 DROP，重跑会清空全部业务数据）。
 *
 * 用法：
 *   java -cp "<driver>" tools\DbAddTable.java yq_ledger_export_log
 *   java -cp "<driver>" tools\DbAddTable.java --from yq-code/sql/yq_schema.sql yq_xxx yq_yyy
 *   java -cp "<driver>" tools\DbAddTable.java --dry-run yq_ledger_export_log
 *
 * 安全约束：
 *   - 表名必须以 yq_ 开头（拒绝误伤他人表）；
 *   - 只提取并执行「CREATE TABLE」语句，源文件里的 DROP / SET / INSERT 一律不执行；
 *   - 已存在的表跳过并告警，不做任何变更；
 *   - --dry-run 只打印将执行的 DDL，不连库。
 */
public class DbAddTable {

    static final String URL = "jdbc:mysql://43.138.34.68:3306/ruoyi_zhai"
        + "?useUnicode=true&characterEncoding=utf8&zeroDateTimeBehavior=convertToNull"
        + "&useSSL=true&serverTimezone=GMT%2B8&autoReconnect=true"
        + "&rewriteBatchedStatements=true&allowPublicKeyRetrieval=true"
        + "&nullCatalogMeansCurrent=true";
    static final String USER = "ruoyi_zhai";
    static final String PASS = "BWnSwWmCSAyLtAr4";
    static final String DB = "ruoyi_zhai";

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
            System.out.println("用法: DbAddTable [--from <sql>] [--dry-run] <表名>...");
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

        System.out.println("=== 纯增量建表（不 DROP）===");
        System.out.println("  源脚本: " + sqlPath);
        System.out.println("  目标表: " + tables);
        System.out.println();

        /* ---- 先抽出全部 DDL 并在本地校验完整性，避免「执行一半失败」---- */
        Map<String, String> ddls = new LinkedHashMap<>();
        for (String t : tables) {
            String ddl = extractCreate(all, t);
            if (ddl == null) {
                System.out.println("✗ 源脚本中未找到 " + t + " 的 CREATE TABLE 语句，终止（不做任何变更）");
                return;
            }
            if (!ddl.toUpperCase().contains("CREATE TABLE")) {
                System.out.println("✗ " + t + " 抽出的语句不是 CREATE TABLE，终止");
                return;
            }
            ddls.put(t, ddl);
        }

        if (dry) {
            System.out.println("--- dry-run：以下 DDL 将执行（未连库）---");
            for (Map.Entry<String, String> e : ddls.entrySet()) {
                System.out.println();
                System.out.println("  -- " + e.getKey());
                System.out.println("  " + e.getValue() + ";");
            }
            System.out.println();
            System.out.println("完成（dry-run，未做任何变更）。");
            return;
        }

        int created = 0, skipped = 0;

        try (Connection c = DriverManager.getConnection(URL, USER, PASS)) {
            /* ---- 存在性预检：任何一张已存在就整体跳过它，但继续处理其它表 ---- */
            System.out.println("--- 存在性预检 ---");
            List<String> todo = new ArrayList<>();
            for (String t : tables) {
                if (exists(c, t)) {
                    System.out.println("  ⏭ " + t + " 已存在，跳过（不做任何变更）");
                    skipped++;
                } else {
                    System.out.println("  + " + t + " 不存在，将创建");
                    todo.add(t);
                }
            }
            System.out.println();

            if (!todo.isEmpty()) {
                System.out.println("--- 执行 CREATE ---");
                try (Statement st = c.createStatement()) {
                    for (String t : todo) {
                        st.execute(ddls.get(t));
                        System.out.println("  ✓ " + t + " 已创建");
                        created++;
                    }
                }
                System.out.println();
            }

            System.out.println("--- 创建后结构 ---");
            for (String t : tables) {
                showCols(c, t);
            }
        }

        /* ---- 把本次实际执行的 DDL 落盘归档，便于回溯与环境复现 ---- */
        if (created > 0) {
            Path outDir = Paths.get("tools", "backup");
            Files.createDirectories(outDir);
            String stamp = new java.text.SimpleDateFormat("yyyyMMdd-HHmmss").format(new java.util.Date());
            Path out = outDir.resolve("add-table-" + stamp + ".sql");
            StringBuilder sb = new StringBuilder();
            sb.append("-- 纯增量建表归档（DbAddTable 产出，不含 DROP）\n");
            sb.append("-- 源: ").append(sqlPath).append("\n");
            sb.append("-- 时间: ").append(stamp).append("\n\n");
            for (Map.Entry<String, String> e : ddls.entrySet()) {
                sb.append(e.getValue()).append(";\n\n");
            }
            Files.write(out, sb.toString().getBytes(StandardCharsets.UTF_8));
            System.out.println();
            System.out.println("  已归档 DDL: " + out);
        }

        System.out.println();
        System.out.println("完成。新建 " + created + " 张，跳过 " + skipped + " 张（已存在）。");
    }

    /** 抽 `CREATE TABLE <t> ( ... ) ENGINE=...COMMENT='...'` 到分号为止；跳过 DROP。 */
    static String extractCreate(String all, String t) {
        int i = all.indexOf("CREATE TABLE " + t + " (");
        if (i < 0) {
            return null;
        }
        int end = all.indexOf(";", i);
        if (end < 0) {
            return null;
        }
        return all.substring(i, end).trim();
    }

    static boolean exists(Connection c, String t) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(
            "select count(*) from information_schema.tables where table_schema=? and table_name=?")) {
            ps.setString(1, DB);
            ps.setString(2, t);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() && rs.getInt(1) > 0;
            }
        }
    }

    static void showCols(Connection c, String t) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(
            "select column_name, column_type, is_nullable from information_schema.columns "
            + "where table_schema=? and table_name=? order by ordinal_position")) {
            ps.setString(1, DB);
            ps.setString(2, t);
            try (ResultSet rs = ps.executeQuery()) {
                int n = 0;
                System.out.println("  --- " + t + " ---");
                while (rs.next()) {
                    System.out.printf("      %-18s %-22s %s%n", rs.getString(1), rs.getString(2), rs.getString(3));
                    n++;
                }
                if (n == 0) {
                    System.out.println("      (表不存在)");
                } else {
                    System.out.println("      共 " + n + " 列");
                }
            }
        }
    }
}
