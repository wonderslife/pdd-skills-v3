package org.dromara.yuqing.analytics.jdbc;

import java.util.Map;

/**
 * {@code selectMaps} 结果取值工具
 *
 * <p>MyBatis 把聚合查询结果放进 {@code Map} 时，键名到底是原样、大写还是带下划线，
 * 取决于驱动与连接参数。写死一个键名，换个环境就 NPE。这里统一做
 * 「先精确匹配、再大小写不敏感匹配」。</p>
 *
 * @author ruoyi
 */
public final class SqlMaps {

    /**
     * 按候选键名取值
     *
     * @param row  一行
     * @param keys 候选键名（按优先级）
     * @return 值；全不命中返回 {@code null}
     */
    public static Object pick(Map<String, Object> row, String... keys) {
        if (row == null || row.isEmpty()) {
            return null;
        }
        for (String k : keys) {
            if (row.containsKey(k)) {
                return row.get(k);
            }
        }
        for (Map.Entry<String, Object> e : row.entrySet()) {
            for (String k : keys) {
                if (k.equalsIgnoreCase(e.getKey())) {
                    return e.getValue();
                }
            }
        }
        return null;
    }

    /**
     * 取值并转 long
     */
    public static long toLong(Object v) {
        if (v == null) {
            return 0L;
        }
        if (v instanceof Number) {
            return ((Number) v).longValue();
        }
        try {
            return Long.parseLong(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    /**
     * 取值并转 int
     */
    public static int toInt(Object v) {
        return (int) Math.min(toLong(v), Integer.MAX_VALUE);
    }

    /**
     * 取值并转 double
     */
    public static double toDouble(Object v) {
        if (v == null) {
            return 0D;
        }
        if (v instanceof Number) {
            return ((Number) v).doubleValue();
        }
        try {
            return Double.parseDouble(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            return 0D;
        }
    }

    /**
     * 取值并转字符串
     */
    public static String toString(Object v) {
        return v == null ? null : String.valueOf(v);
    }

    private SqlMaps() {
    }
}
