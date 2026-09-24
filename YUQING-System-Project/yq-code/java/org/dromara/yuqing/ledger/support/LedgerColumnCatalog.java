package org.dromara.yuqing.ledger.support;

import org.apache.fesod.sheet.annotation.ExcelProperty;
import org.dromara.yuqing.ledger.domain.LedgerRow;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 导出字段目录（F-016 验收标准 5「字段范围可配置」）
 *
 * <p><b>白名单靠反射从 {@link LedgerRow} 自动派生，不手写第二份清单。</b>
 * 手写清单一定会与实体漂移：加了字段忘了加目录 → 新字段永远导不出来，
 * 且没有任何报错。反射派生则天然同步。</p>
 *
 * <p><b>安全：</b>前端传入的 columns 只能取本目录的子集，
 * 非法字段名一律丢弃（而不是报错中断导出）。因此不存在
 * 「构造任意字段名把不该导的列导出去」的越权面；
 * 同时输出列顺序按目录声明顺序固定，
 * 避免用户用 columns 顺序探测内部字段布局。</p>
 *
 * @author ruoyi
 */
public final class LedgerColumnCatalog {

    /** 字段名 -> 中文列名（LinkedHashMap 保序） */
    private static final Map<String, String> CATALOG;

    static {
        Map<String, String> m = new LinkedHashMap<>();
        for (Field f : LedgerRow.class.getDeclaredFields()) {
            ExcelProperty p = f.getAnnotation(ExcelProperty.class);
            if (p != null && p.value() != null && p.value().length > 0) {
                m.put(f.getName(), p.value()[0]);
            }
        }
        CATALOG = Collections.unmodifiableMap(m);
    }

    private LedgerColumnCatalog() {
    }

    /** 全部可导出字段（按声明顺序） */
    public static List<String> allFields() {
        return new ArrayList<>(CATALOG.keySet());
    }

    /** 字段名 -> 中文列名 */
    public static Map<String, String> labels() {
        return CATALOG;
    }

    /** 字段是否在白名单内 */
    public static boolean isExportable(String field) {
        return field != null && CATALOG.containsKey(field);
    }

    /**
     * 把前端请求的列裁剪为合法列。
     *
     * @param requested 请求的字段名（可为 null / 空 -> 返回全量）
     * @return 合法字段名列表，按目录声明顺序（不是请求顺序，防止用顺序做指纹）
     */
    public static List<String> resolve(Collection<String> requested) {
        if (requested == null || requested.isEmpty()) {
            return allFields();
        }
        java.util.Set<String> want = new java.util.HashSet<>();
        for (String r : requested) {
            if (r != null && CATALOG.containsKey(r.trim())) {
                want.add(r.trim());
            }
        }
        if (want.isEmpty()) {
            /* 传了一堆非法字段：回落全量，而不是导出一张只有表头的空表 */
            return allFields();
        }
        List<String> out = new ArrayList<>();
        for (String f : CATALOG.keySet()) {
            if (want.contains(f)) {
                out.add(f);
            }
        }
        return out;
    }
}
