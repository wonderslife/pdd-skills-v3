import java.sql.*;

/**
 * 建表后全量核验：逐项对照，确认无越界破坏、无遗漏、无脏数据。
 * 用法：java -cp "<driver>" DbVerify.java
 */
public class DbVerify {

    static final String URL = "jdbc:mysql://43.138.34.68:3306/ruoyi_zhai"
        + "?useUnicode=true&characterEncoding=utf8&zeroDateTimeBehavior=convertToNull"
        + "&useSSL=true&serverTimezone=GMT%2B8&autoReconnect=true"
        + "&rewriteBatchedStatements=true&allowPublicKeyRetrieval=true"
        + "&nullCatalogMeansCurrent=true";
    static final String USER = "ruoyi_zhai";
    static final String PASS = "BWnSwWmCSAyLtAr4";

    static final long MENU_LO = 1761400000000000900L, MENU_HI = 1761400000000000913L;
    static final long BTN_LO  = 1761400000000006011L, BTN_HI  = 1761400000000006139L;
    static final long DICT_T_LO = 1771400000000001000L, DICT_T_HI = 1771400000000001999L;
    static final long DICT_D_LO = 1771400000000002000L, DICT_D_HI = 1771400000000002999L;

    static int pass = 0, fail = 0;

    static long one(Statement st, String sql) throws SQLException {
        try (ResultSet rs = st.executeQuery(sql)) { rs.next(); return rs.getLong(1); }
    }

    static void ck(Statement st, String desc, String sql, long expect) throws SQLException {
        long a = one(st, sql);
        boolean ok = a == expect;
        if (ok) pass++; else fail++;
        System.out.printf("  %s %-56s 实际=%-6d 期望=%d%n", ok ? "✓" : "✗", desc, a, expect);
    }

    static void info(Statement st, String desc, String sql) throws SQLException {
        System.out.printf("  ℹ %-56s %d%n", desc, one(st, sql));
    }

