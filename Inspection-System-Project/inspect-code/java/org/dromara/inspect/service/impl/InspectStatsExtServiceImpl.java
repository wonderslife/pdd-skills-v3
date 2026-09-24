package org.dromara.inspect.service.impl;

import cn.hutool.core.collection.CollUtil;
import cn.hutool.core.util.StrUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.exception.ServiceException;
import org.dromara.inspect.domain.InspectAbnormal;
import org.dromara.inspect.domain.InspectPoint;
import org.dromara.inspect.domain.InspectRoom;
import org.dromara.inspect.domain.vo.StatsPointRankVo;
import org.dromara.inspect.domain.vo.StatsTrendVo;
import org.dromara.inspect.mapper.InspectAbnormalMapper;
import org.dromara.inspect.mapper.InspectPointMapper;
import org.dromara.inspect.mapper.InspectRecordMapper;
import org.dromara.inspect.mapper.InspectRoomMapper;
import org.dromara.inspect.service.IInspectStatsExtService;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 统计报表服务实现
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class InspectStatsExtServiceImpl implements IInspectStatsExtService {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    /** 排名默认条数 */
    private static final int DEFAULT_RANK_LIMIT = 20;

    private final InspectRecordMapper recordMapper;
    private final InspectAbnormalMapper abnormalMapper;
    private final InspectPointMapper pointMapper;
    private final InspectRoomMapper roomMapper;

    @Override
    public List<StatsTrendVo> trend(String granularity, String beginDate, String endDate, Long roomId) {
        String groupExpr = switch (StrUtil.blankToDefault(granularity, "day")) {
            case "week" -> "date_format(inspect_time, '%x-W%v')";
            case "month" -> "date_format(inspect_time, '%Y-%m')";
            default -> "date_format(inspect_time, '%Y-%m-%d')";
        };
        QueryWrapper<org.dromara.inspect.domain.InspectRecord> qw = new QueryWrapper<>();
        qw.select(groupExpr + " as dateLabel",
            "count(1) as inspectCount",
            "sum(case when abnormal_count > 0 then 1 else 0 end) as abnormalCount");
        applyRange(qw, beginDate, endDate);
        if (roomId != null) {
            qw.eq("room_id", roomId);
        }
        qw.groupBy(groupExpr).orderByAsc(groupExpr);

        List<Map<String, Object>> rows = recordMapper.selectMaps(qw);
        List<StatsTrendVo> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            StatsTrendVo vo = new StatsTrendVo();
            vo.setDateLabel(str(row.get("dateLabel")));
            int inspectCount = intVal(row.get("inspectCount"));
            int abnormalCount = intVal(row.get("abnormalCount"));
            vo.setInspectCount(inspectCount);
            vo.setAbnormalCount(abnormalCount);
            vo.setOverdueCount(0);
            vo.setAbnormalRate(rate(abnormalCount, inspectCount));
            result.add(vo);
        }
        return result;
    }

    @Override
    public List<StatsPointRankVo> pointRank(String beginDate, String endDate, Long roomId, Integer limit) {
        QueryWrapper<org.dromara.inspect.domain.InspectRecord> qw = new QueryWrapper<>();
        qw.select("point_id as pointId",
            "room_id as roomId",
            "count(1) as inspectCount",
            "sum(case when abnormal_count > 0 then 1 else 0 end) as abnormalCount");
        applyRange(qw, beginDate, endDate);
        if (roomId != null) {
            qw.eq("room_id", roomId);
        }
        int top = (limit == null || limit < 1) ? DEFAULT_RANK_LIMIT : Math.min(limit, 200);
        qw.groupBy("point_id", "room_id").orderByDesc("inspectCount").last("limit " + top);

        List<Map<String, Object>> rows = recordMapper.selectMaps(qw);
        List<StatsPointRankVo> result = new ArrayList<>();
        if (CollUtil.isEmpty(rows)) {
            return result;
        }

        Set<Long> pointIds = new HashSet<>();
        Set<Long> roomIds = new HashSet<>();
        for (Map<String, Object> row : rows) {
            Long pid = longVal(row.get("pointId"));
            if (pid != null) {
                pointIds.add(pid);
            }
            Long rid = longVal(row.get("roomId"));
            if (rid != null) {
                roomIds.add(rid);
            }
        }
        Map<Long, String> pointNames = new HashMap<>();
        if (!pointIds.isEmpty()) {
            for (InspectPoint p : pointMapper.selectByIds(pointIds)) {
                pointNames.put(p.getPointId(), p.getPointName());
            }
        }
        Map<Long, String> roomNames = new HashMap<>();
        if (!roomIds.isEmpty()) {
            for (InspectRoom r : roomMapper.selectByIds(roomIds)) {
                roomNames.put(r.getRoomId(), r.getRoomName());
            }
        }

        for (Map<String, Object> row : rows) {
            StatsPointRankVo vo = new StatsPointRankVo();
            Long pid = longVal(row.get("pointId"));
            Long rid = longVal(row.get("roomId"));
            int inspectCount = intVal(row.get("inspectCount"));
            int abnormalCount = intVal(row.get("abnormalCount"));
            vo.setPointId(pid);
            vo.setPointName(pointNames.get(pid));
            vo.setRoomId(rid);
            vo.setRoomName(roomNames.get(rid));
            vo.setInspectCount(inspectCount);
            vo.setAbnormalCount(abnormalCount);
            vo.setAbnormalRate(rate(abnormalCount, inspectCount));
            result.add(vo);
        }
        return result;
    }

    @Override
    public Long unprocessedAbnormalCount(Long roomId) {
        return abnormalMapper.selectCount(new LambdaQueryWrapper<InspectAbnormal>()
            .eq(InspectAbnormal::getStatus, "pending")
            .eq(roomId != null, InspectAbnormal::getRoomId, roomId));
    }

    /**
     * 时间区间条件；缺省为最近 30 天
     */
    private void applyRange(QueryWrapper<?> qw, String beginDate, String endDate) {
        LocalDate begin = parseDate(beginDate);
        LocalDate end = parseDate(endDate);
        if (begin == null) {
            begin = LocalDate.now().minusDays(29);
        }
        if (end == null) {
            end = LocalDate.now();
        }
        if (begin.isAfter(end)) {
            throw new ServiceException("开始日期不能晚于结束日期");
        }
        qw.ge("inspect_time", begin + " 00:00:00");
        qw.le("inspect_time", end + " 23:59:59");
    }

    private LocalDate parseDate(String text) {
        if (StrUtil.isBlank(text)) {
            return null;
        }
        try {
            return LocalDate.parse(text.trim(), DATE_FORMATTER);
        } catch (Exception e) {
            throw new ServiceException("日期格式应为 yyyy-MM-dd");
        }
    }

    private Integer intVal(Object v) {
        if (v == null) {
            return 0;
        }
        return Integer.parseInt(String.valueOf(v));
    }

    private Long longVal(Object v) {
        if (v == null) {
            return null;
        }
        return Long.parseLong(String.valueOf(v));
    }

    private String str(Object v) {
        return v == null ? "" : String.valueOf(v);
    }

    /**
     * 异常率（%，保留两位）
     */
    private BigDecimal rate(int abnormal, int total) {
        if (total <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return BigDecimal.valueOf(abnormal)
            .multiply(BigDecimal.valueOf(100))
            .divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP);
    }

}
