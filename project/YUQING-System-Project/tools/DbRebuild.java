import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

/**
 * 定向重建：只重建指定表（用于修正表结构错误），不动其余对象。
 *
 * 用法：java -cp "<driver>" tools\DbRebuild.java yq_opinion_tag yq_opinion_cluster yq_opinion_metric
 *
 * 从 yq-code/sql/yq_doris_mysql_fallback.sql 中抽出目标表的 DROP+CREATE 语句并执行。
 * 安全：只接受白名单前缀 yq_，且只执行 DROP TABLE IF EXISTS + CREATE TABLE。
 */
public class DbRebuild {

    static final String URL = "jdbc:mysql://43.138.34.68:3306/ruoyi_zhai"
        + "?useUnicode=true&characterEncoding=utf8&zeroDateTimeBehavior=convertToNull"
        + "&useSSL=true&serverTimezone=GMT%2B8&autoReconnect=true"
        + "&rewriteBatchedStatements=true&allowPublicKeyRetrieval=true"
        + "&nullCatalogMeansCurrent=true";
    static final String USER = "ruoyi_zhai";
    static final String PASS = "BWnSwWmCSAyLtAr4";

    public static void main(String[] args) throws Exception {
        if (args.length == 0) { System.out.println("用法: DbRebuild <表名>..."); return; }
        for (String a : args) {
            if (!a.startsWith("yq_")) { System.out.println("拒绝：表名必须以 yq_ 开头 -> " + a); return; }
        }

        Set<String> targets = new LinkedHashSet<>(Arrays.asList(args));
        String all = new String(Files.readAllBytes(Paths.get("yq-code/sql/yq_doris_mysql_fallback.sql")), StandardCharsets.UTF_8);

        System.out.println("=== 定向重建表 ===");
        System.out.println("  目标: " + targets);
        System.out.println();

        try (Connection c = DriverManager.getConnection(URL, USER, PASS)) {
            System.out.println("--- 重建前 ---");
            for (String t : targets) showCols(c, t);
            System.out.println();

            try (Statement st = c.createStatement()) {
                for (String t : targets) {
                    String drop = "DROP TABLE IF EXISTS " + t;
                    String create = extract(all, t);
                    if (create == null) { System.out.println("  ✗ 未在 fallback 脚本中找到 " + t + " 的 CREATE"); return; }

                    st.execute(drop);
                    st.execute(create);
                    System.out.println("  ✓ " + t + " 已重建");
                }
            }

            System.out.println();
            System.out.println("--- 重建后 ---");
            for (String t : targets) showCols(c, t);
        }
        System.out.println();
        System.out.println("完成。");
    }

    /** 从脚本里抽出 create table <t> ( ... ) ENGINE...COMMENT='...'; */
    static String extract(String all, String t) {
        int i = all.indexOf("CREATE TABLE " + t + " (");
        if (i < 0) return null;
        int end = all.indexOf(";", i);
        return all.substring(i, end);
    }

    static void showCols(Connection c, String t) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(
            "select column_name, column_type, is_nullable from information_schema.columns "
            + "where table_schema='ruoyi_zhai' and table_name=? order by ordinal_position")) {
            ps.setString(1, t);
            try (ResultSet rs = ps.executeQuery()) {
                int n = 0;
                System.out.println("  --- " + t + " ---");
                while (rs.next()) {
                    System.out.printf("      %-18s %-22s %s%n", rs.getString(1), rs.getString(2), rs.getString(3));
                    n++;
                }
                if (n == 0) System.out.println("      (表不存在)");
            }
        }
    }
}
