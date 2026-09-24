import java.sql.*;
import java.util.*;

/**
 * 号段重排方案计算：为 yq_* 字典找一段安全的 dict_id / dict_code 号段。
 * 输入已占用的号段（实测），输出候选号段及其空闲校验结果。
 * 用法：java -cp "<mysql-driver.jar>" DbSegmentPlan.java
 */
public class DbSegmentPlan {

    static final String URL = "jdbc:mysql://43.138.34.68:3306/ruoyi_zhai"
        + "?useUnicode=true&characterEncoding=utf8&zeroDateTimeBehavior=convertToNull"
        + "&useSSL=true&serverTimezone=GMT%2B8&autoReconnect=true"
        + "&rewriteBatchedStatements=true&allowPublicKeyRetrieval=true"
        + "&nullCatalogMeansCurrent=true";
    static final String USER = "ruoyi_zhai";
    static final String PASS = "BWnSwWmCSAyLtAr4";

    /** 打印某号段区间内是否已被占用 */
    static void checkSeg(Connection c, String label, String table, String col, long lo, long hi) {
        String sql = "select count(1) c, coalesce(min(" + col + "),0) mn, coalesce(max(" + col + "),0) mx from " + table
            + " where " + col + " between " + lo + " and " + hi;
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            rs.next();
            long n = rs.getLong("c");
            System.out.printf("  %-46s 占用 %-4d %s%n",
                label, n, n == 0 ? "✅ 空闲可用" : "⚠️ 冲突 (min=" + rs.getLong("mn") + ", max=" + rs.getLong("mx") + ")");
        } catch (Exception e) {
            System.out.printf("  %-46s [ERR] %s%n", label, e.getMessage());
        }
    }

    public static void main(String[] args) throws Exception {
        try (Connection c = DriverManager.getConnection(URL, USER, PASS)) {
            System.out.println("=== 现有 dict_id 占用全景（按 1e12 分段）===");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery(
                     "select floor(dict_id/1000000000000) seg, count(1) c, min(dict_id) mn, max(dict_id) mx "
                     + "from sys_dict_type group by seg order by seg")) {
                System.out.println("      seg            数量    min                    max");
                while (rs.next()) {
                    System.out.printf("      %-14d %-6d %-22d %d%n",
                        rs.getLong("seg"), rs.getLong("c"), rs.getLong("mn"), rs.getLong("mx"));
                }
            }
            System.out.println();

            System.out.println("=== 现有 dict_code 占用全景（按 1e12 分段）===");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery(
                     "select floor(dict_code/1000000000000) seg, count(1) c, min(dict_code) mn, max(dict_code) mx "
                     + "from sys_dict_data group by seg order by seg")) {
                System.out.println("      seg            数量    min                    max");
                while (rs.next()) {
                    System.out.printf("      %-14d %-6d %-22d %d%n",
                        rs.getLong("seg"), rs.getLong("c"), rs.getLong("mn"), rs.getLong("mx"));
                }
            }
            System.out.println();

            System.out.println("=== 候选号段空闲校验 ===");
            System.out.println("  [A] 舆情字典 · 当前号段（已被机房巡检占用）");
            checkSeg(c, "dict_id 1770000000000001000~1770000000000001999", "sys_dict_type", "dict_id",
                1770000000000001000L, 1770000000000001999L);
            checkSeg(c, "dict_code 1770000000000002000~1770000000000002999", "sys_dict_data", "dict_code",
                1770000000000002000L, 1770000000000002999L);
            System.out.println();

            System.out.println("  [B] 舆情字典 · 下沉到 19xxxxxx 段（推荐：与巡检 1770xxx 错开一个数量级）");
            checkSeg(c, "dict_id 1771400000000001000~1771400000000001999", "sys_dict_type", "dict_id",
                1771400000000001000L, 1771400000000001999L);
            checkSeg(c, "dict_code 1771400000000002000~1771400000000002999", "sys_dict_data", "dict_code",
                1771400000000002000L, 1771400000000002999L);
            System.out.println();

            System.out.println("  [C] 舆情字典 · 用 1780xxx 段（与预设/二维码模块的 1770xxx 相邻但不重叠）");
            checkSeg(c, "dict_id 1780000000000001000~1780000000000001999", "sys_dict_type", "dict_id",
                1780000000000001000L, 1780000000000001999L);
            checkSeg(c, "dict_code 1780000000000002000~1780000000000002999", "sys_dict_data", "dict_code",
                1780000000000002000L, 1780000000000002999L);
            System.out.println();

            System.out.println("=== 菜单号段交叉复核（已确认不冲突，做最终确认）===");
            checkSeg(c, "菜单 C 段 1761400000000000900~1761400000000000912", "sys_menu", "menu_id",
                1761400000000000900L, 1761400000000000912L);
            checkSeg(c, "菜单 F 段 1761400000000006011~1761400000000006139", "sys_menu", "menu_id",
                1761400000000006011L, 1761400000000006139L);
            System.out.println();

            System.out.println("=== 业务表空间占用（yq_ 表尚未创建，确认为 0）===");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery(
                     "select count(1) c from information_schema.tables where table_schema='ruoyi_zhai' and table_name like 'yq\\_%'")) {
                rs.next();
                System.out.printf("  yq_* 表数量: %d %s%n", rs.getLong(1), rs.getLong(1) == 0 ? "✅ 全新建表可用" : "⚠️ 已存在");
            }
        }
    }
}
