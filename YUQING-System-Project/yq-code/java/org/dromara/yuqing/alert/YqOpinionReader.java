package org.dromara.yuqing.alert;

import com.baomidou.dynamic.datasource.annotation.DS;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.dromara.yuqing.domain.YqOpinion;
import org.dromara.yuqing.mapper.YqOpinionMapper;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * 舆情只读访问器（{@code @DS("doris")} 路由）
 *
 * <p>把「读 Doris」与「写 MySQL」拆成两个 Bean 的原因：本项目 yq_opinion 在 Doris
 * （Unique Key 模型，业务侧只读），而 yq_alert / yq_push_record 在主库。
 * {@code @DS} 是类级 AOP，一个类里混读写两张库路由会错乱；
 * 拆开之后 {@code YqAlertDispatchServiceImpl} 走默认主库、本类走 Doris，职责清晰。</p>
 *
 * <p><b>安全：</b>全部条件走 {@link LambdaQueryWrapper} 预编译占位符，不拼接任何用户输入；
 * {@code limit} 由常量上限约束。</p>
 *
 * @author ruoyi
 */
@Component
@RequiredArgsConstructor
@DS("doris")
public class YqOpinionReader implements AlertCountSource {

    private final YqOpinionMapper opinionMapper;

    @Override
    public long count(Long taskId, Long channelId, String sentiAttr, LocalDateTime from, LocalDateTime to) {
        if (from == null || to == null || !from.isBefore(to)) {
            return 0L;
        }
        Long n = opinionMapper.selectCount(base(taskId, channelId, sentiAttr, from, to));
        return n == null ? 0L : n;
    }

    /**
     * 载入待预警判定的舆情切片
     *
     * @param taskId   任务过滤，为空表示全部任务
     * @param from     发布时间下界（含）
     * @param to       发布时间上界（不含）
     * @param limit    上限
     */
    public List<AlertCandidate> loadCandidates(Long taskId, LocalDateTime from, LocalDateTime to, int limit) {
        if (from == null || to == null || !from.isBefore(to)) {
            return new ArrayList<>();
        }
        LambdaQueryWrapper<YqOpinion> lqw = base(taskId, null, null, from, to);
        lqw.orderByAsc(YqOpinion::getPublishTime);
        lqw.last("limit " + Math.max(1, Math.min(limit, 20000)));
        List<YqOpinion> rows = opinionMapper.selectList(lqw);
        if (rows == null || rows.isEmpty()) {
            return new ArrayList<>();
        }
        // 渠道名称由 Service 层用主库的 yq_channel 回填（本 Bean 走 Doris 路由，
        // 不能在这里跨库查 yq_channel，否则会打到 Doris 上报「表不存在」）
        List<AlertCandidate> out = new ArrayList<>(rows.size());
        for (YqOpinion o : rows) {
            AlertCandidate c = AlertCandidate.from(o);
            if (c != null) {
                out.add(c);
            }
        }
        return out;
    }

    private LambdaQueryWrapper<YqOpinion> base(Long taskId, Long channelId, String sentiAttr,
                                              LocalDateTime from, LocalDateTime to) {
        LambdaQueryWrapper<YqOpinion> lqw = new LambdaQueryWrapper<>();
        lqw.eq(Objects.nonNull(taskId), YqOpinion::getTaskId, taskId);
        lqw.eq(Objects.nonNull(channelId), YqOpinion::getChannelId, channelId);
        lqw.eq(sentiAttr != null && !sentiAttr.isBlank(), YqOpinion::getSentiAttr, sentiAttr);
        lqw.ge(YqOpinion::getPublishTime, from);
        lqw.lt(YqOpinion::getPublishTime, to);
        return lqw;
    }
}