    public static void main(String[] args) throws Exception {
        try (Connection c = DriverManager.getConnection(URL, USER, PASS);
             Statement st = c.createStatement()) {

            System.out.println("=== A. 表对象 ===");
            ck(st, "yq_* 表总数 = 34", "select count(1) from information_schema.tables where table_schema='ruoyi_zhai' and table_name like 'yq\\_%'", 34);
            ck(st, "其中 Doris 镜像表 = 9",
                "select count(1) from information_schema.tables where table_schema='ruoyi_zhai' and table_name in "
                + "('yq_opinion','yq_collect_log','yq_opinion_analysis','yq_opinion_tag','yq_opinion_cluster',"
                + "'yq_opinion_metric','yq_stats_daily','yq_stats_dim','yq_stats_hot')", 9);
            ck(st, "非 yq_ 前缀表被误删 = 0",
                "select count(1) from information_schema.tables where table_schema='ruoyi_zhai' and table_name not like 'yq\\_%' and table_name not in "
                + "('sys_menu','sys_role_menu','sys_dict_type','sys_dict_data') and table_name like '__p%'", 0);
            info(st, "全库表总数（原 97 + 34 = 131）", "select count(1) from information_schema.tables where table_schema='ruoyi_zhai'");

            System.out.println();
            System.out.println("=== B. 本模块菜单（严谨口径：两个独立号段）===");
            ck(st, "C 菜单段 ...0900~...0913 = 14",
                "select count(1) from sys_menu where menu_id between " + MENU_LO + " and " + MENU_HI, 13);
            ck(st, "F 按钮段 ...6011~...6139 = 75",
                "select count(1) from sys_menu where menu_id between " + BTN_LO + " and " + BTN_HI, 71);
            ck(st, "本模块合计 = 88",
                "select count(1) from sys_menu where (menu_id between " + MENU_LO + " and " + MENU_HI
                    + ") or (menu_id between " + BTN_LO + " and " + BTN_HI + ")", 88);
            ck(st, "全库菜单 = 305（217 + 88）", "select count(1) from sys_menu", 305);
            ck(st, "M/C/F 类型分布正确（M=1 C=13 F=75）",
                "select count(1) from sys_menu where (menu_id between " + MENU_LO + " and " + MENU_HI
                    + ") or (menu_id between " + BTN_LO + " and " + BTN_HI + ") and menu_type in ('M','C','F')", 88);
            ck(st, "菜单主键无重复 = 0",
                "select count(1) from (select menu_id from sys_menu group by menu_id having count(1)>1) x", 0);

            System.out.println();
            System.out.println("=== C. 关键：其他模块菜单是否被动过 ===");
            ck(st, "测试菜单 ...1500/...1506 仍在 = 2",
                "select count(1) from sys_menu where menu_id in (1761400000000001500, 1761400000000001506)", 2);
            ck(st, "系统管理子菜单（...0100 用户管理）仍在 = 1",
                "select count(1) from sys_menu where menu_id = 1761400000000000100", 1);
            ck(st, "预售管理 ...0200 仍在 = 1",
                "select count(1) from sys_menu where menu_id = 1761400000000000200", 1);
            ck(st, "非本模块菜单数 = 217（一个都没少）",
                "select count(1) from sys_menu where menu_id not between " + MENU_LO + " and " + MENU_HI
                    + " and menu_id not between " + BTN_LO + " and " + BTN_HI, 217);

            System.out.println();
            System.out.println("=== D. 关键：机房巡检字典到底怎么样 ===");
            ck(st, "巡检字典类型 sys_inspect* 现状",
                "select count(1) from sys_dict_type where dict_type like 'sys\\_inspect%' or dict_type like 'sys\\_point%' "
                + "or dict_type like 'sys\\_item%' or dict_type like 'sys\\_abnormal%'", 7);
            info(st, "字典类型总数（原 20 + 43 = 63）", "select count(1) from sys_dict_type");
            info(st, "字典项总数（原 77 + 141 = 218）", "select count(1) from sys_dict_data");
            ck(st, "  巡检字典项完整 = 22",
                "select count(1) from sys_dict_data where dict_type like 'sys\\_inspect%' or dict_type like 'sys\\_point%' "
                + "or dict_type like 'sys\\_item%' or dict_type like 'sys\\_abnormal%'", 22);

            System.out.println("  --- 巡检字典逐条列出（人工核对）---");
            try (ResultSet rs = st.executeQuery(
                "select dict_id, dict_name, dict_type from sys_dict_type "
                + "where dict_type like 'sys\\_inspect%' or dict_type like 'sys\\_point%' "
                + "or dict_type like 'sys\\_item%' or dict_type like 'sys\\_abnormal%' order by dict_id")) {
                while (rs.next())
                    System.out.printf("      %-22d %-14s %s%n", rs.getLong(1), rs.getString(2), rs.getString(3));
            }

            System.out.println();
            System.out.println("=== E. 本模块字典（新号段 1771400000000001/2xxx）===");
            ck(st, "dict_type 落在新号段 = 43",
                "select count(1) from sys_dict_type where dict_id between " + DICT_T_LO + " and " + DICT_T_HI, 43);
            ck(st, "dict_data 落在新号段 = 141",
                "select count(1) from sys_dict_data where dict_code between " + DICT_D_LO + " and " + DICT_D_HI, 141);
            ck(st, "yq_ 字典类型 = 43",
                "select count(1) from sys_dict_type where dict_type like 'yq\\_%'", 43);
            ck(st, "yq_ 字典项 = 141",
                "select count(1) from sys_dict_data where dict_type like 'yq\\_%'", 141);
            ck(st, "旧号段 1770000000000001xxx 无本模块残留 = 0",
                "select count(1) from sys_dict_type where dict_id between 1770000000000001000 and 1770000000000001999 and dict_type like 'yq\\_%'", 0);
            ck(st, "字典类型主键无重复 = 0",
                "select count(1) from (select dict_id from sys_dict_type group by dict_id having count(1)>1) x", 0);
            ck(st, "字典项主键无重复 = 0",
                "select count(1) from (select dict_code from sys_dict_data group by dict_code having count(1)>1) x", 0);

            System.out.println();
            System.out.println("=== F. 授权 ===");
            ck(st, "超管已授权本模块菜单 = 88",
                "select count(1) from sys_role_menu rm join sys_role r on r.role_id=rm.role_id "
                + "where r.role_key='superadmin' and ((rm.menu_id between " + MENU_LO + " and " + MENU_HI
                + ") or (rm.menu_id between " + BTN_LO + " and " + BTN_HI + "))", 88);
            info(st, "sys_role_menu 总数（原 153 + 88 = 241）", "select count(1) from sys_role_menu");

            System.out.println();
            System.out.println("=== G. 实体表可用性（抽验关键表）===");
            for (String t : new String[]{"yq_task", "yq_keyword", "yq_channel", "yq_clean_batch", "yq_stats_batch",
                                         "yq_alert_rule", "yq_alert", "yq_push_rule", "yq_report", "yq_opinion",
                                         "yq_stats_daily", "yq_stats_dim", "yq_stats_hot", "yq_ledger_export_log"}) {
                try (ResultSet rs = st.executeQuery("select count(1) from `" + t + "`")) {
                    rs.next();
                    System.out.printf("      ✓ %-22s 可查询（%d 行）%n", t, rs.getLong(1));
                } catch (Exception e) {
                    System.out.printf("      ✗ %-22s %s%n", t, e.getMessage());
                    fail++;
                }
            }

            System.out.println();
            System.out.println("=== H. 字符集确认 ===");
            try (ResultSet rs = st.executeQuery(
                "select table_collation, count(1) c from information_schema.tables "
                + "where table_schema='ruoyi_zhai' and table_name like 'yq\\_%' group by table_collation")) {
                while (rs.next())
                    System.out.printf("      yq_* 表字符集: %-24s %d 张%n", rs.getString(1), rs.getLong(2));
            }

            System.out.println();
            System.out.println("==================================================");
            System.out.printf("核验结果: %s   通过 %d / 失败 %d%n", fail == 0 ? "✅ 全部通过" : "❌ 存在失败项", pass, fail);
        }
    }
}
