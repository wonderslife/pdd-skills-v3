package org.dromara.yuqing.ledger.domain;

import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 全文检索命中（F-016 验收标准 7）
 *
 * <p>验收标准 7 要求「支持按标题与正文关键词检索，并高亮命中片段」。
 * 本对象承载命中定位信息：
 * {@code hitField} 说明命中在标题还是正文，{@code fragments} 是可以直接
 * 渲染的高亮片段。</p>
 *
 * <p><b>片段是已转义的 HTML：</b>由 {@code LedgerHighlighter} 先做实体转义、
 * 再包裹 {@code <em class="yq-hit">} 标记。前端必须用 v-html 渲染，
 * 而 v-html 是 XSS 的经典入口 —— 因此转义必须在服务端完成且不可绕过。
 * 直接回原文让前端自己高亮是被禁止的做法。</p>
 *
 * @author ruoyi
 */
@Data
public class SearchHit implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 舆情ID */
    private Long opinionId;

    /** 标题（原文，未转义 —— 前端用文本插值渲染） */
    private String title;

    /** 来源渠道 */
    private String channelName;

    /** 发布时间 */
    private LocalDateTime publishTime;

    /** 舆情属性 */
    private String sentiAttr;

    /** 风险等级 */
    private String riskLevel;

    /** 命中字段：title / content / both */
    private String hitField;

    /** 命中次数 */
    private Integer hitCount;

    /** 高亮片段（已转义的安全 HTML，可直接 v-html） */
    private List<String> fragments;

    /** 相关度分值（命中次数加权，仅用于展示排序依据） */
    private Integer score;

    /** 原文链接 */
    private String opinionUrl;
}
