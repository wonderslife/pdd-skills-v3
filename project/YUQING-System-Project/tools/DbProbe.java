import java.sql.*;
import java.util.*;

/**
 * 库探测工具：看当前库里有什么表 / 哪些是若依基础表 / 哪些是 yuqing 表。
 * 用法：java -cp "<mysql-driver.jar>" DbProbe.java
 */
public class DbProbe {

    static final String URL = "jdbc:mysql://43.138.34.68:3306/ruoyi_zhai"
        + "?useUnicode=true&characterEncoding=utf8&zeroDateTimeBehavior=convertToNull"
        + "&useSSL=true&serverTimezone=GMT%2B8&autoReconnect=true"
        + "&rewriteBatchedStatements=true&allowPublicKeyRetrieval=true"
        + "&nullCatalogMeansCurrent=true";
    static final String USER = "ruoyi_zhai";
    static final String PASS = "BWnSwWmCSAyLtAr4";

    public static void main(String[] args) throws Exception {
        try (Connection c = DriverManager.getConnection(URL, USER, PASS)) {
            System.out.println("=== 连接成功 ===");
            DatabaseMetaData md = c.getMetaData();
            System.out.println("Server: " + md.getDatabaseProductName() + " " + md.getDatabaseProductVersion());
            System.out.println("Catalog: " + c.getCatalog());
            System.out.println();

            List<String> tables = new ArrayList<>();
            try (ResultSet rs = md.getTables(c.getCatalog(), null, "%", new String[]{"TABLE"})) {
                while (rs.next()) tables.add(rs.getString("TABLE_NAME"));
            }
            Collections.sort(tables);
            System.out.println("=== 表总数: " + tables.size() + " ===");

            List<String> yuqing = new ArrayList<>();
            List<String> sys = new ArrayList<>();
            List<String> other = new ArrayList<>();
            for (String t : tables) {
                if (t.startsWith("yq_")) yuqing.add(t);
                else if (t.startsWith("sys_") || t.startsWith("gen_") || t.startsWith("sys")) sys.add(t);
                else other.add(t);
            }

            System.out.println();
            System.out.println("=== yq_* 表 (" + yuqing.size() + ") ===");
            yuqing.forEach(t -> System.out.println("  " + t));

            System.out.println();
            System.out.println("=== 若依基础表 (" + sys.size() + ") ===");
            sys.forEach(t -> System.out.println("  " + t));

            System.out.println();
            System.out.println("=== 其他表 (" + other.size() + ") ===");
            other.forEach(t -> System.out.println("  " + t));

            // 行数统计（只对 yq_* 和 sys_menu/sys_dict_data）
            System.out.println();
            System.out.println("=== 关键表行数 ===");
            List<String> countTargets = new ArrayList<>(yuqing);
            countTargets.add("sys_menu");
            countTargets.add("sys_dict_type");
            countTargets.add("sys_dict_data");
            countTargets.add("sys_role");
            for (String t : countTargets) {
                try (Statement st = c.createStatement();
                     ResultSet rs = st.executeQuery("select count(1) from `" + t + "`")) {
                    if (rs.next()) System.out.printf("  %-40s %d%n", t, rs.getLong(1));
                } catch (Exception e) {
                    System.out.printf("  %-40s [ERR] %s%n", t, e.getMessage());
                }
            }
        }
    }
}
