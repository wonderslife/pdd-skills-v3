package org.dromara.yuqing.analysis.domain;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 研判中心筛选条件（F-007）
 *
 * <p>维度与 F-016 台账保持一致（同一批字段、同一套字典），
 * 但语义偏向「作业态」：台账看的是舆情本身，研判中心看的是
 * 「这批舆情判完了没、判得对不对」，因此多了研判状态、修正标记、
 * 失败重试相关的条件。</p>
 *
 * @author ruoyi
 */
@Data
public class AnalysisQuery implements Serializable {

    private static final long serialVersionUID = 1L;

    /* ---------------- 时间 ---------------- */

    /** 采集开始时间（字符串，容错解析；非法值忽略而不是 400） */
    private String collectBeginTime;

    /** 采集结束时间 */
    private String collectEndTime;

    /* ---------------- 归属 ---------------- */

    /** 所属任务ID */
    private Long taskId;

    /** 来源渠道ID */
    private Long channelId;

    /** 事件聚合ID */
    private Long clusterId;

    /* ---------------- 舆情属性 ---------------- */

    /** 舆情属性（positive / neutral / negative） */
    private String sentiAttr;

    /** 风险等级（general / moderate / severe） */
    private String riskLevel;

    /** 舆情分级（normal / attention / warning / urgent） */
    private String opinionLevel;

    /** 传播量级（low / medium / high / viral） */
    private String spreadLevel;

    /** 标签ID集合（任一命中即可） */
    private List<Long> tagIds;

    /* ---------------- 作业态 ---------------- */

    /** 研判状态（pending / processing / completed / failed） */
    private String analyzeStatus;

    /** 是否仅看人工修正过的（null 不限；"1" 是） */
    private String correctedFlag;

    /** 是否仅看已预警 */
    private String alertFlag;

    /** 是否仅看失败项（便于「只看失败」一键重试） */
    private Boolean onlyFailed;

    /** 是否仅看可重试的失败项（重试次数未超上限） */
    private Boolean retryableOnly;

    /* ---------------- 关键词 ---------------- */

    /** 关键词 */
    private String keyword;

    /** 关键词检索范围 title / content / both，为空按 both */
    private String keywordScope;

    /* ---------------- 排序与条数 ---------------- */

    /** 排序字段（白名单，非白名单值一律忽略） */
    private String orderBy;

    /** 是否倒序 */
    private Boolean orderDesc;

    /** 仅取前 N 条（批量研判用），null 用配置上限 */
    private Integer limit;

    /** 关键词检索范围归一：非法值一律回落 both */
    public String normalizedKeywordScope() {
        if ("title".equalsIgnoreCase(keywordScope) || "content".equalsIgnoreCase(keywordScope)) {
            return keywordScope.toLowerCase();
        }
        return "both";
    }

    /** 是否构成关键词条件（空白串不算条件） */
    public boolean hasKeyword() {
        return keyword != null && !keyword.isBlank();
    }

    /** 是否只看失败项 */
    public boolean failedOnly() {
        return Boolean.TRUE.equals(onlyFailed) || "failed".equalsIgnoreCase(analyzeStatus);
    }
}
