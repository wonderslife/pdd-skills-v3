package org.dromara.yuqing.analysis.domain;

import lombok.Data;
import org.dromara.yuqing.ledger.domain.LedgerDetail;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

/**
 * 单条舆情研判详情（F-007 验收标准 7）
 *
 * <p><b>刻意「组合」而不是「摊平」：</b>验收标准 7 要求结论包含
 * 「舆情内容、来源、热度、风险等级、研判分析与处置建议」六要素，
 * 而 F-016 台账详情（{@link LedgerDetail}）已经把原文、互动数据、
 * 完整溯源字段、研判结论（含历史）、预警记录、推送记录全部组装好了，
 * 并且<b>自带数据权限校验</b>。把它的四十个字段在本类里再抄一遍，
 * 会带来两个确定的坏处：字段改名时两处不同步、越权校验出现第二份实现。</p>
 *
 * <p>因此本类只承载「研判特有、台账详情里没有」的四样东西：
 * 变体命中明细、模型标签与人工标签的分离、修正人姓名、结论来源标识。</p>
 *
 * @author ruoyi
 */
@Data
public class AnalysisDetailView implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 台账详情（F-016 提供）。
     *
     * <p>前端渲染约定：其中的 content / title / analysis.summary /
     * analysis.suggestion / analysis.matchEvidence 全部来自外部输入
     * （采集原文 + 大模型输出），<b>一律纯文本渲染，禁止 v-html</b>。</p>
     */
    private LedgerDetail opinion;

    /**
     * 变体命中明细（验收标准 3 的「命中依据」）。
     *
     * <p>由 {@code matchEvidence} 的文本描述解析而来，便于前端按条目罗列；
     * 文本原文仍保留在 {@code opinion.analysis.matchEvidence} 里，
     * 解析失败时本列表为空而不影响展示。</p>
     */
    private List<String> variantHits = new ArrayList<>();

    /** 模型/规则打的标签名（tag_source = model） */
    private List<String> modelTagNames = new ArrayList<>();

    /** 人工修正加的标签名（tag_source = manual） */
    private List<String> manualTagNames = new ArrayList<>();

    /** 修正人姓名（corrected_by 的用户昵称） */
    private String correctedByName;

    /**
     * 结论来源：llm / rule / manual。
     *
     * <p>数据库里没有独立的「来源」列，本字段由
     * {@code corrected_flag} 与 {@code model_version} 推导：
     * 修正过 → manual；未修正且 model_version 为 rule → rule；否则 llm。
     * 这样在不新增列的前提下，界面仍能一眼区分三类结论。</p>
     */
    private String conclusionSource;
}
