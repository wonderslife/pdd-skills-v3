package org.dromara.yuqing.analysis.domain;

import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 批量研判结果（F-007 验收标准 6、10）
 *
 * <p><b>为什么失败明细要逐条返回、而不是只给一个失败数：</b>
 * 验收标准 6 要求「大模型调用失败或返回格式不合法时置 failed、记录失败原因、
 * 按退避策略重试，且不阻塞其他舆情研判」。如果只回一个数字，研判员既不知道
 * 为什么失败，也无法判断「重试有没有意义」—— 配置错误（如 api-key 为空）
 * 重试一万次也不会成功，而网络抖动重试一次就好了。因此这里带上
 * 每条失败的舆情ID、标题摘要、失败原因原文与「是否值得重试」。</p>
 *
 * <p><b>为什么单独区分 {@code llmUsed} 与 {@code ruleUsed}：</b>
 * 大模型未启用（{@code yuqing.analysis.llm.enabled=false}）或调用失败时
 * 本模块走规则兜底，这是刻意的降级设计 —— 保证 F-010 预警 / F-014 日报的
 * 数据链路不被外部服务阻塞。但降级必须**可见**，
 * 否则「为什么这批结论都很糙」将无从解释。</p>
 *
 * @author ruoyi
 */
@Data
public class AnalysisBatchResult implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 本次批次号（写入日志与前端回显，便于对账） */
    private String batchNo;

    /** 触发方式：manual（人工点按钮）/ job（定时任务）/ single（单条重研判） */
    private String trigger;

    /** 本次查询命中的待研判总数（可能大于 claimed，受 batchSize 上限） */
    private int total;

    /** 实际认领成功条数（乐观锁 CAS 后的结果，并发下可能小于 total） */
    private int claimed;

    /** 处理完成条数（成功 + 失败） */
    private int processed;

    /** 研判成功条数 */
    private int succeeded;

    /** 研判失败条数 */
    private int failed;

    /** 跳过条数（认领失败 / 内容为空） */
    private int skipped;

    /** 使用大模型得出结论的条数 */
    private int llmUsed;

    /** 使用规则兜底得出结论的条数 */
    private int ruleUsed;

    /** 新建事件聚合数 */
    private int clusterCreated;

    /** 并入既有事件数 */
    private int clusterJoined;

    /** 自动打标签条数 */
    private int tagged;

    /** 是否因批次上限被截断（true 时前端提示「还有 N 条待研判」） */
    private boolean truncated;

    /** 剩余待研判条数（截断时给出，便于前端提示继续） */
    private long remaining;

    /** 数据范围说明 */
    private String scopeDesc;

    /** 批次开始时间 */
    private LocalDateTime startedAt;

    /** 批次结束时间 */
    private LocalDateTime finishedAt;

    /** 批次耗时（毫秒） */
    private long durationMs;

    /** 失败明细（条数上限由配置控制，避免响应体过大） */
    private List<Failure> failures = new ArrayList<>();

    /**
     * 单条失败明细。
     *
     * <p>{@code retryable} 是给前端「重试」按钮用的：配置类错误标为不可重试，
     * 前端应引导用户去改配置而不是反复点重试。</p>
     */
    @Data
    public static class Failure implements Serializable {

        private static final long serialVersionUID = 1L;

        /** 舆情ID */
        private Long opinionId;

        /** 舆情标题摘要 */
        private String title;

        /** 失败原因原文（已做长度截断与换行清洗） */
        private String reason;

        /** 本次是第几次尝试 */
        private int attempt;

        /** 是否值得重试 */
        private boolean retryable;
    }
}
