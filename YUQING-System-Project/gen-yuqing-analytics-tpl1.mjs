/**
 * F-009 多维分析 · 第 1 片：纯计算内核
 *
 * 设计要点：
 *   1. 本片所有类**不依赖 Spring / 数据库**，只依赖 lombok 与 JDK —— 因此可以离线自测；
 *   2. 聚合、归一、分桶、排序全部是确定性纯函数，同样的输入必然得到同样的输出
 *      （排序 tie-break 显式写出，不依赖集合遍历顺序）；
 *   3. 所有涉及「值 -> 条件」的映射都返回结构化条件对象，由 JDBC 层负责参数化执行，
 *      计算层永远不拼 SQL。
 */
export const ANALYTICS_TPL = [

  /* ==================================================================== 切片 */
  {
    rel: 'analytics/OpinionSlice.java',
    content: `package org.dromara.yuqing.analytics;

import lombok.Builder;
import lombok.Data;
import org.dromara.yuqing.domain.YqOpinion;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 待聚合的舆情切片
 *
 * <p>为什么不直接把 {@link YqOpinion} 拖进聚合器：
 * 一是明细表带 {@code content} 大字段，几十万行会直接把堆打满；
 * 二是离线自测需要能手搓样本，投影对象比实体好构造。</p>
 *
 * <p>本类为不可变语义的投影（只读使用），不承载任何业务判定逻辑。</p>
 *
 * @author ruoyi
 */
@Data
@Builder
public class OpinionSlice {

    /** 舆情ID */
    private Long opinionId;

    /** 采集日（分区列，所有按日指标归属此列） */
    private LocalDate collectDate;

    /** 任务ID（0=未归属） */
    private Long taskId;

    /** 渠道ID（0=未归属） */
    private Long channelId;

    /** 渠道名称（可能为空，由 Service 用主库回填） */
    private String channelName;

    /** 标题 */
    private String title;

    /** 原文链接 */
    private String opinionUrl;

    /** 发布时间（趋势曲线的默认归属列） */
    private LocalDateTime publishTime;

    /** 采集时间（发布时间缺失时的兜底归属列） */
    private LocalDateTime collectTime;

    /** 阅读量 */
    private Long readCount;

    /** 评论量 */
    private Long commentCount;

    /** 转发量 */
    private Long shareCount;

    /** 点赞量 */
    private Long likeCount;

    /** 发布地域（自由文本，需归一） */
    private String region;

    /** 话题标签（逗号分隔） */
    private String topicTags;

    /** 内容热度分值 */
    private Integer heatScore;

    /** 舆情属性 positive / neutral / negative */
    private String sentiAttr;

    /** 舆情分级 normal / attention / warning / urgent */
    private String opinionLevel;

    /** 风险等级 general / moderate / severe */
    private String riskLevel;

    /** 传播量级 low / medium / high / viral */
    private String spreadLevel;

    /** 事件聚合ID（0=未聚合） */
    private Long clusterId;

    /**
     * 从明细实体投影
     *
     * @param o 明细实体
     * @return 切片；入参为空时返回 {@code null}
     */
    public static OpinionSlice from(YqOpinion o) {
        if (o == null) {
            return null;
        }
        return OpinionSlice.builder()
            .opinionId(o.getOpinionId())
            .collectDate(o.getCollectDate())
            .taskId(zero(o.getTaskId()))
            .channelId(zero(o.getChannelId()))
            .channelName(o.getChannelName())
            .title(o.getTitle())
            .opinionUrl(o.getOpinionUrl())
            .publishTime(o.getPublishTime())
            .collectTime(o.getCollectTime())
            .readCount(o.getReadCount())
            .commentCount(o.getCommentCount())
            .shareCount(o.getShareCount())
            .likeCount(o.getLikeCount())
            .region(o.getRegion())
            .topicTags(o.getTopicTags())
            .heatScore(o.getHeatScore())
            .sentiAttr(o.getSentiAttr())
            .opinionLevel(o.getOpinionLevel())
            .riskLevel(o.getRiskLevel())
            .spreadLevel(o.getSpreadLevel())
            .clusterId(zero(o.getClusterId()))
            .build();
    }

    /**
     * 趋势归属时间：优先发布时间，为空则回落采集时间
     *
     * <p>这是派生取值（没有同名字段），命名成 getter 是为了让调用方写法统一；
     * 两者都为空说明该条记录时间信息缺失，只能计入总量、不进趋势曲线（不造假时间）。</p>
     */
    public LocalDateTime getTrendTime() {
        return publishTime != null ? publishTime : collectTime;
    }

    private static Long zero(Long v) {
        return v == null ? 0L : v;
    }
}
`,
  },

  /* ================================================================ 枚举与标签 */
  {
    rel: 'analytics/StatsGrain.java',
    content: `package org.dromara.yuqing.analytics;

/**
 * 趋势曲线时间粒度（F-009 验收标准 4）
 *
 * <p>三种粒度在**聚合阶段就已物化**（{@code yq_stats_dim.time_grain}），
 * 看板切换粒度只是换一个等值条件，查询成本恒定，不会退化成实时 GROUP BY。</p>
 *
 * @author ruoyi
 */
public enum StatsGrain {

    /** 小时 */
    HOUR("hour", "小时"),

    /** 日 */
    DAY("day", "日"),

    /** 周（ISO 周，周一为一周起点） */
    WEEK("week", "周");

    private final String code;

    private final String label;

    StatsGrain(String code, String label) {
        this.code = code;
        this.label = label;
    }

    public String getCode() {
        return code;
    }

    public String getLabel() {
        return label;
    }

    /**
     * 宽松解析：非法值回落 {@link #DAY}
     *
     * <p>看板不应因为前端传了错粒度就 500，回落并继续出图更符合运维预期。</p>
     */
    public static StatsGrain of(String v) {
        if (v == null || v.isBlank()) {
            return DAY;
        }
        String s = v.trim().toLowerCase();
        for (StatsGrain g : values()) {
            if (g.code.equals(s)) {
                return g;
            }
        }
        return DAY;
    }
}
`,
  },
  {
    rel: 'analytics/DimType.java',
    content: `package org.dromara.yuqing.analytics;

import java.util.List;

/**
 * 维度类型
 *
 * <p>前七个是 F-009 验收标准 1 要求展示的「分布类」指标；
 * {@link #TREND} 是第八个——它不是分布，而是**趋势曲线的载体**：
 * 把时间桶也塞进同一张长表，趋势与分布共用一套读写路径，
 * 少一张表、少一套代码，且天然享受同一个 Unique Key 幂等语义。</p>
 *
 * @author ruoyi
 */
public enum DimType {

    /** 平台（渠道）分布 */
    CHANNEL("channel", "平台分布"),

    /** 地域分布 */
    REGION("region", "地域分布"),

    /** 话题分布 */
    TOPIC("topic", "话题分布"),

    /** 舆情属性分布（正/中/负） */
    SENTI("senti", "舆情属性分布"),

    /** 风险等级分布 */
    RISK("risk", "风险等级分布"),

    /** 舆情分级分布 */
    LEVEL("level", "舆情分级分布"),

    /** 传播量级分布 */
    SPREAD("spread", "传播量级分布"),

    /** 传播趋势（dim_key 为时间桶标识，按 time_grain 区分小时/日/周） */
    TREND("trend", "传播趋势");

    private final String code;

    private final String label;

    DimType(String code, String label) {
        this.code = code;
        this.label = label;
    }

    public String getCode() {
        return code;
    }

    public String getLabel() {
        return label;
    }

    /** 七个分布类维度（看板卡片，不含趋势） */
    public static List<DimType> distributions() {
        return List.of(CHANNEL, REGION, TOPIC, SENTI, RISK, LEVEL, SPREAD);
    }

    /** 宽松解析，未知值返回 {@code null}（调用方据此判 400，不做静默兜底到某个维度） */
    public static DimType of(String v) {
        if (v == null || v.isBlank()) {
            return null;
        }
        String s = v.trim().toLowerCase();
        for (DimType t : values()) {
            if (t.code.equals(s)) {
                return t;
            }
        }
        return null;
    }
}
`,
  },
  {
    rel: 'analytics/RankBy.java',
    content: `package org.dromara.yuqing.analytics;

/**
 * 热点排行排序口径（F-009 验收标准 3）
 *
 * @author ruoyi
 */
public enum RankBy {

    /** 阅读量 */
    READ("read", "阅读量"),

    /** 转发量 */
    SHARE("share", "转发量"),

    /** 评论量 */
    COMMENT("comment", "评论量"),

    /** 综合热度 */
    HEAT("heat", "综合热度");

    private final String code;

    private final String label;

    RankBy(String code, String label) {
        this.code = code;
        this.label = label;
    }

    public String getCode() {
        return code;
    }

    public String getLabel() {
        return label;
    }

    /** 宽松解析，非法值回落 {@link #HEAT}（默认按综合热度，业务上最常用） */
    public static RankBy of(String v) {
        if (v == null || v.isBlank()) {
            return HEAT;
        }
        String s = v.trim().toLowerCase();
        for (RankBy r : values()) {
            if (r.code.equals(s)) {
                return r;
            }
        }
        return HEAT;
    }
}
`,
  },
  {
    rel: 'analytics/DimLabels.java',
    content: `package org.dromara.yuqing.analytics;

import java.util.Map;

/**
 * 维度取值的中文展示名
 *
 * <p>取值来自 {@code yq_dict.sql} 的四个字典（yq_senti_attr / yq_risk_level /
 * yq_opinion_level / yq_spread_level）。这里做一份引擎内映射，原因是
 * **聚合任务跑在定时线程里，拿不到 HttpServletRequest，也就读不到字典缓存**；
 * 若只在查询期翻译，预聚合表的 dim_label 就得每次 join 字典，不划算。</p>
 *
 * <p>未知取值原样返回，不吞成「其他」—— 看到英文原值才知道是脏数据。</p>
 *
 * @author ruoyi
 */
public final class DimLabels {

    private static final Map<String, String> SENTI = Map.of(
        "positive", "正面",
        "neutral", "中性",
        "negative", "负面");

    private static final Map<String, String> RISK = Map.of(
        "general", "一般",
        "moderate", "较重",
        "severe", "严重");

    private static final Map<String, String> LEVEL = Map.of(
        "normal", "一般",
        "attention", "关注",
        "warning", "预警",
        "urgent", "紧急");

    private static final Map<String, String> SPREAD = Map.of(
        "low", "低",
        "medium", "中",
        "high", "高",
        "viral", "爆");

    /** 舆情属性中文名 */
    public static String senti(String code) {
        return pick(SENTI, code);
    }

    /** 风险等级中文名 */
    public static String risk(String code) {
        return pick(RISK, code);
    }

    /** 舆情分级中文名 */
    public static String level(String code) {
        return pick(LEVEL, code);
    }

    /** 传播量级中文名 */
    public static String spread(String code) {
        return pick(SPREAD, code);
    }

    /** 按维度类型翻译取值 */
    public static String of(DimType type, String code) {
        if (type == null || code == null) {
            return code;
        }
        switch (type) {
            case SENTI:
                return senti(code);
            case RISK:
                return risk(code);
            case LEVEL:
                return level(code);
            case SPREAD:
                return spread(code);
            default:
                return code;
        }
    }

    private static String pick(Map<String, String> m, String code) {
        if (code == null || code.isBlank()) {
            return "未标注";
        }
        String hit = m.get(code);
        return hit == null ? code : hit;
    }

    private DimLabels() {
    }
}
`,
  },

  /* ================================================================== 归一化 */
  {
    rel: 'analytics/RegionNormalizer.java',
    content: `package org.dromara.yuqing.analytics;

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
`,
  },
  {
    rel: 'analytics/TopicSplitter.java',
    content: `package org.dromara.yuqing.analytics;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 话题标签拆解
 *
 * <p>采集侧的 {@code topic_tags} 是「逗号分隔」的自由文本，实际会出现：
 * 中英文逗号混用、分号、井号包裹、前后空格、重复标签、超长标签。
 * 这里统一拆成干净的去重列表。</p>
 *
 * <p>不引入正则表达式是刻意的：正则写法一旦出现在生成器模板里就要处理反斜杠转义，
 * 本项目已有「三层转义」踩坑史，能不用就不用。</p>
 *
 * @author ruoyi
 */
public final class TopicSplitter {

    /** 单个话题最大长度：超出截断（保护 dim_key 的 VARCHAR(96)） */
    public static final int MAX_TOPIC_CHARS = 80;

    /** 单条舆情最多取几个话题：防止一条灌水数据刷出上百个维度行 */
    public static final int MAX_TOPICS_PER_OPINION = 8;

    private static final char[] SEPARATORS = {',', '，', ';', '；', '#', '　', ' ', '|', '/'};

    /**
     * 拆解话题标签
     *
     * @param tags 原始标签文本
     * @return 去重后的话题列表（保序），永不为 {@code null}
     */
    public static List<String> split(String tags) {
        List<String> out = new ArrayList<>();
        if (tags == null || tags.isBlank()) {
            return out;
        }
        Set<String> seen = new LinkedHashSet<>();
        for (String part : rawSplit(tags)) {
            String t = trim(part);
            if (t.isEmpty()) {
                continue;
            }
            if (t.length() > MAX_TOPIC_CHARS) {
                t = t.substring(0, MAX_TOPIC_CHARS);
            }
            if (seen.add(t)) {
                out.add(t);
                if (out.size() >= MAX_TOPICS_PER_OPINION) {
                    break;
                }
            }
        }
        return out;
    }

    /**
     * 是否可入维度表
     *
     * <p>过滤掉纯符号与纯数字标签：这类多为页码、序号、表情残留，
     * 计入话题分布只会污染 TOP 榜。</p>
     */
    public static boolean meaningful(String topic) {
        if (topic == null) {
            return false;
        }
        String t = trim(topic);
        if (t.length() < 2) {
            return false;
        }
        boolean hasWord = false;
        boolean hasDigitOnly = true;
        for (int i = 0; i < t.length(); i++) {
            char c = t.charAt(i);
            if (Character.isLetter(c) || Character.UnicodeScript.of(c) == Character.UnicodeScript.HAN) {
                hasWord = true;
                hasDigitOnly = false;
            } else if (!Character.isDigit(c)) {
                hasDigitOnly = false;
            }
        }
        return hasWord && !hasDigitOnly;
    }

    private static List<String> rawSplit(String s) {
        List<String> parts = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (isSeparator(c)) {
                parts.add(cur.toString());
                cur.setLength(0);
            } else {
                cur.append(c);
            }
        }
        parts.add(cur.toString());
        return parts;
    }

    private static boolean isSeparator(char c) {
        // 制表符与回车由 Character.isWhitespace 兜住（见 isBlank），此处不重复列
        for (char s : SEPARATORS) {
            if (c == s) {
                return true;
            }
        }
        return false;
    }

    private static String trim(String s) {
        int start = 0;
        int end = s.length();
        while (start < end && isBlank(s.charAt(start))) {
            start++;
        }
        while (end > start && isBlank(s.charAt(end - 1))) {
            end--;
        }
        return s.substring(start, end);
    }

    private static boolean isBlank(char c) {
        return Character.isWhitespace(c) || c == 0x3000 || c == '#';
    }

    private TopicSplitter() {
    }
}
`,
  },
  {
    rel: 'analytics/HeatScorer.java',
    content: `package org.dromara.yuqing.analytics;

/**
 * 综合热度打分
 *
 * <p>权重拍板：阅读 1 / 评论 3 / 转发 5 / 点赞 1 / 内容热度 10。
 * 逻辑是「主动行为权重高于被动浏览，转发权重最高（跨圈层扩散）。」</p>
 *
 * <p><b>为什么用 {@code long} 而不是浮点：</b>热度既要用于排序、又要落库与做报表，
 * 浮点在「相等则按时间倒序」的 tie-break 上会因精度抖动导致同一天重跑名次变化，
 * 破坏幂等直觉。整数运算可复现，同输入必得同输出。</p>
 *
 * @author ruoyi
 */
public final class HeatScorer {

    /** 阅读权重 */
    public static final int W_READ = 1;

    /** 评论权重 */
    public static final int W_COMMENT = 3;

    /** 转发权重 */
    public static final int W_SHARE = 5;

    /** 点赞权重 */
    public static final int W_LIKE = 1;

    /** 内容热度分值权重 */
    public static final int W_CONTENT = 10;

    /**
     * 计算综合热度分值
     *
     * @param o 舆情切片
     * @return 分值（非负）
     */
    public static long score(OpinionSlice o) {
        if (o == null) {
            return 0L;
        }
        long v = nz(o.getReadCount()) * W_READ
            + nz(o.getCommentCount()) * W_COMMENT
            + nz(o.getShareCount()) * W_SHARE
            + nz(o.getLikeCount()) * W_LIKE
            + (o.getHeatScore() == null ? 0L : o.getHeatScore()) * W_CONTENT;
        return Math.max(v, 0L);
    }

    /** 互动量合计（阅读+评论+转发+点赞），看板「互动数据统计」用 */
    public static long interaction(OpinionSlice o) {
        if (o == null) {
            return 0L;
        }
        return nz(o.getReadCount()) + nz(o.getCommentCount()) + nz(o.getShareCount()) + nz(o.getLikeCount());
    }

    private static long nz(Long v) {
        return v == null ? 0L : Math.max(v, 0L);
    }

    private HeatScorer() {
    }
}
`,
  },

  /* ================================================================ 聚合入参 */
  {
    rel: 'analytics/AggregateScope.java',
    content: `package org.dromara.yuqing.analytics;

import lombok.Data;

import java.time.LocalDate;

/**
 * 聚合 / 看板查询范围（F-009 验收标准 2 的多维筛选条件）
 *
 * <p>字段与验收标准 2 一一对应：时间范围、任务、渠道、舆情属性、风险等级，
 * 另外补了舆情分级与传播量级两个可选条件。</p>
 *
 * <p>{@link #normalized(int)} 负责把所有非法组合收敛成可执行范围 —— 校验只在
 * 这一处做，聚合任务与看板查询共用，避免两边口径漂移。</p>
 *
 * @author ruoyi
 */
@Data
public class AggregateScope {

    /** 起始统计日（含） */
    private LocalDate dateFrom;

    /** 截止统计日（含） */
    private LocalDate dateTo;

    /** 任务ID */
    private Long taskId;

    /** 渠道ID */
    private Long channelId;

    /** 舆情属性 */
    private String sentiAttr;

    /** 风险等级 */
    private String riskLevel;

    /** 舆情分级 */
    private String opinionLevel;

    /** 传播量级 */
    private String spreadLevel;

    /**
     * 归一化：补默认值、纠正倒置区间、按上限截断跨度
     *
     * @param maxScopeDays 允许的最大跨度（天）
     * @return 本对象自身（便于链式使用）
     */
    public AggregateScope normalized(int maxScopeDays) {
        LocalDate today = LocalDate.now();
        if (dateTo == null) {
            dateTo = today;
        }
        if (dateFrom == null) {
            dateFrom = dateTo.minusDays(6);
        }
        if (dateFrom.isAfter(dateTo)) {
            LocalDate tmp = dateFrom;
            dateFrom = dateTo;
            dateTo = tmp;
        }
        int limit = maxScopeDays <= 0 ? 366 : maxScopeDays;
        if (dateFrom.plusDays(limit - 1L).isBefore(dateTo)) {
            dateFrom = dateTo.minusDays(limit - 1L);
        }
        taskId = positiveOrNull(taskId);
        channelId = positiveOrNull(channelId);
        sentiAttr = blankToNull(sentiAttr);
        riskLevel = blankToNull(riskLevel);
        opinionLevel = blankToNull(opinionLevel);
        spreadLevel = blankToNull(spreadLevel);
        return this;
    }

    /** 跨度天数 */
    public int spanDays() {
        if (dateFrom == null || dateTo == null) {
            return 0;
        }
        return (int) (dateTo.toEpochDay() - dateFrom.toEpochDay()) + 1;
    }

    /** 是否只覆盖单一统计日（热点快照与批次台账据此判断粒度） */
    public boolean singleDay() {
        return dateFrom != null && dateFrom.equals(dateTo);
    }

    private static Long positiveOrNull(Long v) {
        return v == null || v <= 0L ? null : v;
    }

    private static String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }
}
`,
  },

  /* ================================================================ 聚合产出 */
  {
    rel: 'analytics/DailyRow.java',
    content: `package org.dromara.yuqing.analytics;

import lombok.Data;

import java.time.LocalDate;

/**
 * 日聚合行 —— 对应 Doris {@code yq_stats_daily}
 *
 * <p>主键语义是 (stats_date, task_id, channel_id)：任务/渠道用 0 表示「未归属」，
 * 于是「全部任务合并口径」不需要单独一行，查询时按需 SUM 即可。</p>
 *
 * @author ruoyi
 */
@Data
public class DailyRow {

    /** 统计日 */
    private LocalDate statsDate;

    /** 任务ID（0=未归属） */
    private Long taskId;

    /** 渠道ID（0=未归属） */
    private Long channelId;

    /** 舆情总量 */
    private Integer totalCount;

    /** 正面条数 */
    private Integer positiveCount;

    /** 中性条数 */
    private Integer neutralCount;

    /** 负面条数 */
    private Integer negativeCount;

    /** 去重剔除条数（来自 yq_collect_log 的 dup_count 按日汇总） */
    private Integer dupCount;

    /** 降噪剔除条数（来自 yq_collect_log 的 rejected_count 按日汇总） */
    private Integer rejectedCount;

    /** 预警条数（来自主库 yq_alert） */
    private Integer alertCount;

    /** 推送条数（来自主库 yq_push_record） */
    private Integer pushCount;

    /** 报告生成数（F-014 未落地，恒为 0） */
    private Integer reportCount;

    /** 阅读量合计 */
    private Long readSum;

    /** 评论量合计 */
    private Long commentSum;

    /** 转发量合计 */
    private Long shareSum;

    /** 点赞量合计 */
    private Long likeSum;

    /** 负面占比（%，保留 2 位，由总量与负面数派生） */
    private Double negativeRate;

    /**
     * 由总量与负面数派生负面占比
     *
     * <p>总量为 0 时给 0 而不是 null：看板上的占比图不接受空点。</p>
     */
    public void derive() {
        int total = nz(totalCount);
        negativeRate = total == 0 ? 0D : round2(nz(negativeCount) * 100D / total);
    }

    static double round2(double v) {
        return Math.round(v * 100D) / 100D;
    }

    private static int nz(Integer v) {
        return v == null ? 0 : v;
    }
}
`,
  },
  {
    rel: 'analytics/DimRow.java',
    content: `package org.dromara.yuqing.analytics;

import lombok.Data;

import java.time.LocalDate;

/**
 * 维度分布行 —— 对应 Doris {@code yq_stats_dim}
 *
 * <p>长表设计：{@code (stats_date, dim_type, dim_key, time_grain, task_id, channel_id)}
 * 为 Unique Key。维度取值是开放集合（地域、话题），宽表没法预知列，
 * 所以统一走长表；趋势曲线的「时间桶」也复用这张表（dim_type = trend）。</p>
 *
 * @author ruoyi
 */
@Data
public class DimRow {

    /** 统计日 */
    private LocalDate statsDate;

    /** 维度类型 */
    private String dimType;

    /** 维度取值（ID 或文本） */
    private String dimKey;

    /** 时间粒度（趋势行有效；分布行固定 day） */
    private String timeGrain;

    /** 任务ID（0=未归属） */
    private Long taskId;

    /** 渠道ID（0=未归属） */
    private Long channelId;

    /** 维度展示名 */
    private String dimLabel;

    /** 舆情条数 */
    private Integer opinionCount;

    /** 正面条数 */
    private Integer positiveCount;

    /** 中性条数 */
    private Integer neutralCount;

    /** 负面条数 */
    private Integer negativeCount;

    /** 高风险条数 */
    private Integer highRiskCount;

    /** 阅读量合计 */
    private Long readSum;

    /** 评论量合计 */
    private Long commentSum;

    /** 转发量合计 */
    private Long shareSum;

    /** 点赞量合计 */
    private Long likeSum;

    /** 热度分值合计 */
    private Long heatSum;

    /** 负面占比（%） */
    private Double negativeRate;

    /** 派生占比 */
    public void derive() {
        int total = opinionCount == null ? 0 : opinionCount;
        negativeRate = total == 0 ? 0D : DailyRow.round2((negativeCount == null ? 0 : negativeCount) * 100D / total);
    }
}
`,
  },
  {
    rel: 'analytics/HotRow.java',
    content: `package org.dromara.yuqing.analytics;

import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 热点排行行 —— 对应 Doris {@code yq_stats_hot}
 *
 * <p>Unique Key 是 {@code (stats_date, rank_by, rank_no)}：名次本身是键的一部分，
 * 因此每天每口径固定写 TopN 行，重跑只覆盖同名次，不会累积。</p>
 *
 * @author ruoyi
 */
@Data
public class HotRow {

    /** 统计日 */
    private LocalDate statsDate;

    /** 排序口径 */
    private String rankBy;

    /** 名次（从 1 起） */
    private Integer rankNo;

    /** 舆情ID */
    private Long opinionId;

    /** 任务ID（0=未归属） */
    private Long taskId;

    /** 渠道ID（0=未归属） */
    private Long channelId;

    /** 舆情标题 */
    private String title;

    /** 渠道名称 */
    private String channelName;

    /** 原文链接 */
    private String opinionUrl;

    /** 发布时间 */
    private LocalDateTime publishTime;

    /** 舆情属性 */
    private String sentiAttr;

    /** 风险等级 */
    private String riskLevel;

    /** 阅读量 */
    private Long readCount;

    /** 评论量 */
    private Long commentCount;

    /** 转发量 */
    private Long shareCount;

    /** 点赞量 */
    private Long likeCount;

    /** 综合热度分值 */
    private Integer heatScore;
}
`,
  },
  {
    rel: 'analytics/AggregateOutcome.java',
    content: `package org.dromara.yuqing.analytics;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * 一次聚合的产出
 *
 * <p>三张表一起装在一个对象里返回，是为了让 Service 层能在一处做
 * 「写 Doris 失败就整批标 failed」的判断，而不是三个方法各自抛异常。</p>
 *
 * @author ruoyi
 */
@Data
public class AggregateOutcome {

    /** 读取到的明细条数 */
    private int sourceCount;

    /** 是否因命中读取上限被截断 */
    private boolean truncated;

    /** 覆盖的统计日起止 */
    private java.time.LocalDate beginDate;

    /** 覆盖的统计日截止 */
    private java.time.LocalDate endDate;

    /** 日聚合行 */
    private List<DailyRow> daily = new ArrayList<>();

    /** 维度分布行（含趋势行） */
    private List<DimRow> dim = new ArrayList<>();

    /** 热点排行行 */
    private List<HotRow> hot = new ArrayList<>();

    /** 非致命提示（前端原样展示，用于解释「为什么数字看起来不对」） */
    private List<String> notices = new ArrayList<>();

    /** 追加一条提示（自动去重） */
    public void notice(String msg) {
        if (msg != null && !msg.isBlank() && !notices.contains(msg)) {
            notices.add(msg);
        }
    }

    /** 合并后的提示文本，落库到 yq_stats_batch.notice */
    public String noticeText() {
        return notices.isEmpty() ? null : String.join("；", notices);
    }
}
`,
  },
];
