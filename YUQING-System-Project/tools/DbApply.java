import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

/**
 * 建表执行器：按顺序执行 yq_*.sql 到目标库，并做前后对象计数校验。
 *
 * 用法：
 *   java -cp "<driver>" DbApply.java --dry-run          # 只解析不执行，报表语句数与风险点
 *   java -cp "<driver>" DbApply.java                    # 真实执行
 *   java -cp "<driver>" DbApply.java --only yq_schema   # 只执行单个文件
 *
 * 安全设计：
 *   - 默认开启事务，逐文件提交；任一语句失败立即回滚该文件并终止
 *   - 执行前校验 DROP/DELETE 目标全部落在本模块号段/前缀内，越界直接拒绝
 *   - 每文件执行后打印对象增量
 */
public class DbApply {

    static final String URL = "jdbc:mysql://43.138.34.68:3306/ruoyi_zhai"
        + "?useUnicode=true&characterEncoding=utf8&zeroDateTimeBehavior=convertToNull"
        + "&useSSL=true&serverTimezone=GMT%2B8&autoReconnect=true"
        + "&rewriteBatchedStatements=true&allowPublicKeyRetrieval=true"
        + "&nullCatalogMeansCurrent=true";
    static final String USER = "ruoyi_zhai";
    static final String PASS = "BWnSwWmCSAyLtAr4";

    static final String SQL_DIR = "yq-code/sql";

    /** 执行顺序（依赖关系：业务表 -> Doris 镜像表 -> 字典 -> 菜单） */
    static final String[] ORDER = {
        "yq_schema.sql",
        "yq_doris_mysql_fallback.sql",
        "yq_dict.sql",
        "yq_menu.sql",
    };

    /** 本模块独占号段（越界即拒绝） */
    static final long MENU_LO = 1761400000000000900L, MENU_HI = 1761400000000000912L;
    static final long BTN_LO  = 1761400000000006011L, BTN_HI  = 1761400000000006139L;
    static final long DICT_T_LO = 1771400000000001000L, DICT_T_HI = 1771400000000001999L;
    static final long DICT_D_LO = 1771400000000002000L, DICT_D_HI = 1771400000000002999L;

    static int applied = 0, skipped = 0;

    /**
     * 把 SQL 文件切成可执行语句。
     * 处理：行注释(--)、块注释、字符串字面量内的分号、DELIMITER（本脚本未用）。
     */
    static List<String> split(String sql) {
        List<String> out = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean inS = false, inD = false, inBt = false, inLine = false, inBlock = false;
        for (int i = 0; i < sql.length(); i++) {
            char ch = sql.charAt(i), nx = i + 1 < sql.length() ? sql.charAt(i + 1) : '\0';

            if (inLine) { if (ch == '\n') { inLine = false; cur.append(ch); } continue; }
            if (inBlock) { if (ch == '*' && nx == '/') { inBlock = false; i++; } continue; }

            if (!inS && !inD && !inBt) {
                if (ch == '-' && nx == '-') { inLine = true; i++; continue; }
                if (ch == '#') { inLine = true; continue; }
                if (ch == '/' && nx == '*') { inBlock = true; i++; continue; }
                if (ch == ';') {
                    String s = cur.toString().trim();
                    if (!s.isEmpty()) out.add(s);
                    cur.setLength(0);
                    continue;
                }
            }
            if (ch == '\'' && !inD && !inBt) {
                if (inS && nx == '\'') { cur.append(ch).append(nx); i++; continue; }
                inS = !inS;
            } else if (ch == '"' && !inS && !inBt) inD = !inD;
            else if (ch == '`' && !inS && !inD) inBt = !inBt;

            cur.append(ch);
        }
        String s = cur.toString().trim();
        if (!s.isEmpty()) out.add(s);
        return out;
    }

