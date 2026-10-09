import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import java.util.regex.*;

/**
 * 实体 ↔ 表结构一致性核验。
 *
 * 从 Java 实体源码解析出 @TableName / @TableId / 字段名（驼峰转下划线），
 * 与 information_schema 里的真实列逐一比对，抓出：
 *   · 实体有字段但表缺列（运行期 Unknown column）
 *   · 表有列但实体无映射（数据读不出来）
 *   · 类型不兼容（如实体 Long 对表 varchar）
 *
 * 用法：java -cp "<driver>" tools/EntityTableCheck.java <实体根目录> [--only 表名]
 */
public class EntityTableCheck {

    static final String URL = "jdbc:mysql://43.138.34.68:3306/ruoyi_zhai"
        + "?useUnicode=true&characterEncoding=utf8&zeroDateTimeBehavior=convertToNull"
        + "&useSSL=true&serverTimezone=GMT%2B8&autoReconnect=true"
        + "&rewriteBatchedStatements=true&allowPublicKeyRetrieval=true"
        + "&nullCatalogMeansCurrent=true";
    static final String USER = "ruoyi_zhai";
    static final String PASS = "BWnSwWmCSAyLtAr4";

    static int pass = 0, fail = 0, warn = 0;

    /**
     * BaseEntity 提供的审计列（实体本类不声明，但表里有，属正常）。
     * 已核对 v6 源码：ruoyi-common-mybatis/.../BaseEntity.java 仅这 5 个字段
     * （createDept / createBy / createTime / updateBy / updateTime）。
     * 注意 del_flag 与 tenant_id 【不在】其中 —— 各实体自行声明，不能豁免。
     */
    static final Set<String> BASE_ENTITY_COLS = new HashSet<>(Arrays.asList(
        "create_dept", "create_by", "create_time", "update_by", "update_time"));

    /** 驼峰转下划线 */
    static String toSnake(String s) {
        return s.replaceAll("([a-z0-9])([A-Z])", "$1_$2").toLowerCase();
    }

    /** 从实体源码解析：表名 + 主键字段 + 普通字段（含类型） */
    static class Entity {
        String table, file;
        String pkField;
        Map<String, String> fields = new LinkedHashMap<>(); // 列名 -> Java 类型
        Map<String, Boolean> existFalse = new HashMap<>();  // @TableField(exist=false)
        Map<String, String> explicitCol = new HashMap<>();  // @TableField("xxx")
    }

    static Entity parse(Path f) throws IOException {
        String txt = new String(Files.readAllBytes(f), StandardCharsets.UTF_8);
        Entity e = new Entity();
        e.file = f.getFileName().toString();

        Matcher tm = Pattern.compile("@TableName\\(\"([^\"]+)\"\\)").matcher(txt);
        if (!tm.find()) return null;
        e.table = tm.group(1);

        // 逐行扫描字段声明
        String cur = txt;
        // 去掉块注释与行注释，避免注释里的字段误判
        cur = cur.replaceAll("(?s)/\\*.*?\\*/", "").replaceAll("//[^\\n]*", "");

        // ⚠ 一个字段上可能挂多个注解（如 @TableField(exist=false) + @ExcelProperty(value="...")），
        //   且注解参数里可能含逗号、括号（如 @ExcelProperty(value = "a", index = 1)）。
        //   正确做法：按行扫描，累积「注解行」，遇到字段声明行时结算，再清空。
        //   早期版本用单条大正则匹配「注解块 + private ...」，会因注解参数内的括号/逗号错位而漏字段。
        StringBuilder annos = new StringBuilder();
        for (String raw : cur.split("\n")) {
            String line = raw.trim();
            if (line.isEmpty()) continue;

            // 累积注解行
            if (line.startsWith("@")) {
                annos.append(line).append(' ');
                continue;
            }

            // 字段声明行
            Matcher dm = Pattern.compile("^(?:public|protected|private)?\\s*(?!static)\\s*([\\w<>\\[\\].]+)\\s+(\\w+)\\s*(?:=[^;]*)?;").matcher(line);
            if (dm.find()) {
                String type = dm.group(1);
                String name = dm.group(2);
                String a = annos.toString();
                annos.setLength(0);

                if (type.equals("class") || type.equals("void")) continue;

                // @TableField(exist = false) → 派生字段，不参与建列
                if (Pattern.compile("@TableField\\s*\\([^)]*exist\\s*=\\s*false").matcher(a).find()
                    || Pattern.compile("@TableField\\s*\\([^)]*exist=false").matcher(a).find()) {
                    e.existFalse.put(name, true);
                    continue;
                }

                // @TableId → 主键
                if (a.contains("@TableId")) {
                    Matcher v = Pattern.compile("@TableId\\s*\\([^)]*value\\s*=\\s*\"([^\"]+)\"").matcher(a);
                    e.pkField = v.find() ? v.group(1) : toSnake(name);
                    e.fields.put(e.pkField, type);
                    continue;
                }

                // @TableField("xxx") 或 @TableField(value = "xxx") 显式列名
                String col = toSnake(name);
                Matcher v = Pattern.compile("@TableField\\s*\\([^)]*value\\s*=\\s*\"([^\"]+)\"").matcher(a);
                if (!v.find()) v = Pattern.compile("@TableField\\s*\\(\\s*\"([^\"]+)\"").matcher(a);
                if (v.find()) col = v.group(1);
                e.explicitCol.put(col, name);
                e.fields.put(col, type);
                continue;
            }

            // 非注解、非字段声明的行（如方法签名、泛型等）→ 清空累积，避免串味
            if (!line.startsWith("//") && !line.startsWith("*")) annos.setLength(0);
        }
        return e;
    }

