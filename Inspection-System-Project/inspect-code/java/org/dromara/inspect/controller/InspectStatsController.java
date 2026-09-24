package org.dromara.inspect.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.R;
import org.dromara.common.web.core.BaseController;
import org.dromara.inspect.domain.vo.StatsPointRankVo;
import org.dromara.inspect.domain.vo.StatsTrendVo;
import org.dromara.inspect.service.IInspectStatsExtService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 统计报表 Controller（PRD 模块 11）
 * <p>
 * 说明：与 {@link InspectStatsDailyController}（/inspect/statsDaily，预聚合表 CRUD）区分开，
 * 本控制器提供趋势 / 排名 / 异常数三个面向页面的聚合接口。
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/inspect/stats")
public class InspectStatsController extends BaseController {

    private final IInspectStatsExtService statsExtService;

    /**
     * 时间趋势（granularity=day/week/month）
     */
    @SaCheckPermission("inspect:stats:list")
    @GetMapping("/trend")
    public R<List<StatsTrendVo>> trend(@RequestParam(defaultValue = "day") String granularity,
                                       @RequestParam(required = false) String beginDate,
                                       @RequestParam(required = false) String endDate,
                                       @RequestParam(required = false) Long roomId) {
        return R.ok(statsExtService.trend(granularity, beginDate, endDate, roomId));
    }

    /**
     * 点位维度排名（默认取前 10）
     */
    @SaCheckPermission("inspect:stats:list")
    @GetMapping("/pointRank")
    public R<List<StatsPointRankVo>> pointRank(@RequestParam(required = false) String beginDate,
                                               @RequestParam(required = false) String endDate,
                                               @RequestParam(required = false) Long roomId,
                                               @RequestParam(required = false, defaultValue = "10") Integer limit) {
        return R.ok(statsExtService.pointRank(beginDate, endDate, roomId, limit));
    }

    /**
     * 未处理异常数（PRD 6.3 无权限码；登录后首页弹窗使用）
     */
    @GetMapping("/abnormalCount")
    public R<Long> abnormalCount(@RequestParam(required = false) Long roomId) {
        return R.ok(statsExtService.unprocessedAbnormalCount(roomId));
    }

}
