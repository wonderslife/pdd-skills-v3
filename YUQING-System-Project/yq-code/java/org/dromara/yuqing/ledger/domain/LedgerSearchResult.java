package org.dromara.yuqing.ledger.domain;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 全文检索结果（F-016 验收标准 7）
 *
 * <p><b>为什么要把 {@code matchMode} 显式暴露给前端：</b>
 * PRD §6.3 要求检索走 Doris 倒排索引 {@code MATCH_ANY}，
 * 但按架构决策 ①A，当前 doris 数据源指向的是 MySQL 镜像库，
 * 没有倒排索引。此时若默默用 {@code LIKE '%kw%'} 顶上去却不说明，
 * 将来接上真 Doris 后「为什么换了库结果不一样」将无从排查。
 * 因此实现方式随结果一起返回，前端在检索框下方标注当前口径。</p>
 *
 * @author ruoyi
 */
@Data
public class LedgerSearchResult implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 命中明细（已含高亮片段） */
    private List<SearchHit> hits;

    /** 命中总条数（可能大于 hits.size()，受 limit 限制） */
    private long total;

    /** 关键词原文（回显用） */
    private String keyword;

    /** 检索范围：title / content / both */
    private String keywordScope;

    /**
     * 实际检索实现方式：
     * <ul>
     *   <li>{@code inverted-index}：Doris 倒排索引 MATCH_ANY（生产目标口径）</li>
     *   <li>{@code like-scan}：镜像库兜底的前置模糊扫描（①A 现状）</li>
     * </ul>
     */
    private String matchMode;

    /** 为空的说明（无命中时给出放宽建议） */
    private List<String> hints;
}
