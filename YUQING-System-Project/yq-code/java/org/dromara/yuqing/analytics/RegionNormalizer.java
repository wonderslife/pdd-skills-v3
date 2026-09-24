package org.dromara.yuqing.analytics;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 发布地域归一化
 *
 * <p>采集侧地域是自由文本：「北京」「北京市」「 北京市 」「京」「内蒙」「内蒙古」
 * 都可能出现，直接 GROUP BY 会把一个地域拆成四五条。本类把它收敛到
 * <b>34 个省级行政区</b> + 三个兜底桶。</p>
 *
 * <p>兜底桶刻意分成三个而不是一个，是为了让运维一眼看出数据质量：
 * <ul>
 *   <li>{@link #UNKNOWN} 采集侧没给地域 —— 要补采集项</li>
 *   <li>{@link #OVERSEAS} 境外来源 —— 业务上可单独看</li>
 *   <li>{@link #OTHER} 给了值但没识别出来 —— 要补别名表</li>
 * </ul>
 * 合成一个桶就再也分不清是哪种问题了。</p>
 *
 * @author ruoyi
 */
public final class RegionNormalizer {

    /** 未填写 */
    public static final String UNKNOWN = "未知";

    /** 境外 */
    public static final String OVERSEAS = "海外";

    /** 未识别 */
    public static final String OTHER = "其他";

    private static final List<String> PROVINCES = List.of(
        "北京市", "天津市", "上海市", "重庆市",
        "河北省", "山西省", "辽宁省", "吉林省", "黑龙江省", "江苏省", "浙江省", "安徽省",
        "福建省", "江西省", "山东省", "河南省", "湖北省", "湖南省", "广东省", "海南省",
        "四川省", "贵州省", "云南省", "陕西省", "甘肃省", "青海省", "台湾省",
        "内蒙古自治区", "广西壮族自治区", "西藏自治区", "宁夏回族自治区", "新疆维吾尔自治区",
        "香港特别行政区", "澳门特别行政区");

    private static final String[] SUFFIXES = {
        "特别行政区", "维吾尔自治区", "回族自治区", "壮族自治区", "自治区", "省", "市"};

    private static final String[] OVERSEAS_WORDS = {
        "海外", "境外", "国外", "国际", "美国", "加拿大", "英国", "法国", "德国", "意大利",
        "西班牙", "荷兰", "瑞士", "瑞典", "俄罗斯", "乌克兰", "日本", "韩国", "朝鲜",
        "印度", "新加坡", "马来西亚", "泰国", "越南", "菲律宾", "印度尼西亚", "澳大利亚",
        "新西兰", "巴西", "阿根廷", "南非", "埃及", "土耳其", "以色列", "沙特", "阿联酋"};

    /** 别名 -> 省级全称 */
    private static final Map<String, String> ALIAS = new LinkedHashMap<>();

    static {
        for (String p : PROVINCES) {
            ALIAS.put(p, p);
            String shortName = stripSuffix(p);
            ALIAS.put(shortName, p);
        }
        // 简称（车牌首字 / 常用简称）
        ALIAS.put("京", "北京市");
        ALIAS.put("津", "天津市");
        ALIAS.put("沪", "上海市");
        ALIAS.put("渝", "重庆市");
        ALIAS.put("冀", "河北省");
        ALIAS.put("晋", "山西省");
        ALIAS.put("辽", "辽宁省");
        ALIAS.put("吉", "吉林省");
        ALIAS.put("黑", "黑龙江省");
        ALIAS.put("苏", "江苏省");
        ALIAS.put("浙", "浙江省");
        ALIAS.put("皖", "安徽省");
        ALIAS.put("闽", "福建省");
        ALIAS.put("赣", "江西省");
        ALIAS.put("鲁", "山东省");
        ALIAS.put("豫", "河南省");
        ALIAS.put("鄂", "湖北省");
        ALIAS.put("湘", "湖南省");
        ALIAS.put("粤", "广东省");
        ALIAS.put("琼", "海南省");
        ALIAS.put("川", "四川省");
        ALIAS.put("蜀", "四川省");
        ALIAS.put("贵", "贵州省");
        ALIAS.put("黔", "贵州省");
        ALIAS.put("云", "云南省");
        ALIAS.put("滇", "云南省");
        ALIAS.put("陕", "陕西省");
        ALIAS.put("秦", "陕西省");
        ALIAS.put("甘", "甘肃省");
        ALIAS.put("陇", "甘肃省");
        ALIAS.put("青", "青海省");
        ALIAS.put("台", "台湾省");
        ALIAS.put("内蒙古", "内蒙古自治区");
        ALIAS.put("广西", "广西壮族自治区");
        ALIAS.put("西藏", "西藏自治区");
        ALIAS.put("宁夏", "宁夏回族自治区");
        ALIAS.put("新疆", "新疆维吾尔自治区");
        ALIAS.put("香港", "香港特别行政区");
        ALIAS.put("港", "香港特别行政区");
        ALIAS.put("澳门", "澳门特别行政区");
        ALIAS.put("澳", "澳门特别行政区");
    }

    /**
     * 归一化一个地域文本
     *
     * @param raw 原始地域文本
     * @return 省级全称，或 未知 / 海外 / 其他
     */
    public static String normalize(String raw) {
        if (raw == null || raw.isBlank()) {
            return UNKNOWN;
        }
        String cleaned = clean(raw);
        if (cleaned.isEmpty()) {
            return UNKNOWN;
        }
        String hit = ALIAS.get(cleaned);
        if (hit != null) {
            return hit;
        }
        String stripped = stripSuffix(cleaned);
        if (!stripped.isEmpty()) {
            hit = ALIAS.get(stripped);
            if (hit != null) {
                return hit;
            }
        }
        // 「北京市海淀区」这类带下级行政区的文本：按前缀最长匹配
        String prefix = longestPrefix(cleaned);
        if (prefix != null) {
            return prefix;
        }
        for (String w : OVERSEAS_WORDS) {
            if (cleaned.contains(w)) {
                return OVERSEAS;
            }
        }
        return OTHER;
    }

    /** 是否属于省级行政区（供测试与看板「本级地域」口径使用） */
    public static boolean isProvince(String v) {
        return v != null && PROVINCES.contains(v);
    }

    /** 省级行政区清单（含港澳台） */
    public static List<String> provinces() {
        return new ArrayList<>(PROVINCES);
    }

    /**
     * 取用于 SQL 模糊匹配的核心词
     *
     * <p>{@code 北京市} -> {@code 北京}，{@code 内蒙古自治区} -> {@code 内蒙古}。
     * JDBC 层用 {@code INSTR(region, ?) > 0} 而不是 LIKE，避免 {@code %} / {@code _}
     * 需要转义带来的注入面。</p>
     */
    public static String matchToken(String normalized) {
        if (normalized == null || normalized.isBlank()) {
            return "";
        }
        if (UNKNOWN.equals(normalized) || OVERSEAS.equals(normalized) || OTHER.equals(normalized)) {
            return "";
        }
        return stripSuffix(normalized);
    }

    private static String clean(String raw) {
        StringBuilder sb = new StringBuilder(raw.length());
        for (int i = 0; i < raw.length(); i++) {
            char c = raw.charAt(i);
            if (Character.isWhitespace(c) || c == 0x3000 || c == 0x00A0) {
                continue;
            }
            sb.append(c);
        }
        return sb.toString();
    }

    private static String stripSuffix(String s) {
        String out = s;
        boolean changed = true;
        while (changed) {
            changed = false;
            for (String suf : SUFFIXES) {
                if (out.length() > suf.length() && out.endsWith(suf)) {
                    out = out.substring(0, out.length() - suf.length());
                    changed = true;
                }
            }
        }
        return out;
    }

    private static String longestPrefix(String s) {
        String best = null;
        for (Map.Entry<String, String> e : ALIAS.entrySet()) {
            String key = e.getKey();
            if (s.startsWith(key) && (best == null || key.length() > best.length())) {
                best = key;
            }
        }
        return best == null ? null : ALIAS.get(best);
    }

    /** 供自测断言别名表规模用 */
    public static Map<String, String> aliasSnapshot() {
        return new HashMap<>(ALIAS);
    }

    private RegionNormalizer() {
    }
}
