package org.dromara.yuqing.analytics.jdbc;

import com.baomidou.dynamic.datasource.annotation.DS;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.analytics.DrilldownQuery;
import org.dromara.yuqing.analytics.DrilldownResult;
import org.dromara.yuqing.domain.YqOpinion;
import org.dromara.yuqing.mapper.YqOpinionMapper;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * 下钻明细读取（{@code @DS("doris")}，F-009 验收标准 6）
 *
 * <p><b>安全要点：</b>下钻条件里的地域 / 话题来自采集侧的自由文本，
 * 属于「不可信输入」。这里用 {@code apply("INSTR(region, {0}) > 0", token)} ——
 * MyBatis-Plus 的 apply 会把 {@code {0}} 编译成预编译占位符，
 * 因此 token 永远只是参数值，不可能参与 SQL 语法解析。</p>
 *
 * <p>为什么是 {@code INSTR} 而不是 {@code LIKE}：{@code LIKE} 需要对
 * {@code %} 与 {@code _} 做转义，任何一处漏转义都会让用户输入变成通配符
 * （信息泄露）或语法错误。{@code INSTR} 天然没有通配语义，一步去掉整个风险面。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
@DS("doris")
public class JdbcDrilldownReader {

    private final YqOpinionMapper opinionMapper;

    /**
     * 执行下钻查询
     *
     * @param q 条件（须已归一化分页）
     * @return 分页明细
     */
    public DrilldownResult query(DrilldownQuery q) {
        DrilldownResult result = new DrilldownResult();
        result.setDimType(q.getDimType());
        result.setDimKey(q.getDimKey());
        result.setDimLabel(q.getDimLabel());
        result.setConditionText(q.describe());
        result.setPageNum(q.getPageNum());
        result.setPageSize(q.getPageSize());
        LambdaQueryWrapper<YqOpinion> lqw = conditions(q);
        Long total = opinionMapper.selectCount(lqw);
        result.setTotal(total == null ? 0L : total);
        if (result.getTotal() == 0L) {
            return result;
        }
        // 分页参数已由 DrilldownQuery.paged(maxPageSize) 收敛到常量区间，
        // 这里的 limit/offset 只可能落在受控范围内
        int offset = Math.max(0, (q.getPageNum() - 1) * q.getPageSize());
        lqw.orderByDesc(YqOpinion::getPublishTime, YqOpinion::getOpinionId);
        lqw.last("limit " + q.getPageSize() + " offset " + offset);
        List<YqOpinion> rows = opinionMapper.selectList(lqw);
        List<DrilldownResult.Row> list = new ArrayList<>();
        if (rows != null) {
            for (YqOpinion o : rows) {
                DrilldownResult.Row r = new DrilldownResult.Row();
                r.setOpinionId(o.getOpinionId());
                r.setTitle(o.getTitle());
                r.setChannelName(o.getChannelName());
                r.setPublishTime(o.getPublishTime());
                r.setSentiAttr(o.getSentiAttr());
                r.setRiskLevel(o.getRiskLevel());
                r.setRegion(o.getRegion());
                r.setTopicTags(o.getTopicTags());
                r.setReadCount(o.getReadCount());
                r.setCommentCount(o.getCommentCount());
                r.setShareCount(o.getShareCount());
                r.setLikeCount(o.getLikeCount());
                r.setOpinionUrl(o.getOpinionUrl());
                list.add(r);
            }
        }
        result.setRows(list);
        return result;
    }

    /**
     * 组装下钻条件
     *
     * <p>所有分支都是「有值才加条件」；一个条件都没加会被上游拦住
     * （见 Service 层校验），不会出现「下钻出全表」这种事故。</p>
     */
    private LambdaQueryWrapper<YqOpinion> conditions(DrilldownQuery q) {
        LambdaQueryWrapper<YqOpinion> lqw = new LambdaQueryWrapper<>();
        if (q.getScope() != null) {
            lqw.ge(Objects.nonNull(q.getScope().getDateFrom()), YqOpinion::getCollectDate, q.getScope().getDateFrom());
            lqw.le(Objects.nonNull(q.getScope().getDateTo()), YqOpinion::getCollectDate, q.getScope().getDateTo());
            lqw.eq(Objects.nonNull(q.getScope().getTaskId()), YqOpinion::getTaskId, q.getScope().getTaskId());
            lqw.eq(Objects.nonNull(q.getScope().getChannelId()), YqOpinion::getChannelId, q.getScope().getChannelId());
        }
        lqw.eq(Objects.nonNull(q.getChannelId()), YqOpinion::getChannelId, q.getChannelId());
        lqw.eq(Objects.nonNull(q.getOpinionId()), YqOpinion::getOpinionId, q.getOpinionId());
        lqw.eq(notBlank(q.getSentiAttr()), YqOpinion::getSentiAttr, q.getSentiAttr());
        lqw.eq(notBlank(q.getRiskLevel()), YqOpinion::getRiskLevel, q.getRiskLevel());
        lqw.eq(notBlank(q.getOpinionLevel()), YqOpinion::getOpinionLevel, q.getOpinionLevel());
        lqw.eq(notBlank(q.getSpreadLevel()), YqOpinion::getSpreadLevel, q.getSpreadLevel());
        if (notBlank(q.getRegionToken())) {
            // {0} 会编译成预编译占位符；INSTR 无通配语义，无需转义
            lqw.apply("INSTR(region, {0}) > 0", q.getRegionToken());
        }
        if (notBlank(q.getTopicToken())) {
            lqw.apply("INSTR(topic_tags, {0}) > 0", q.getTopicToken());
        }
        if (q.getTimeFrom() != null) {
            lqw.ge(YqOpinion::getPublishTime, q.getTimeFrom());
        }
        if (q.getTimeTo() != null) {
            lqw.lt(YqOpinion::getPublishTime, q.getTimeTo());
        }
        return lqw;
    }

    private static boolean notBlank(String v) {
        return v != null && !v.isBlank();
    }
}
