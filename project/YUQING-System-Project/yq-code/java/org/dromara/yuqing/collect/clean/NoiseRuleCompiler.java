package org.dromara.yuqing.collect.clean;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.dromara.yuqing.domain.YqNoiseRule;
import org.dromara.yuqing.mapper.YqNoiseRuleMapper;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * 降噪规则装载与缓存（F-006 验收标准 2：业务端动态启停、按优先级执行）。
 *
 * <p>规则来自 {@code yq_noise_rule}，每次判定都查库会把数据库打爆，
 * 因此按 {@code yuqing.collect.clean.rule-cache-seconds} 做短缓存；
 * 后台改规则后可调 {@link #refresh()} 立刻生效。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NoiseRuleCompiler {

    /** 单次装载上限（保护性：规则表被误灌几十万行时不至于拖垮判定） */
    private static final int MAX_RULES = 2000;

    private final YqNoiseRuleMapper noiseRuleMapper;

    private final YqCollectProperties props;

    private volatile List<CompiledNoiseRule> cached = Collections.emptyList();

    private volatile long cachedAt = 0L;

    /**
     * 取当前启用的降噪规则（按 priority 升序，数字小的先判定）。
     *
     * @return 已编译规则列表；未配置或查询失败时返回空列表（此时只走内置兜底判定）
     */
    public List<CompiledNoiseRule> activeRules() {
        long ttl = Math.max(0L, props.getClean().getRuleCacheSeconds()) * 1000L;
        List<CompiledNoiseRule> hit = cached;
        if (hit != null && !hit.isEmpty() && System.currentTimeMillis() - cachedAt < ttl) {
            return hit;
        }
        return reload();
    }

    /**
     * 强制刷新缓存（后台保存规则后调用）。
     */
    public void refresh() {
        cached = Collections.emptyList();
        cachedAt = 0L;
    }

    /**
     * 重新装载规则。查询异常时保留旧缓存而不是清空——
     * 数据库抖一下不该让降噪整体失效（那会瞬间灌进大量垃圾数据）。
     *
     * @return 规则列表
     */
    private synchronized List<CompiledNoiseRule> reload() {
        long ttl = Math.max(0L, props.getClean().getRuleCacheSeconds()) * 1000L;
        if (System.currentTimeMillis() - cachedAt < ttl && !cached.isEmpty()) {
            return cached;
        }
        List<CompiledNoiseRule> loaded;
        try {
            LambdaQueryWrapper<YqNoiseRule> qw = new LambdaQueryWrapper<>();
            qw.eq(YqNoiseRule::getStatus, "0")
                .orderByAsc(YqNoiseRule::getPriority)
                .last("limit " + MAX_RULES);
            List<YqNoiseRule> rows = noiseRuleMapper.selectList(qw);
            loaded = new ArrayList<>(rows.size());
            for (YqNoiseRule row : rows) {
                CompiledNoiseRule compiled = CompiledNoiseRule.from(row);
                if (compiled != null) {
                    loaded.add(compiled);
                }
            }
            cached = loaded;
            cachedAt = System.currentTimeMillis();
            log.debug("[净化] 降噪规则装载 {} 条（库表 {} 行）", loaded.size(), rows.size());
        } catch (Exception e) {
            log.warn("[净化] 降噪规则装载失败，沿用上一次缓存: {}", e.getMessage());
            loaded = cached;
        }
        return loaded;
    }
}
