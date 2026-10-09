package org.dromara.yuqing.ledger.support;

import java.util.Collection;
import java.util.Set;

/**
 * 台账数据范围推导（F-016 验收标准 8，架构决策 ③A）
 *
 * <p>纯函数：输入「是否管理员 + 名下任务ID集合」，输出 {@link LedgerScope}。
 * 不依赖 Sa-Token、不依赖数据库，便于离线自测覆盖全部分支。</p>
 *
 * <p><b>为什么把判定抽成纯函数：</b>数据权限是「错了就泄露」的逻辑，
 * 必须有可重复执行的断言。若把判定写在 ServiceImpl 里，
 * 就只能靠跑起整个 Spring 上下文 + 造多用户会话来验证，
 * 实际结果就是没人验证。抽成纯函数后，
 * {@code F016LedgerTest} 用一个循环就能覆盖管理员 / 单任务 / 空范围三种分支。</p>
 *
 * @author ruoyi
 */
public final class LedgerScopeResolver {

    private LedgerScopeResolver() {
    }

    /**
     * 推导可见范围。
     *
     * @param superAdmin    是否超级管理员（等价于「全量可见」）
     * @param hasAllDataRole 是否具备「全量数据」角色（如舆情主管按 PRD §7.3 为 ✅ 全部）
     * @param ownedTaskIds  当前用户名下的监测任务ID（{@code yq_task.create_by = 本人}）
     * @return 可见范围；{@code ownedTaskIds} 为空且无全量角色时返回 {@link LedgerScope#none()}
     */
    public static LedgerScope resolve(boolean superAdmin, boolean hasAllDataRole, Collection<Long> ownedTaskIds) {
        if (superAdmin || hasAllDataRole) {
            return LedgerScope.all();
        }
        return LedgerScope.ofTasks(ownedTaskIds);
    }

    /**
     * 反向校验：一个范围对象是否与「期望可见的 taskId 集合」一致。
     *
     * <p>仅用于自测断言，生产代码不要调用 —— 它会把整个候选集合遍历一遍。</p>
     */
    public static boolean consistent(LedgerScope scope, Collection<Long> candidates, Set<Long> shouldSee) {
        if (scope == null || candidates == null) {
            return false;
        }
        for (Long id : candidates) {
            boolean visible = scope.allows(id);
            boolean expected = shouldSee != null && shouldSee.contains(id);
            if (visible != expected) {
                return false;
            }
        }
        return true;
    }
}
