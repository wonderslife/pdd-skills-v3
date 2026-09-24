package org.dromara.inspect.service.impl;

import cn.hutool.core.collection.CollUtil;
import cn.hutool.core.util.StrUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.exception.ServiceException;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.satoken.utils.LoginHelper;
import org.dromara.inspect.domain.InspectAbnormal;
import org.dromara.inspect.domain.InspectPhoto;
import org.dromara.inspect.domain.InspectPoint;
import org.dromara.inspect.domain.InspectRecord;
import org.dromara.inspect.domain.InspectRecordItem;
import org.dromara.inspect.domain.InspectRoom;
import org.dromara.inspect.mapper.InspectAbnormalMapper;
import org.dromara.inspect.mapper.InspectPhotoMapper;
import org.dromara.inspect.mapper.InspectPointMapper;
import org.dromara.inspect.mapper.InspectRecordItemMapper;
import org.dromara.inspect.mapper.InspectRecordMapper;
import org.dromara.inspect.mapper.InspectRoomMapper;
import org.dromara.inspect.service.IInspectAbnormalExtService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 异常项服务实现
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class InspectAbnormalExtServiceImpl implements IInspectAbnormalExtService {

    private final InspectAbnormalMapper abnormalMapper;
    private final InspectRecordMapper recordMapper;
    private final InspectRecordItemMapper recordItemMapper;
    private final InspectPhotoMapper photoMapper;
    private final InspectPointMapper pointMapper;
    private final InspectRoomMapper roomMapper;

    @Override
    public PageResult<InspectAbnormal> queryPageListWithNames(InspectAbnormal bo, PageQuery pageQuery) {
        LambdaQueryWrapper<InspectAbnormal> lqw = buildWrapper(bo);
        Page<InspectAbnormal> page = abnormalMapper.selectPage(pageQuery.build(), lqw);
        enrich(page.getRecords(), false);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<InspectAbnormal> queryExportList(InspectAbnormal bo) {
        List<InspectAbnormal> list = abnormalMapper.selectList(buildWrapper(bo));
        enrich(list, false);
        return list;
    }

    @Override
    public InspectAbnormal queryDetail(Long abnormalId) {
        InspectAbnormal abnormal = abnormalMapper.selectById(abnormalId);
        if (abnormal == null) {
            throw new ServiceException("异常项不存在");
        }
        enrich(Collections.singletonList(abnormal), true);
        return abnormal;
    }

    @Override
    public Boolean process(Long abnormalId, String processRemark) {
        if (StrUtil.isBlank(processRemark)) {
            throw new ServiceException("请填写处理说明");
        }
        InspectAbnormal abnormal = abnormalMapper.selectById(abnormalId);
        if (abnormal == null) {
            throw new ServiceException("异常项不存在");
        }
        if ("processed".equals(abnormal.getStatus())) {
            throw new ServiceException("该异常项已处理，无需重复操作");
        }
        InspectAbnormal update = new InspectAbnormal();
        update.setAbnormalId(abnormalId);
        update.setStatus("processed");
        update.setProcessRemark(processRemark);
        update.setProcessBy(LoginHelper.getUserId());
        update.setProcessTime(LocalDateTime.now());
        abnormalMapper.updateById(update);
        return Boolean.TRUE;
    }

    private LambdaQueryWrapper<InspectAbnormal> buildWrapper(InspectAbnormal bo) {
        LambdaQueryWrapper<InspectAbnormal> lqw = new LambdaQueryWrapper<>();
        if (bo == null) {
            return lqw.orderByDesc(InspectAbnormal::getCreateTime);
        }
        lqw.eq(StrUtil.isNotBlank(bo.getStatus()), InspectAbnormal::getStatus, bo.getStatus());
        lqw.eq(bo.getRoomId() != null, InspectAbnormal::getRoomId, bo.getRoomId());
        lqw.eq(bo.getPointId() != null, InspectAbnormal::getPointId, bo.getPointId());
        lqw.eq(bo.getRecordId() != null, InspectAbnormal::getRecordId, bo.getRecordId());
        // 生成时间区间（params.beginTime / endTime，与若依 v6 前端 dateRange 约定一致）
        Map<String, Object> params = bo.getParams();
        if (params != null) {
            Object begin = params.get("beginTime");
            Object end = params.get("endTime");
            if (begin != null && StrUtil.isNotBlank(String.valueOf(begin))) {
                lqw.ge(InspectAbnormal::getCreateTime, String.valueOf(begin).length() <= 10
                    ? String.valueOf(begin) + " 00:00:00" : String.valueOf(begin));
            }
            if (end != null && StrUtil.isNotBlank(String.valueOf(end))) {
                lqw.le(InspectAbnormal::getCreateTime, String.valueOf(end).length() <= 10
                    ? String.valueOf(end) + " 23:59:59" : String.valueOf(end));
            }
        }
        // 待处理优先置顶（PRD：异常记录列表置顶/红标显示）
        lqw.orderByAsc(InspectAbnormal::getStatus).orderByDesc(InspectAbnormal::getCreateTime);
        return lqw;
    }

    /**
     * 补齐点位/机房名称、巡检时间、异常说明与照片
     *
     * @param withPhotos 是否加载现场照片 URL
     */
    private void enrich(List<InspectAbnormal> list, boolean withPhotos) {
        if (CollUtil.isEmpty(list)) {
            return;
        }
        Set<Long> pointIds = new HashSet<>();
        Set<Long> roomIds = new HashSet<>();
        Set<Long> recordIds = new HashSet<>();
        Set<Long> recordItemIds = new HashSet<>();
        for (InspectAbnormal a : list) {
            if (a.getPointId() != null) {
                pointIds.add(a.getPointId());
            }
            if (a.getRoomId() != null) {
                roomIds.add(a.getRoomId());
            }
            if (a.getRecordId() != null) {
                recordIds.add(a.getRecordId());
            }
            if (a.getRecordItemId() != null) {
                recordItemIds.add(a.getRecordItemId());
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
        Map<Long, InspectRecord> records = new HashMap<>();
        if (!recordIds.isEmpty()) {
            for (InspectRecord r : recordMapper.selectByIds(recordIds)) {
                records.put(r.getRecordId(), r);
            }
        }
        Map<Long, InspectRecordItem> items = new HashMap<>();
        if (!recordItemIds.isEmpty()) {
            for (InspectRecordItem i : recordItemMapper.selectByIds(recordItemIds)) {
                items.put(i.getRecordItemId(), i);
            }
        }
        Map<Long, List<String>> photoUrls = new HashMap<>();
        if (withPhotos && !recordItemIds.isEmpty()) {
            List<InspectPhoto> photos = photoMapper.selectList(new LambdaQueryWrapper<InspectPhoto>()
                .in(InspectPhoto::getRecordItemId, recordItemIds));
            for (InspectPhoto p : photos) {
                photoUrls.computeIfAbsent(p.getRecordItemId(), k -> new ArrayList<>())
                    .add(StrUtil.blankToDefault(p.getCompressedUrl(), p.getOriginalUrl()));
            }
        }
        for (InspectAbnormal a : list) {
            a.setPointName(pointNames.get(a.getPointId()));
            a.setRoomName(roomNames.get(a.getRoomId()));
            InspectRecord record = records.get(a.getRecordId());
            if (record != null) {
                a.setInspectTime(record.getInspectTime());
            }
            InspectRecordItem item = items.get(a.getRecordItemId());
            if (item != null) {
                a.setItemName(item.getItemName());
                a.setDescription(item.getDescription());
            }
            if (withPhotos) {
                a.setPhotoUrls(photoUrls.getOrDefault(a.getRecordItemId(), Collections.emptyList()));
            }
        }
    }

}
