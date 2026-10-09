package org.dromara.yuqing.analytics.config;

import org.dromara.yuqing.analytics.ConclusionExtractor;
import org.dromara.yuqing.analytics.DerivedConclusionBuilder;
import org.dromara.yuqing.analytics.StatsAggregator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 多维分析引擎装配
 *
 * <p>聚合器与结论提炼器刻意做成普通对象而不是 {@code @Component}：
 * 它们不依赖容器（没有数据库、没有事务、没有请求上下文），
 * 这样离线自测可以直接 {@code new}，不用起 Spring。</p>
 *
 * @author ruoyi
 */
@Configuration
public class YqAnalyticsConfig {

    /**
     * 聚合器
     */
    @Bean
    public StatsAggregator statsAggregator(YqAnalyticsProperties properties) {
        return new StatsAggregator(properties);
    }

    /**
     * 明细口径结论提炼器
     */
    @Bean
    public ConclusionExtractor conclusionExtractor(YqAnalyticsProperties properties) {
        return new ConclusionExtractor(properties);
    }

    /**
     * 预聚合口径派生结论构建器
     */
    @Bean
    public DerivedConclusionBuilder derivedConclusionBuilder(YqAnalyticsProperties properties) {
        return new DerivedConclusionBuilder(properties);
    }
}
