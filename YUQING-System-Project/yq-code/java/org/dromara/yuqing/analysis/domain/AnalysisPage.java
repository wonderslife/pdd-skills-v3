package org.dromara.yuqing.analysis.domain;

import lombok.Data;

import java.io.Serializable;
import java.util.List;
import java.util.Map;

/**
 * 研判台账分页结果（F-007 验收标准 5、10）
 *
 * <p>除了行数据本身，额外携带三类信息，均为「一次请求内就要让用户看明白」的内容：</p>
 * <ul>
 *   <li>{@code statusCount}：四个研判状态各自的总条数，前端做状态页签角标。
 *       放在同一个响应里返回，避免前端为了画角标再发四次请求
 *       （四次请求之间数据可能变化，角标与列表还会对不上）。</li>
 *   <li>{@code scopeDesc} / {@code scopeEmpty}：当前数据可见范围说明。
 *       沿用 F-016 台账口径 —— 非管理员的可见范围是本人名下任务产生的舆情，
 *       用户必须知道「我看到的是我授权范围内的数据」，否则会误以为系统漏数。</li>
 *   <li>{@code hints}：结果为空时给出可放宽的筛选建议。</li>
 * </ul>
 *
 * @author ruoyi
 */
@Data
public class AnalysisPage implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 当前页行（舆情 + 最新研判结论，已回填任务名 / 渠道名 / 标签名） */
    private List<AnalysisRow> rows;

    /** 满足条件的总条数 */
    private long total;

    /** 各研判状态总条数：pending / processing / completed / failed */
    private Map<String, Long> statusCount;

    /** 本次查询的数据范围说明，如「任务范围(3 个任务)」/「全量」/「无授权范围（可见 0 条）」 */
    private String scopeDesc;

    /** 是否因数据权限而看不到任何数据（前端给出不同的空状态引导） */
    private boolean scopeEmpty;

    /** 空结果时的放宽建议（有结果时为 null） */
    private List<String> hints;
}
