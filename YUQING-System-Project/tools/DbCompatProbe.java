import java.sql.*;

/**
 * MySQL 5.7 兼容性逐项实测：脚本里用到的每个 DDL/DML 写法都真跑一遍。
 * 关键疑问：5.7 无原生 JSON 类型 → JSON 列如何处理。
 * 用法：java -cp "<mysql-driver.jar>" DbCompatProbe.java
 */
public class DbCompatProbe {

    static final String URL = "jdbc:mysql://43.138.34.68:3306/ruoyi_zhai"
        + "?useUnicode=true&characterEncoding=utf8&zeroDateTimeBehavior=convertToNull"
        + "&useSSL=true&serverTimezone=GMT%2B8&autoReconnect=true"
        + "&rewriteBatchedStatements=true&allowPublicKeyRetrieval=true"
        + "&nullCatalogMeansCurrent=true";
    static final String USER = "ruoyi_zhai";
    static final String PASS = "BWnSwWmCSAyLtAr4";

    static int pass = 0, fail = 0;

    static void tryIt(Connection c, String desc, String... sqls) {
        try (Statement st = c.createStatement()) {
            for (String s : sqls) st.execute(s);
            System.out.printf("  ✓ %s%n", desc);
            pass++;
        } catch (Exception e) {
            System.out.printf("  ✗ %s%n      → %s%n", desc, e.getMessage());
            fail++;
        }
    }

    public static void main(String[] args) throws Exception {
        try (Connection c = DriverManager.getConnection(URL, USER, PASS)) {
            try (Statement st = c.createStatement()) {
                st.execute("drop table if exists __p57");
            }

            System.out.println("=== A. 基础类型与约束（脚本实际写法）===");
            tryIt(c, "复合主键(DATE, CHAR(64)) + MEDIUMTEXT + DECIMAL(5,2) 默认值 + CHAR(1) 默认值",
                "drop table if exists __p57",
                "create table __p57 ("
                + " collect_date date not null comment '分区列',"
                + " url_hash char(64) not null comment '哈希',"
                + " opinion_id bigint not null,"
                + " content mediumtext default null,"
                + " opinion_url varchar(1000) not null,"
                + " negative_rate decimal(5,2) default null,"
                + " burst_ratio decimal(5,2) default '3.00',"
                + " del_flag char(1) default '0',"
                + " create_time datetime default null,"
                + " primary key (collect_date, url_hash),"
                + " key idx_p57_oid (opinion_id)"
                + ") engine=innodb default charset=utf8mb4 comment='兼容探测'");

            System.out.println();
            System.out.println("=== B. JSON 列 —— 5.7 的关键疑问 ===");
            tryIt(c, "原生 JSON 列类型（脚本 yq_level_rule.level_ranges 用的写法）",
                "drop table if exists __p57j",
                "create table __p57j (id bigint not null, payload json not null, primary key(id)) engine=innodb default charset=utf8mb4");

            tryIt(c, "JSON 列替代写法：LONGTEXT（语义等价，5.7 原生支持）",
                "drop table if exists __p57j2",
                "create table __p57j2 (id bigint not null, payload longtext not null comment 'JSON 文本', primary key(id)) engine=innodb default charset=utf8mb4",
                "insert into __p57j2(id,payload) values (1,'{\"levels\":[{\"name\":\"一般\",\"min\":0,\"max\":40}]}')");

            System.out.println();
            System.out.println("=== C. 各表收尾写法与索引 ===");
            tryIt(c, "utf8mb4 无 COLLATE 收尾（继承库默认 utf8mb4_general_ci）",
                "drop table if exists __p57c",
                "create table __p57c (id bigint not null, primary key(id)) engine=innodb default charset=utf8mb4 comment='字符集继承探测'");

            tryIt(c, "唯一键 + 前缀索引 + 多列普通索引",
                "drop table if exists __p57i",
                "create table __p57i ("
                + " task_id bigint not null,"
                + " task_name varchar(100) not null,"
                + " status char(1) default '0',"
                + " start_time datetime not null,"
                + " rule_id bigint default null,"
                + " primary key (task_id),"
                + " unique key uk_p57_name (task_name),"
                + " key idx_p57_st (status, start_time),"
                + " key idx_p57_rule (rule_id)"
                + ") engine=innodb default charset=utf8mb4");

            System.out.println();
            System.out.println("=== D. 脚本 DML 写法 ===");
            tryIt(c, "SET NAMES utf8mb4 / SET FOREIGN_KEY_CHECKS",
                "set names utf8mb4",
                "set foreign_key_checks = 0",
                "set foreign_key_checks = 1");

            tryIt(c, "INSERT ... 22 值（sys_menu 写法）+ sysdate()",
                "drop table if exists __p57m",
                "create table __p57m (a bigint, b varchar(50), c bigint, d int, e varchar(50), f varchar(100),"
                + " g varchar(100), h char(1), i char(1), j char(1), k char(1), l char(1), m varchar(100),"
                + " n varchar(50), o varchar(100), p varchar(100), q bigint, r bigint, s datetime,"
                + " t bigint, u datetime, v varchar(500)) engine=innodb default charset=utf8mb4",
                "insert into __p57m values (1761400000000000999, '冒烟菜单', 0, 1, 'smoke', null, '', 'N', 'Y', 'M', '0', '0', '', 'monitor', null, null,"
                + " 1761000000000000103, 1761100000000000001, sysdate(), null, null, '兼容探测')");

            tryIt(c, "DELETE ... BETWEEN 号段（菜单幂等清理写法）",
                "delete from __p57m where a between 1761400000000000900 and 1761400000000000912");

            tryIt(c, "INSERT ... SELECT CROSS JOIN（角色授权写法）",
                "insert into __p57m (a,b) select 1, 'x' from dual where not exists (select 1 from __p57m where a = 1)");

            System.out.println();
            System.out.println("=== E. 中文/emoji 存储（utf8mb4 四字节）===");
            tryIt(c, "中文 + emoji 落库（舆情正文需要）",
                "drop table if exists __p57u",
                "create table __p57u (id bigint not null, txt varchar(200) default null, primary key(id)) engine=innodb default charset=utf8mb4",
                "insert into __p57u values (1, '舆情监测：测试内容 🔥 加粗【标题】')");

            System.out.println();
            System.out.println("=== F. 清理探测表 ===");
            try (Statement st = c.createStatement()) {
                for (String t : new String[]{"__p57", "__p57j", "__p57j2", "__p57c", "__p57i", "__p57m", "__p57u"}) {
                    try { st.execute("drop table if exists " + t); System.out.println("  ✓ 已清理 " + t); }
                    catch (Exception e) { System.out.println("  ! 清理失败 " + t + ": " + e.getMessage()); }
                }
            }

            System.out.println();
            System.out.println("========================================");
            System.out.printf("结果: 通过 %d / 失败 %d%n", pass, fail);
        }
    }
}
