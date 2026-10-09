package org.dromara.yuqing.collect.schedule;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.dromara.yuqing.collect.model.IntervalSpec;
import org.dromara.yuqing.domain.YqChannel;
import org.dromara.yuqing.domain.YqTask;
import org.dromara.yuqing.domain.YqTaskChannel;
import org.dromara.yuqing.mapper.YqChannelMapper;
import org.dromara.yuqing.mapper.YqTaskChannelMapper;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 采集频率校验（F-004 验收标准 2）。
 *
 * <p>规则：任务 × 渠道的生效间隔（任务级覆盖 &gt; 渠道级覆盖 &gt; 任务默认）不得低于
 * 「渠道限流下限」（请求间隔 × 并发上限）与全局最小间隔。</p>
 *
 * @author ruoyi
 */
@Component
@RequiredArgsConstructor
public class CollectScheduleValidator {

    private final YqCollectProperties props;

    private final YqTaskChannelMapper taskChannelMapper;

    private final YqChannelMapper channelMapper;

    /**
     * 校验任务的采集频率配置。
     *
     * @param task 任务
     * @return 问题列表；空表示合法
     */
    public List<String> validate(YqTask task) {
        List<String> issues = new ArrayList<>();
        if (task == null) {
            issues.add("任务不存在");
            return issues;
        }
        Map<Long, YqChannel> channels = boundChannels(task.getTaskId());
        if (channels.isEmpty()) {
            issues.add("任务未绑定任何采集渠道，调度不会产生采集单元");
            return issues;
        }
        List<YqTaskChannel> relations = taskChannelMapper.selectList(new LambdaQueryWrapper<YqTaskChannel>()
            .eq(YqTaskChannel::getTaskId, task.getTaskId()));
        for (YqTaskChannel relation : relations) {
            YqChannel channel = channels.get(relation.getChannelId());
            int interval = effectiveInterval(task, relation, channel);
            List<String> one = IntervalSpec.validate(interval,
                channel == null ? null : channel.getRequestInterval(),
                channel == null ? null : channel.getConcurrencyLimit(),
                props.getMinIntervalSeconds());
            String name = channel == null ? String.valueOf(relation.getChannelId()) : channel.getChannelName();
            for (String issue : one) {
                issues.add("渠道「" + name + "」：" + issue);
            }
        }
        return issues;
    }

    /**
     * 计算生效间隔（秒）。
     *
     * @param task    任务
     * @param relation 任务渠道关联
     * @param channel 渠道
     * @return 生效间隔
     */
    public int effectiveInterval(YqTask task, YqTaskChannel relation, YqChannel channel) {
        if (relation != null && relation.getOverrideInterval() != null && relation.getOverrideInterval() > 0) {
            return relation.getOverrideInterval();
        }
        if (channel != null && channel.getIntervalOverride() != null && channel.getIntervalOverride() > 0) {
            return channel.getIntervalOverride();
        }
        return task == null || task.getCollectInterval() == null ? 0 : task.getCollectInterval();
    }

    /**
     * 任务绑定的渠道（仅启用中的）。
     *
     * @param taskId 任务ID
     * @return channelId -> channel
     */
    public Map<Long, YqChannel> boundChannels(Long taskId) {
        List<YqTaskChannel> relations = taskChannelMapper.selectList(new LambdaQueryWrapper<YqTaskChannel>()
            .eq(YqTaskChannel::getTaskId, taskId));
        Set<Long> ids = relations.stream().map(YqTaskChannel::getChannelId)
            .filter(Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Map.of();
        }
        List<YqChannel> channels = channelMapper.selectByIds(ids);
        Map<Long, YqChannel> map = new LinkedHashMap<>();
        for (YqChannel channel : channels) {
            map.put(channel.getChannelId(), channel);
        }
        return map;
    }
}