    /** Java 类型是否与 SQL 类型兼容 */
    static String typeIssue(String javaType, String sqlType) {
        String j = javaType.toLowerCase();
        String s = sqlType.toLowerCase();
        boolean jNum = j.contains("long") || j.contains("integer") || j.contains("int") || j.contains("bigdecimal") || j.contains("double");
        boolean sNum = s.contains("int") || s.contains("decimal") || s.contains("bigint") || s.contains("tinyint");
        if (jNum && !sNum) return "Java " + javaType + " 对 SQL " + sqlType;
        boolean jTxt = j.contains("string");
        boolean sTxt = s.contains("char") || s.contains("text") || s.contains("varchar") || s.contains("json");
        if (jTxt && !sTxt) return "Java " + javaType + " 对 SQL " + sqlType;
        boolean jTime = j.contains("localdatetime") || j.contains("date") || j.contains("time");
        boolean sTime = s.contains("datetime") || s.contains("date") || s.contains("timestamp");
        if (jTime && !sTime) return "Java " + javaType + " 对 SQL " + sqlType;
        return null;
    }

    public static void main(String[] args) throws Exception {
        String root = args.length > 0 ? args[0] : "ruoyi-admin/src/main/java/org/dromara/yuqing/domain";
        String only = null;
        for (int i = 0; i < args.length; i++) if (args[i].equals("--only") && i + 1 < args.length) only = args[i + 1];

        List<Path> files = new ArrayList<>();
        Files.walk(Paths.get(root)).filter(p -> p.toString().endsWith(".java")).forEach(files::add);
        Collections.sort(files);

        List<Entity> entities = new ArrayList<>();
        for (Path p : files) {
            Entity e = parse(p);
            if (e != null && (only == null || e.table.equals(only))) entities.add(e);
        }

        System.out.println("=== 实体 ↔ 表结构一致性核验 ===");
        System.out.println("  实体根目录: " + root);
        System.out.println("  解析到 " + entities.size() + " 个 @TableName 实体");
        System.out.println();

        try (Connection c = DriverManager.getConnection(URL, USER, PASS)) {
            for (Entity e : entities) {
                System.out.println("--- " + e.table + "  (" + e.file + ") ---");

                Map<String, String> sqlCols = new LinkedHashMap<>();
                try (PreparedStatement ps = c.prepareStatement(
                    "select column_name, data_type from information_schema.columns "
                    + "where table_schema='ruoyi_zhai' and table_name=? order by ordinal_position")) {
                    ps.setString(1, e.table);
                    try (ResultSet rs = ps.executeQuery()) {
                        while (rs.next()) sqlCols.put(rs.getString(1), rs.getString(2));
                    }
                }

                if (sqlCols.isEmpty()) {
                    System.out.println("  ✗ 表不存在于库中");
                    fail++;
                    System.out.println();
                    continue;
                }

                // 1. 实体字段 → 表列
                List<String> missing = new ArrayList<>();
                for (Map.Entry<String, String> f : e.fields.entrySet()) {
                    if (!sqlCols.containsKey(f.getKey())) missing.add(f.getKey() + "(" + f.getValue() + ")");
                }
                if (missing.isEmpty()) { pass++; System.out.printf("  ✓ 实体全部 %d 个字段都能在表中找到\n", e.fields.size()); }
                else { fail++; System.out.printf("  ✗ 实体有但表缺列(%d): %s\n", missing.size(), missing); }

                // 2. 类型兼容
                List<String> tIssues = new ArrayList<>();
                for (Map.Entry<String, String> f : e.fields.entrySet()) {
                    String st = sqlCols.get(f.getKey());
                    if (st == null) continue;
                    String iss = typeIssue(f.getValue(), st);
                    if (iss != null) tIssues.add(f.getKey() + ": " + iss);
                }
                if (tIssues.isEmpty()) { pass++; System.out.println("  ✓ 类型全部兼容"); }
                else { warn++; System.out.println("  ! 类型可疑(" + tIssues.size() + "): " + tIssues); }

                // 3. 表有列但实体无映射（需扣除 BaseEntity 继承来的审计列）
                Set<String> mapped = new HashSet<>(e.fields.keySet());
                List<String> unmapped = new ArrayList<>();
                for (String sc : sqlCols.keySet()) {
                    if (mapped.contains(sc)) continue;
                    if (BASE_ENTITY_COLS.contains(sc)) continue; // 父类 BaseEntity 提供
                    unmapped.add(sc);
                }
                if (unmapped.isEmpty()) { pass++; System.out.println("  ✓ 表列全部被实体映射（含 BaseEntity 审计列）"); }
                else { warn++; System.out.printf("  ! 表有但实体未映射(%d): %s\n", unmapped.size(), unmapped); }

                // 4. 派生字段（@TableField(exist=false)）不应出现在表里
                List<String> badDerived = new ArrayList<>();
                for (String k : e.existFalse.keySet()) {
                    String col = toSnake(k);
                    if (sqlCols.containsKey(col)) badDerived.add(col);
                }
                if (badDerived.isEmpty()) { pass++; System.out.println("  ✓ 派生字段(exist=false)未误建列"); }
                else { warn++; System.out.println("  ! 派生字段在表里出现了列: " + badDerived); }

                System.out.println();
            }
        }

        System.out.println("================================================");
        System.out.printf("结果: 通过 %d / 失败 %d / 提示 %d%n", pass, fail, warn);
    }
}
