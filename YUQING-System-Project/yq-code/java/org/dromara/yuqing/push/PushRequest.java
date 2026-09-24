package org.dromara.yuqing.push;

import lombok.Builder;
import lombok.Data;
import org.dromara.yuqing.alert.AlertCandidate;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 一次推送请求
 *
 * @author ruoyi
 */
@Data
@Builder
public class PushRequest {

    /** 推送场景（yq_push_scene） */
    private String scene;

    /** 推送级别 immediate / scheduled */
    private String pushLevel;

    /** 命中的推送规则 ID */
    private Long ruleId;
    private String ruleName;

    /** 消息形态：text / markdown / file */
    @Builder.Default
    private String msgType = "text";

    /** 内容形态：summary（摘要式）/ detail（明细式） */
    @Builder.Default
    private String contentType = "detail";

    /** 渲染好的消息正文（由 Service 调 PushTemplateRenderer 产出） */
    private String content;

    /** 文件内容（msgType = file 时使用） */
    private String fileName;
    private byte[] fileBytes;

    /** 解析后的目标用户（系统用户 ID） */
    private java.util.Set<Long> targetUserIds;

    /** 免打扰时段 */
    private String quietStart;
    private String quietEnd;

    /** 失败重试上限 */
    private int maxRetry;

    /** 关联舆情 ID（落 yq_push_record.opinion_ids） */
    private List<Long> opinionIds;

    /** 关联报告 ID */
    private Long reportId;

    /** 是否高风险直达（决定能否穿透免打扰） */
    private boolean highPriority;

    /** 推送时刻 */
    private LocalDateTime now;

    /** 候选快照（推送记录 content_snapshot 的可读来源） */
    private List<AlertCandidate> candidates;
}
