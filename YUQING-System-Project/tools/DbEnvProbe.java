import java.sql.*;
import java.util.*;

/**
 * 建表前环境探测：字符集 / 排序规则 / SQL_MODE / 现有 sys_* 表结构对齐 / 版本特性支持。
 * 用途：确认 yq_*.sql 脚本在目标库（MySQL 5.7.40）上可原样执行，无需改写。
 * 用法：java -cp "<mysql-driver.jar>" DbEnvProbe.java
 */
public class DbEnvProbe {

    static final String URL = "jdbc:mysql://43.138.34.68:3306/ruoyi_zhai"
        + "?useUnicode=true&characterEncoding=utf8&zeroDateTimeBehavior=convertToNull"
        + "&useSSL=true&serverTimezone=GMT%2B8&autoReconnect=true"
        + "&rewriteBatchedStatements=true&allowPublicKeyRetrieval=true"
        + "&nullCatalogMeansCurrent=true";
    static final String USER = "ruoyi_zhai";
    static final String PASS = "BWnSwWmCSAyLtAr4";

    static void q(Connection c, String label, String sql) {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            StringBuilder sb = new StringBuilder();
            int n = rs.getMetaData().getColumnCount();
            while (rs.next()) {
                for (int i = 1; i <= n; i++) {
                    if (i > 1) sb.append(" | ");
                    sb.append(rs.getString(i));
                }
                sb.append("  ;;  ");
            }
            System.out.printf("  %-34s %s%n", label, sb.length() == 0 ? "(空)" : sb.toString());
        } catch (Exception e) {
            System.out.printf("  %-34s [ERR] %s%n", label, e.getMessage());
        }
    }

    public static void main(String[] args) throws Exception {
        try (Connection c = DriverManager.getConnection(URL, USER, PASS)) {
            DatabaseMetaData md = c.getMetaData();
            System.out.println("=== 服务端 ===");
            System.out.println("  " + md.getDatabaseProductName() + " " + md.getDatabaseProductVersion());
            System.out.println();

            System.out.println("=== 连接/库级变量（决定建表能否原样执行）===");
            q(c, "character_set_database", "select @@character_set_database");
            q(c, "collation_database", "select @@collation_database");
            q(c, "character_set_server", "select @@character_set_server");
            q(c, "collation_server", "select @@collation_server");
            q(c, "sql_mode", "select @@sql_mode");
            q(c, "innodb_default_row_format", "select @@innodb_default_row_format");
            q(c, "lower_case_table_names", "select @@lower_case_table_names");
            q(c, "version_compile_os", "select @@version_compile_os");
            System.out.println();

            System.out.println("=== 能力探测（决定脚本是否需要改写）===");
            q(c, "utf8mb4 是否支持", "select count(1) from information_schema.collations where collation_name like 'utf8mb4%'");
            q(c, "utf8mb4_general_ci 存在", "select count(1) from information_schema.collations where collation_name='utf8mb4_general_ci'");
            q(c, "utf8mb4_0900_ai_ci 存在(8.0专有)", "select count(1) from information_schema.collations where collation_name='utf8mb4_0900_ai_ci'");
            q(c, "JSON 列类型可用", "select count(1) from information_schema.columns where table_schema='ruoyi_zhai' and data_type='json'");
            q(c, "ROW_NUMBER 窗口函数", "select count(1) from (select row_number() over (order by 1) rn from dual) t");
            q(c, "InnoDB 大前缀索引(3072)", "select @@innodb_large_prefix");
            q(c, "max_allowed_packet(MB)", "select round(@@max_allowed_packet/1024/1024)");
            System.out.println();

            System.out.println("=== 现有若依表字符集实测（新表需对齐）===");
            q(c, "sys_menu 建表口径", "select ENGINE, TABLE_COLLATION, TABLE_ROWS from information_schema.tables where table_schema='ruoyi_zhai' and table_name='sys_menu'");
            q(c, "sys_dict_data 建表口径", "select ENGINE, TABLE_COLLATION from information_schema.tables where table_schema='ruoyi_zhai' and table_name='sys_dict_data'");
            q(c, "现有各字符集表数分布", "select TABLE_COLLATION, count(1) c from information_schema.tables where table_schema='ruoyi_zhai' group by TABLE_COLLATION order by c desc");
            System.out.println();

            System.out.println("=== sys_menu 实际列序（写菜单 SQL 的权威依据）===");
            q(c, "sys_menu 列序",
                "select group_concat(column_name order by ordinal_position separator ', ') from information_schema.columns where table_schema='ruoyi_zhai' and table_name='sys_menu'");
            q(c, "sys_menu 列数",
                "select count(1) from information_schema.columns where table_schema='ruoyi_zhai' and table_name='sys_menu'");
            System.out.println();

            System.out.println("=== 菜单号段冲突检查（本模块 1761400000000000900 ~ ...9139）===");
            q(c, "号段内已有节点数",
                "select count(1) from sys_menu where menu_id between 1761400000000000900 and 1761400000000006139");
            q(c, "全库菜单总数", "select count(1) from sys_menu");
            q(c, "最大 menu_id", "select max(menu_id) from sys_menu");
            System.out.println();

            System.out.println("=== 字典号段冲突检查（1770000000000001000 ~ 1770000000000002999）===");
            q(c, "号段内已有 dict_type", "select count(1) from sys_dict_type where dict_id between 1770000000000001000 and 1770000000000001999");
            q(c, "号段内已有 dict_data", "select count(1) from sys_dict_data where dict_code between 1770000000000002000 and 1770000000000002999");
            q(c, "yq_ 字典类型残留", "select count(1) from sys_dict_type where dict_type like 'yq\\_%'");
            System.out.println();

            System.out.println("=== 关键：脚本里要用的写法逐项验证 ===");
            try (Statement st = c.createStatement()) {
                st.execute("drop table if exists __probe_compat");
                st.execute("create table __probe_compat ("
                    + " id bigint not null comment '主键',"
                    + " d date not null comment '日期',"
                    + " u char(64) not null comment '哈希',"
                    + " j json not null comment 'JSON列',"
                    + " t mediumtext default null,"
                    + " v varchar(1000) default null,"
                    + " dec decimal(5,2) default '3.00',"
                    + " s char(1) default '0',"
                    + " primary key (d, u),"
                    + " key idx_p (id)"
                    + ") engine=innodb default charset=utf8mb4 comment='兼容性探测'");
                System.out.println("  ✓ 复合主键(date,char64) + JSON + MEDIUMTEXT + DECIMAL默认值 全部可建");

                st.execute("insert into __probe_compat(id,d,u,j,dec) values (1,'2026-01-01','a',JSON_OBJECT('k','v'),'3.00')");
                try (ResultSet rs = st.executeQuery("select j->>'$.k' from __probe_compat")) {
                    rs.next();
                    System.out.println("  ✓ JSON 存储与 ->> 取值正常: " + rs.getString(1));
                }
                long q1 = System.nanoTime();
                st.execute("select 1 from __probe_compat where `d` >= '2026-01-01' and `u` = 'a'");
                System.out.println("  ✓ 反引号限定列名查询正常 (" + (System.nanoTime() - q1) / 1000000 + "ms)");
                st.execute("insert into __probe_compat(id,d,u,j,dec) values (1,'2026-01-01','a',JSON_OBJECT('k','v2'),'1.00') "
                    + "on duplicate key update j = values(j)");
                try (ResultSet rs = st.executeQuery("select j->>'$.k' from __probe_compat")) {
                    rs.next();
                    System.out.println("  ✓ INSERT ... ON DUPLICATE KEY UPDATE + values() 语法正常: " + rs.getString(1));
                }
                st.execute("drop table if exists __probe_compat");
                System.out.println("  ✓ 探测表已清理");
            } catch (Exception e) {
                System.out.println("  ✗ 兼容性探测失败: " + e.getMessage());
            }
        }
    }
}