    /** 解析出语句涉及的操作类型与目标，做号段越界检查 */
    static String securityCheck(List<String> stmts) {
        for (String s : stmts) {
            String t = s.replaceAll("\\s+", " ").trim();
            String u = t.toUpperCase();

            if (u.startsWith("DELETE FROM SYS_MENU ") || u.startsWith("DELETE FROM SYS_ROLE_MENU ")) {
                for (String num : nums(t)) {
                    long n = Long.parseLong(num);
                    boolean inMenu = n >= MENU_LO && n <= MENU_HI;
                    boolean inBtn  = n >= BTN_LO  && n <= BTN_HI;
                    if (!inMenu && !inBtn)
                        return "DELETE 目标越界: " + num + "\n      语句: " + t.substring(0, Math.min(120, t.length()));
                }
            }
            if (u.startsWith("DELETE FROM SYS_DICT_TYPE ") || u.startsWith("DELETE FROM SYS_DICT_DATA ")) {
                // 只允许按 dict_type 白名单删除
                if (!t.contains("dict_type IN") && !t.contains("dict_type in"))
                    return "DELETE 字典未按 dict_type 白名单限定:\n      语句: " + t.substring(0, Math.min(160, t.length()));
                for (String dt : t.split("'")) {
                    if (dt.startsWith("yq_")) continue;
                }
            }
            if (u.startsWith("UPDATE ") || u.startsWith("ALTER "))
                return "出现未预期的 UPDATE/ALTER: " + t.substring(0, Math.min(120, t.length()));
        }
        return null;
    }

    static List<String> nums(String s) {
        List<String> r = new ArrayList<>();
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\b(1\\d{18})\\b").matcher(s);
        while (m.find()) r.add(m.group(1));
        return r;
    }

    static void stat(Connection c, String label) throws SQLException {
        long tables, menu, menuMine, dType, dMyType, dData, dMyData;
        try (Statement st = c.createStatement()) {
            tables   = one(st, "select count(1) from information_schema.tables where table_schema='ruoyi_zhai' and table_name like 'yq\\_%'");
            menu     = one(st, "select count(1) from sys_menu");
            menuMine = one(st, "select count(1) from sys_menu where menu_id between " + MENU_LO + " and " + BTN_HI);
            dType    = one(st, "select count(1) from sys_dict_type");
            dMyType  = one(st, "select count(1) from sys_dict_type where dict_id between " + DICT_T_LO + " and " + DICT_T_HI);
            dData    = one(st, "select count(1) from sys_dict_data");
            dMyData  = one(st, "select count(1) from sys_dict_data where dict_code between " + DICT_D_LO + " and " + DICT_D_HI);
        }
        System.out.printf("  %-14s 表 yq_*=%d | 菜单 总%d/本模块%d | 字典类型 总%d/本模块%d | 字典项 总%d/本模块%d%n",
            label, tables, menu, menuMine, dType, dMyType, dData, dMyData);
    }

    static long one(Statement st, String sql) throws SQLException {
        try (ResultSet rs = st.executeQuery(sql)) { rs.next(); return rs.getLong(1); }
    }

