import java.io.*;
import java.sql.*;
import java.text.SimpleDateFormat;
import java.util.*;

/**
 * 建表前备份：把 sys_menu / sys_role_menu / sys_dict_type / sys_dict_data 导出为可回滚 SQL。
 * 输出到 tools/backup/ 目录，文件名带时间戳。
 * 用法：java -cp "<mysql-driver.jar>" DbBackup.java
 */
public class DbBackup {

    static final String URL = "jdbc:mysql://43.138.34.68:3306/ruoyi_zhai"
        + "?useUnicode=true&characterEncoding=utf8&zeroDateTimeBehavior=convertToNull"
        + "&useSSL=true&serverTimezone=GMT%2B8&autoReconnect=true"
        + "&rewriteBatchedStatements=true&allowPublicKeyRetrieval=true"
        + "&nullCatalogMeansCurrent=true";
    static final String USER = "ruoyi_zhai";
    static final String PASS = "BWnSwWmCSAyLtAr4";

    /** 需要备份的表（建表脚本会触碰的全部对象） */
    static final String[] TABLES = {"sys_menu", "sys_role_menu", "sys_dict_type", "sys_dict_data"};

    /** 转义为 SQL 字面量 */
    static String lit(String v) {
        if (v == null) return "NULL";
        return "'" + v.replace("\\", "\\\\").replace("'", "\\'").replace("\r", "\\r").replace("\n", "\\n") + "'";
    }

    public static void main(String[] args) throws Exception {
        String stamp = new SimpleDateFormat("yyyyMMdd-HHmmss").format(new java.util.Date());
        File dir = new File("backup");
        if (!dir.exists()) dir.mkdirs();
        File out = new File(dir, "pre-yq-build-" + stamp + ".sql");

        long totalRows = 0;
        try (Connection c = DriverManager.getConnection(URL, USER, PASS);
             PrintWriter w = new PrintWriter(new OutputStreamWriter(
                 new FileOutputStream(out), java.nio.charset.StandardCharsets.UTF_8))) {

            w.println("-- ============================================================");
            w.println("-- 舆情平台建表前备份（回滚用）");
            w.println("-- 目标库: 43.138.34.68:3306/ruoyi_zhai");
            w.println("-- 备份时间: " + stamp);
            w.println("-- 覆盖表: " + String.join(", ", TABLES));
            w.println("-- 回滚方式: 直接执行本文件（含 DELETE + INSERT，可重复执行）");
            w.println("-- ============================================================");
            w.println("SET NAMES utf8mb4;");
            w.println("SET FOREIGN_KEY_CHECKS = 0;");
            w.println();

            for (String t : TABLES) {
                // 取列名（排除生成列）
                List<String> cols = new ArrayList<>();
                try (Statement st = c.createStatement();
                     ResultSet rs = st.executeQuery(
                         "select column_name from information_schema.columns "
                         + "where table_schema='ruoyi_zhai' and table_name='" + t + "' order by ordinal_position")) {
                    while (rs.next()) cols.add(rs.getString(1));
                }

                w.println("-- ---------- " + t + " (" + cols.size() + " 列) ----------");
                w.println("DELETE FROM `" + t + "`;");

                StringBuilder base = new StringBuilder("INSERT INTO `" + t + "` (");
                for (int i = 0; i < cols.size(); i++) {
                    if (i > 0) base.append(", ");
                    base.append("`").append(cols.get(i)).append("`");
                }
                base.append(") VALUES ");

                int n = 0;
                int batch = 0;
                StringBuilder sb = new StringBuilder(base);
                try (Statement st = c.createStatement();
                     ResultSet rs = st.executeQuery("select * from `" + t + "`")) {
                    while (rs.next()) {
                        if (batch > 0) sb.append(",\n  ");
                        sb.append("(");
                        for (int i = 0; i < cols.size(); i++) {
                            if (i > 0) sb.append(", ");
                            sb.append(lit(rs.getString(cols.get(i))));
                        }
                        sb.append(")");
                        batch++;
                        n++;
                        if (batch >= 50) {
                            w.println(sb.append(";").toString());
                            sb = new StringBuilder(base);
                            batch = 0;
                        }
                    }
                }
                if (batch > 0) w.println(sb.append(";").toString());
                w.println("-- " + t + ": " + n + " 行");
                w.println();
                totalRows += n;
                System.out.printf("  ✓ %-18s %4d 行%n", t, n);
            }

            w.println("SET FOREIGN_KEY_CHECKS = 1;");
            w.println("-- 备份完成，共 " + totalRows + " 行");
        }

        System.out.println();
        System.out.println("=== 备份完成 ===");
        System.out.println("  文件: " + out.getAbsolutePath());
        System.out.printf("  大小: %.1f KB%n", out.length() / 1024.0);
        System.out.println("  行数: " + totalRows);
    }
}
