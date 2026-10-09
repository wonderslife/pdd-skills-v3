package org.dromara.yuqing.ledger.domain;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 台账列表分页结果（F-016 验收标准 2、8、9）
 *
 * <p>刻意不复用 {@code PageResult}：验收标准 9 要求「无结果时展示空状态提示
 * 并给出可放宽的筛选建议」，这些建议必须**与本次查询条件一起返回**，
 * 否则前端要么丢失条件上下文、要么再发一次请求去问「为什么是空的」。
 * 验收标准 8 的范围说明同理 —— 用户需要知道「我看到的是我授权范围内的数据」，
 * 而不是以为自己看到的就是全量。</p>
 *
 * <p>{@code rows} / {@code total} 沿用 RuoYi 分页字段命名，
 * 前端表格组件可直接对接。</p>
 *
 * @author ruoyi
 */
@Data
public class LedgerPage implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 当前页数据 */
    private List<LedgerRow> rows;

    /** 满足条件的总条数 */
    private long total;

    /**
     * 空结果时的放宽建议（非空即有内容；有结果时为 null）。
     *
     * <p>恒在「结果为空」时填充 —— 包括因数据权限为空的情况，
     * 那种情况下第一条建议会明确说明「没有授权任务」，避免用户反复放宽条件。</p>
     */
    private List<String> hints;

    /** 本次查询的数据范围说明，如「任务范围(3 个任务)」/「全量」/「无授权范围（可见 0 条）」 */
    private String scopeDesc;

    /** 本次生效的筛选条件个数（前端可提示「已启用 N 个条件」） */
    private int activeConditions;

    /** 是否因数据权限而看不到任何数据（前端给出不同的空状态插画与引导） */
    private boolean scopeEmpty;
}
