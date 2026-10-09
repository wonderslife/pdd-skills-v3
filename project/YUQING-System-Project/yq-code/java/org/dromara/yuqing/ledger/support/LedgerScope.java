package org.dromara.yuqing.ledger.support;

import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * 台账数据可见范围（F-016 验收标准 8，架构决策 ③A）
 *
 * <p><b>③A 口径：</b>非管理员的可见范围 = 他名下监测任务
 * （{@code yq_task.create_by = 当前用户}）所产生的舆情。
 * 判定依据是「任务归属」而不是「部门」，因为舆情任务常常是跨部门临时专项，
 * 按部门切会把协作者挡在外面、把无关同事放进来。</p>
 *
 * <p><b>为什么必须是三态而不是一个集合：</b>如果只用「可见 taskId 集合」表达，
 * 空集合既可解释为「看不到任何数据」也可解释为「不过滤」—— 这两者差一次
 * 全量数据泄露。因此本类显式区分：</p>
 * <ul>
 *   <li>{@code unrestricted = true}：管理员，不加任何行级条件</li>
 *   <li>{@code denyAll = true}：范围为空，直接返回空结果，<b>不查库</b></li>
 *   <li>两者皆 false：按 {@code taskIds} 过滤</li>
 * </ul>
 *
 * <p><b>任务未归属（task_id 为 NULL）的数据：</b>不在任何人的「任务范围」内，
 * 因此非管理员看不到第三方导入的、尚未挂到任务下的舆情。这是刻意的保守选择 ——
 * 宁可让管理员去挂任务，也不要让范围外的数据自动可见。</p>
 *
 * @author ruoyi
 */
public final class LedgerScope {

    /** 不加行级限制（管理员） */
    private final boolean unrestricted;

    /** 范围为空，可见结果必为空集 */
    private final boolean denyAll;

    /** 可见任务ID集合（仅 restricted 态有意义） */
    private final Set<Long> taskIds;

    private LedgerScope(boolean unrestricted, boolean denyAll, Set<Long> taskIds) {
        this.unrestricted = unrestricted;
        this.denyAll = denyAll;
        this.taskIds = taskIds == null
            ? Collections.emptySet()
            : Collections.unmodifiableSet(new LinkedHashSet<>(taskIds));
    }

    /** 不限制（管理员 / 具备全量数据角色的用户） */
    public static LedgerScope all() {
        return new LedgerScope(true, false, null);
    }

    /** 显式空范围（会返回空结果，不会退化成全量） */
    public static LedgerScope none() {
        return new LedgerScope(false, true, null);
    }

    /**
     * 按任务集合限定范围。
     *
     * <p><b>关键安全语义：</b>传入空集合时返回 {@link #none()} 而不是
     * {@link #all()}。调用方不需要（也不应该）自己判空。</p>
     */
    public static LedgerScope ofTasks(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return none();
        }
        Set<Long> clean = new LinkedHashSet<>();
        for (Long id : ids) {
            if (id != null) {
                clean.add(id);
            }
        }
        if (clean.isEmpty()) {
            return none();
        }
        return new LedgerScope(false, false, clean);
    }

    public boolean isUnrestricted() {
        return unrestricted;
    }

    public boolean isDenyAll() {
        return denyAll;
    }

    public Set<Long> getTaskIds() {
        return taskIds;
    }

    /**
     * 判断某条舆情（按 taskId）是否在本范围内。
     *
     * <p>供离线自测直接断言隔离正确性；生产查询走 SQL 条件（见 LedgerOpinionDao），
     * 但两者必须口径一致，因此本方法即「口径的可执行定义」。</p>
     */
    public boolean allows(Long taskId) {
        if (unrestricted) {
            return true;
        }
        if (denyAll) {
            return false;
        }
        return taskId != null && taskIds.contains(taskId);
    }

    /** 人类可读描述，用于审计记录与调试 */
    public String describe() {
        if (unrestricted) {
            return "全量";
        }
        if (denyAll) {
            return "无授权范围（可见 0 条）";
        }
        return "任务范围(" + taskIds.size() + " 个任务)";
    }
}
