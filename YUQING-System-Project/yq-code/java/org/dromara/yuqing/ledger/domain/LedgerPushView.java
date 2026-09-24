package org.dromara.yuqing.ledger.domain;

import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 详情页的推送记录行（F-016 验收标准 3）
 *
 * <p>数据来自 yq_push_record（MySQL）。{@code contentSnapshot} 是推送出去的内容快照，
 * 台账只回摘要长度，不回全文 —— 快照里可能含大段正文，
 * 详情页展示不下，且它属于推送审计证据，不参与台账阅读。</p>
 *
 * @author ruoyi
 */
@Data
public class LedgerPushView implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 记录ID */
    private Long recordId;

    /** 推送规则名称 */
    private String ruleName;

    /** 推送场景 */
    private String pushScene;

    /** 推送级别 */
    private String pushLevel;

    /** 发送状态 */
    private String sendStatus;

    /** 实际接收人（逗号分隔的用户ID） */
    private String targetIds;

    /** 已重试次数 */
    private Integer retryCount;

    /** 失败原因 */
    private String failReason;

    /** 发送时间 */
    private LocalDateTime sendTime;

    /** 推送内容摘要（截断后的快照，避免把全文推给前端） */
    private String contentDigest;
}
