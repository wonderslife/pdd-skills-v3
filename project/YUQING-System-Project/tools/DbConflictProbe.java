import java.sql.*;
import java.util.*;

/**
 * 号段冲突取证：查清本模块 menu_id / dict_id 号段内已有对象是谁、属于哪个模块。
 * 决策依据：若为其他模块占用 → 必须换号段；若为本模块残留 → 可直接清理重跑。
 * 用法：java -cp "<mysql-driver.jar>" DbConflictProbe.java
 */
public class DbConflictProbe {

    static final String URL = "jdbc:mysql://43.138.34.68:3306/ruoyi_zhai"
        + "?useUnicode=true&characterEncoding=utf8&zeroDateTimeBehavior=convertToNull"
        + "&useSSL=true&serverTimezone=GMT%2B8&autoReconnect=true"
        + "&rewriteBatchedStatements=true&allowPublicKeyRetrieval=true"
        + "&nullCatalogMeansCurrent=true";
    static final String USER = "ruoyi_zhai";
    static final String PASS = "BWnSwWmCSAyLtAr4";

    static void q(Connection c, String label, String sql) {
        System.out.println("  --- " + label + " ---");
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            int n = m.getColumnCount();
            StringBuilder hdr = new StringBuilder("      ");
            for (int i = 1; i <= n; i++) hdr.append(String.format("%-22s", m.getColumnLabel(i)));
            System.out.println(hdr);
            int rows = 0;
            while (rs.next()) {
                StringBuilder sb = new StringBuilder("      ");
                for (int i = 1; i <= n; i++) {
                    String v = rs.getString(i);
                    if (v != null && v.length() > 20) v = v.substring(0, 20);
                    sb.append(String.format("%-22s", v == null ? "NULL" : v));
                }
                System.out.println(sb);
                rows++;
            }
            if (rows == 0) System.out.println("      (无)");
        } catch (Exception e) {
            System.out.println("      [ERR] " + e.getMessage());
        }
        System.out.println();
    }

    public static void main(String[] args) throws Exception {
        try (Connection c = DriverManager.getConnection(URL, USER, PASS)) {
            System.out.println("=== 号段内已有 sys_menu 节点（1761400000000000900 ~ ...6139）===");
            q(c, "按 menu_type 分组统计",
                "select menu_type, count(1) c, min(menu_id) min_id, max(menu_id) max_id "
                + "from sys_menu where menu_id between 1761400000000000900 and 1761400000000006139 "
                + "group by menu_type");
            q(c, "顶层父节点（M/C 目录，看归属模块）",
                "select menu_id, menu_name, parent_id, path, component, perms "
                + "from sys_menu where menu_id between 1761400000000000900 and 1761400000000006139 "
                + "and menu_type in ('M','C') order by menu_id");
            q(c, "父节点不在号段内的孤儿节点（属于其他模块的子菜单）",
                "select menu_id, menu_name, parent_id, perms from sys_menu "
                + "where menu_id between 1761400000000000900 and 1761400000000006139 "
                + "and parent_id not between 1761400000000000900 and 1761400000000006139 order by menu_id");
            q(c, "全部 80 条明细",
                "select menu_id, menu_name, parent_id, menu_type, path, perms from sys_menu "
                + "where menu_id between 1761400000000000900 and 1761400000000006139 order by menu_id");
            System.out.println();

            System.out.println("=== 号段内已有字典（1770000000000001000 ~ ...2999）===");
            q(c, "dict_type 明细",
                "select dict_id, dict_name, dict_type from sys_dict_type "
                + "where dict_id between 1770000000000001000 and 1770000000000001999 order by dict_id");
            q(c, "dict_data 明细",
                "select dict_code, dict_type, dict_label, dict_value from sys_dict_data "
                + "where dict_code between 1770000000000002000 and 1770000000000002999 order by dict_code");
            System.out.println();

            System.out.println("=== 全库 yq_ 相关残留 ===");
            q(c, "sys_menu 里 perms 含 yuqing 的节点数",
                "select count(1) from sys_menu where perms like 'yuqing%'");
            q(c, "sys_menu 里 remark='舆情监测平台' 的节点数",
                "select count(1) from sys_menu where remark = '舆情监测平台'");
            q(c, "sys_dict_type 里 remark='舆情监测平台' 的数量",
                "select count(1) from sys_dict_type where remark = '舆情监测平台'");
            System.out.println();

            System.out.println("=== 菜单号段占用全景（按 1e15 分段看各模块）===");
            q(c, "各 menu_id 高位段分布",
                "select floor(menu_id/1000000000000000) seg, count(1) c, min(menu_name) sample "
                + "from sys_menu group by seg order by seg");
            q(c, "1761400000000000xxx 段的父链",
                "select m.menu_id, m.menu_name, m.parent_id, p.menu_name parent_name "
                + "from sys_menu m left join sys_menu p on p.menu_id = m.parent_id "
                + "where m.menu_id between 1761400000000000000 and 1761400000000009999 "
                + "and m.menu_type in ('M','C') order by m.menu_id");
        }
    }
}
