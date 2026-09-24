package org.dromara.yuqing.ledger.domain;

import lombok.Data;

import java.util.List;

/**
 * 台账多维检索条件（F-016 验收标准 1）
 *
 * <p>验收标准 1 点名了 11 个维度：时间范围、任务、渠道、舆情属性、风险等级、
 * 舆情分级、标签、关键词、采集来源、清洗状态、研判状态。本类逐项对应，
 * 另加 clusterId（验收标准 4 的聚合事件视角）与发布时间范围
 * （列表要展示发布时间，按发布时间筛是研判员的真实习惯）。</p>
 *
 * <p><b>为什么不直接复用 YqOpinion 实体当查询对象：</b>实体字段是一对一列映射，
 * 而检索条件里有标签集合、关键词、时间区间这些「不对应单列」的项；
 * 混进实体会让 buildQueryWrapper 无法区分「字段为空」与「条件未启用」。</p>
 *
 * <p><b>安全：</b>本类只承载查询条件，不承载任何身份信息。
 * 数据可见范围一律由 {@code LedgerScopeResolver} 从 Sa-Token 上下文推导，
 * 前端无法通过构造本对象越权（详见 LedgerScopeResolver 的类注释）。</p>
 *
 * @author ruoyi
 */
@Data
public class LedgerQuery {

    /* ---------------- 时间维度 ---------------- */

    /** 采集时间起（含），格式 yyyy-MM-dd HH:mm:ss 或 yyyy-MM-dd */
    private String collectBeginTime;

    /** 采集时间止（含） */
    private String collectEndTime;

    /** 发布时间起（含） */
    private String publishBeginTime;

    /** 发布时间止（含） */
    private String publishEndTime;

    /* ---------------- 归属维度 ---------------- */

    /** 所属任务ID */
    private Long taskId;

    /** 来源渠道ID */
    private Long channelId;

    /** 事件聚合ID（验收标准 4） */
    private Long clusterId;

    /* ---------------- 属性维度 ---------------- */

    /** 舆情属性（字典 yq_senti_attr） */
    private String sentiAttr;

    /** 风险等级（字典 yq_risk_level） */
    private String riskLevel;

    /** 舆情分级（字典 yq_opinion_level） */
    private String opinionLevel;

    /** 传播量级（字典 yq_spread_level） */
    private String spreadLevel;

    /* ---------------- 流程维度 ---------------- */

    /** 采集来源（字典 yq_collect_source：auto / manual_import） */
    private String collectSource;

    /** 清洗状态（字典 yq_clean_status：raw / cleaned / rejected） */
    private String cleanStatus;

    /** 研判状态（字典 yq_analyze_status：pending / processing / completed / failed） */
    private String analyzeStatus;

    /* ---------------- 集合与文本维度 ---------------- */

    /** 标签ID集合（多选，命中任意一个即匹配） */
    private List<Long> tagIds;

    /**
     * 关键词。
     *
     * <p>非全文检索模式下按标题模糊匹配；全文检索模式下走正文命中的
     * {@code /yuqing/opinion/search} 端点（验收标准 7）。</p>
     */
    private String keyword;

    /** 关键词作用范围：title / content / both，默认 both */
    private String keywordScope;

    /** 是否只看已预警（0否 1是），空表示不限 */
    private String alertFlag;

    /* ---------------- 排序 ---------------- */

    /** 排序字段：collectTime / publishTime / heatScore，默认 collectTime */
    private String orderBy;

    /** 是否降序，默认 true */
    private Boolean orderDesc;

    /**
     * 关键词作用范围归一化（空值回落 both）。
     *
     * <p>放在领域对象上而不是 Controller 里，是为了让离线自测能直接断言，
     * 也避免多个调用方各自实现一套默认值规则。</p>
     */
    public String normalizedKeywordScope() {
        if (keywordScope == null || keywordScope.isBlank()) {
            return "both";
        }
        String v = keywordScope.trim().toLowerCase();
        if ("title".equals(v) || "content".equals(v)) {
            return v;
        }
        return "both";
    }
}