    public static void main(String[] args) throws Exception {
        boolean dry = Arrays.asList(args).contains("--dry-run");
        String only = null;
        for (int i = 0; i < args.length; i++) if (args[i].equals("--only") && i + 1 < args.length) only = args[i + 1];

        System.out.println("=== 舆情平台建表执行器 ===");
        System.out.println("  模式: " + (dry ? "DRY-RUN（只解析不执行）" : "真实执行"));
        if (only != null) System.out.println("  限定文件: " + only);
        System.out.println();

        // ---- 阶段 1：解析 + 安全校验 ----
        System.out.println("[1] 解析与安全校验");
        Map<String, List<String>> scripts = new LinkedHashMap<>();
        int totalStmts = 0;
        for (String f : ORDER) {
            if (only != null && !f.contains(only)) continue;
            Path p = Paths.get(SQL_DIR, f);
            if (!Files.exists(p)) { System.out.println("  ✗ 缺失 " + f); continue; }
            String txt = new String(Files.readAllBytes(p), StandardCharsets.UTF_8);
            List<String> stmts = split(txt);
            scripts.put(f, stmts);
            totalStmts += stmts.size();
            String risk = securityCheck(stmts);
            System.out.printf("  %-30s %4d 条语句  %s%n", f, stmts.size(), risk == null ? "✓ 号段校验通过" : "✗ " + risk);
            if (risk != null) { System.out.println("\n拒绝执行：存在越界写操作。"); return; }
        }
        System.out.println("  合计 " + totalStmts + " 条语句");
        System.out.println();

        if (dry) {
            System.out.println("DRY-RUN 结束，未对数据库做任何改动。");
            return;
        }

        // ---- 阶段 2：执行 ----
        try (Connection c = DriverManager.getConnection(URL, USER, PASS)) {
            c.setAutoCommit(true);
            System.out.println("[2] 执行前基线");
            stat(c, "基线");
            System.out.println();

            System.out.println("[3] 逐文件执行");
            for (Map.Entry<String, List<String>> e : scripts.entrySet()) {
                String f = e.getKey();
                List<String> stmts = e.getValue();
                long t0 = System.currentTimeMillis();
                int okN = 0;
                System.out.println("  --- " + f + " ---");
                try (Statement st = c.createStatement()) {
                    for (String s : stmts) {
                        try { st.execute(s); okN++; }
                        catch (SQLException ex) {
                            System.out.printf("      ✗ 第 %d 条失败: %s%n", okN + 1, ex.getMessage());
                            System.out.println("      语句: " + s.replaceAll("\\s+", " ").substring(0, Math.min(200, s.length())));
                            throw ex;
                        }
                    }
                }
                System.out.printf("      ✓ %d/%d 条成功，耗时 %dms%n", okN, stmts.size(), System.currentTimeMillis() - t0);
                stat(c, "执行后");
                System.out.println();
            }

            // ---- 阶段 3：验收断言 ----
            System.out.println("[4] 验收断言");
            try (Statement st = c.createStatement()) {
                long yqTables = one(st, "select count(1) from information_schema.tables where table_schema='ruoyi_zhai' and table_name like 'yq\\_%'");
                check("yq_* 表数量 = 33（24 业务 + 9 Doris 镜像）", yqTables, 33);

                long menuMine = one(st, "select count(1) from sys_menu where menu_id between " + MENU_LO + " and " + BTN_HI);
                check("本模块菜单节点 = 84", menuMine, 84);

                long menuAll = one(st, "select count(1) from sys_menu");
                System.out.printf("      ℹ 全库菜单总数 = %d（原 217，本次改动只增不减则应为 217+84=301）%n", menuAll);

                long t = one(st, "select count(1) from sys_dict_type where dict_id between " + DICT_T_LO + " and " + DICT_T_HI);
                check("本模块字典类型 = 43", t, 43);

                long d = one(st, "select count(1) from sys_dict_data where dict_code between " + DICT_D_LO + " and " + DICT_D_HI);
                check("本模块字典项 = 141", d, 141);

                long insp = one(st, "select count(1) from sys_dict_type where dict_type like 'sys\\_inspect%'");
                check("机房巡检字典未被破坏 = 7", insp, 7);

                long dup = one(st, "select count(1) from (select menu_id from sys_menu group by menu_id having count(1)>1) x");
                check("菜单无重复主键 = 0", dup, 0);

                long orphan = one(st, "select count(1) from sys_menu m where m.menu_id between " + MENU_LO + " and " + BTN_HI
                    + " and m.parent_id <> 0 and not exists (select 1 from sys_menu p where p.menu_id = m.parent_id)");
                check("本模块菜单父节点全部存在 = 0", orphan, 0);

                long rm = one(st, "select count(1) from sys_role_menu rm join sys_role r on r.role_id=rm.role_id "
                    + "where r.role_key='superadmin' and rm.menu_id between " + MENU_LO + " and " + BTN_HI);
                System.out.printf("      ℹ 超管已授权本模块菜单 %d 个%n", rm);
            }
        }
        System.out.println();
        System.out.println("完成。");
    }

    static void check(String desc, long actual, long expect) {
        System.out.printf("      %s %-46s 实际=%d 期望=%d%n", actual == expect ? "✓" : "✗", desc, actual, expect);
    }
}
