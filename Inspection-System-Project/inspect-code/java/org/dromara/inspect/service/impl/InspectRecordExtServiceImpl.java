package org.dromara.inspect.service.impl;

import cn.hutool.core.collection.CollUtil;
import cn.hutool.core.util.StrUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
import org.dromara.inspect.domain.bo.InspectRecordSubmitBo;
import org.dromara.inspect.mapper.InspectAbnormalMapper;
import org.dromara.inspect.mapper.InspectPhotoMapper;
import org.dromara.inspect.mapper.InspectPointMapper;
import org.dromara.inspect.mapper.InspectRecordItemMapper;
import org.dromara.inspect.mapper.InspectRecordMapper;
import org.dromara.inspect.mapper.InspectRoomMapper;
import org.dromara.inspect.service.IInspectRecordExtService;
import org.dromara.inspect.utils.InspectCycleUtils;
import org.dromara.system.domain.SysOssExt;
import org.dromara.system.domain.vo.SysOssVo;
import org.dromara.system.domain.vo.SysUserVo;
import org.dromara.system.service.ISysOssService;
import org.dromara.system.service.ISysUserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 巡检记录扩展服务实现
 *
 * @author ruoyi
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InspectRecordExtServiceImpl implements IInspectRecordExtService {

    /** 单点位最多照片数（PRD 模块 8 验收标准 5） */
    private static final int MAX_PHOTO_PER_POINT = 5;

    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final InspectRecordMapper recordMapper;
    private final InspectRecordItemMapper recordItemMapper;
    private final InspectPhotoMapper photoMapper;
    private final InspectAbnormalMapper abnormalMapper;
    private final InspectPointMapper pointMapper;
    private final InspectRoomMapper roomMapper;
    private final ISysOssService ossService;
    private final ISysUserService userService;

    /* ==================== 提交 / 补录 ==================== */

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Long submitRecord(InspectRecordSubmitBo bo, boolean supplement) {
        if (bo == null || bo.getPointId() == null) {
            throw new ServiceException("点位ID不能为空");
        }
        InspectPoint point = pointMapper.selectById(bo.getPointId());
        if (point == null) {
            throw new ServiceException("二维码无效,请手动输入点位编码");
        }
        if ("inactive".equals(point.getStatus())) {
            throw new ServiceException("该点位已停用,本次巡检无法提交");
        }
        if ("maintenance".equals(point.getStatus())) {
            throw new ServiceException("该点位维护中");
        }
        List<InspectRecordSubmitBo.ItemResult> itemResults = bo.getItemResults();
        if (CollUtil.isEmpty(itemResults)) {
            throw new ServiceException("巡检项结果不能为空");
        }

        // ---- 逐项校验 ----
        int abnormalCount = 0;
        int totalPhotos = 0;
        for (InspectRecordSubmitBo.ItemResult it : itemResults) {
            String result = StrUtil.blankToDefault(it.getResult(), "");
            if (!isValidItemResult(result)) {
                throw new ServiceException("巡检项判定结果不合法");
            }
            List<InspectRecordSubmitBo.Photo> photos = it.getPhotos() == null ? Collections.emptyList() : it.getPhotos();
            totalPhotos += photos.stream().filter(p -> StrUtil.isNotBlank(p.getCompressedUrl())).count();
            if ("abnormal".equals(result)) {
                if (StrUtil.isBlank(it.getDescription())) {
                    throw new ServiceException("请填写异常说明");
                }
                if (photos.stream().noneMatch(p -> StrUtil.isNotBlank(p.getCompressedUrl()))) {
                    throw new ServiceException("异常项必须上传至少 1 张照片");
                }
                abnormalCount++;
            }
        }
        if (totalPhotos > MAX_PHOTO_PER_POINT) {
            throw new ServiceException("单点位最多上传 5 张照片");
        }
        if (supplement && StrUtil.isBlank(bo.getSupplementReason())) {
            throw new ServiceException("请填写补录原因");
        }

        // ---- 重复巡检校验（仅 H5 现场提交）----
        if (!supplement) {
            LocalDateTime start = InspectCycleUtils.cycleStart(point.getCycleType(), point.getCycleValue(), LocalDateTime.now());
            Long cnt = recordMapper.selectCount(new LambdaQueryWrapper<InspectRecord>()
                .eq(InspectRecord::getPointId, point.getPointId())
                .ge(InspectRecord::getInspectTime, start));
            if (cnt != null && cnt > 0) {
                throw new ServiceException("本周期已巡检");
            }
        }

        // ---- 巡检时间与巡检员 ----
        LocalDateTime inspectTime = LocalDateTime.now();
        if (supplement && StrUtil.isNotBlank(bo.getInspectTime())) {
            inspectTime = parseDateTime(bo.getInspectTime());
            if (inspectTime.isAfter(LocalDateTime.now())) {
                throw new ServiceException("巡检时间不能晚于当前时间");
            }
        }
        Long inspectorId = LoginHelper.getUserId();
        if (supplement && bo.getInspectorId() != null) {
            inspectorId = bo.getInspectorId();
        }
        if (inspectorId == null) {
            throw new ServiceException("无法识别巡检员,请重新登录");
        }

        // ---- 写记录主表 ----
        InspectRecord record = new InspectRecord();
        record.setPointId(point.getPointId());
        record.setRoomId(point.getRoomId());
        record.setInspectorId(inspectorId);
        record.setInspectTime(inspectTime);
        record.setDuration(bo.getDuration());
        record.setResult(abnormalCount > 0 ? "completed_abnormal" : "completed_normal");
        record.setAbnormalCount(abnormalCount);
        record.setSource(supplement ? "pc_supplement" : "h5_scan");
        record.setRemark(bo.getRemark());
        recordMapper.insert(record);
        Long recordId = record.getRecordId();

        // ---- 写巡检项结果 / 照片 / 异常项 ----
        int order = 1;
        for (InspectRecordSubmitBo.ItemResult it : itemResults) {
            InspectRecordItem item = new InspectRecordItem();
            item.setRecordId(recordId);
            item.setItemId(it.getItemId());
            item.setItemName(StrUtil.blankToDefault(it.getItemName(), "巡检项"));
            item.setResult(it.getResult());
            item.setValue(it.getValue());
            item.setDescription(it.getDescription());
            item.setOrderNum(it.getOrderNum() != null ? it.getOrderNum() : order);
            recordItemMapper.insert(item);
            order++;

            List<InspectRecordSubmitBo.Photo> photos = it.getPhotos() == null ? Collections.emptyList() : it.getPhotos();
            for (InspectRecordSubmitBo.Photo p : photos) {
                InspectPhoto photo = new InspectPhoto();
                photo.setRecordId(recordId);
                photo.setRecordItemId(item.getRecordItemId());
                photo.setOriginalUrl(p.getOriginalUrl());
                photo.setOriginalSize(p.getOriginalSize());
                photo.setCompressedUrl(p.getCompressedUrl());
                photo.setCompressedSize(p.getCompressedSize());
                photo.setFileName(p.getFileName());
                photoMapper.insert(photo);
            }

            if ("abnormal".equals(it.getResult())) {
                InspectAbnormal abnormal = new InspectAbnormal();
                abnormal.setRecordId(recordId);
                abnormal.setRecordItemId(item.getRecordItemId());
                abnormal.setPointId(point.getPointId());
                abnormal.setRoomId(point.getRoomId());
                abnormal.setStatus("pending");
                abnormalMapper.insert(abnormal);
            }
        }

        // ---- 回写点位上次巡检时间 ----
        InspectPoint update = new InspectPoint();
        update.setPointId(point.getPointId());
        update.setLastInspectTime(inspectTime);
        pointMapper.updateById(update);

        return recordId;
    }

    private boolean isValidItemResult(String result) {
        return "normal".equals(result) || "abnormal".equals(result) || "na".equals(result);
    }

    private LocalDateTime parseDateTime(String text) {
        try {
            return LocalDateTime.parse(text.trim(), DATE_TIME_FORMATTER);
        } catch (Exception e) {
            throw new ServiceException("巡检时间格式应为 yyyy-MM-dd HH:mm:ss");
        }
    }

    /* ==================== 照片上传 ==================== */

    @Override
    public Map<String, Object> uploadPhoto(MultipartFile original, MultipartFile compressed) {
        if (original == null || original.isEmpty()) {
            throw new ServiceException("原图不能为空");
        }
        SysOssExt ext = new SysOssExt();
        ext.setBizType("inspect");
        ext.setSource("inspect-photo");

        SysOssVo originalVo = ossService.upload(original, ext);
        SysOssVo compressedVo = compressed == null || compressed.isEmpty()
            ? originalVo
            : ossService.upload(compressed, ext);

        Map<String, Object> result = new LinkedHashMap<>(6);
        result.put("originalUrl", originalVo.getUrl());
        result.put("originalSize", original.getSize());
        result.put("compressedUrl", compressedVo.getUrl());
        result.put("compressedSize", compressed == null || compressed.isEmpty() ? original.getSize() : compressed.getSize());
        result.put("fileName", originalVo.getOriginalName());
        return result;
    }

    /* ==================== 查询 ==================== */

    @Override
    public PageResult<InspectRecord> queryPageListWithNames(InspectRecord bo, PageQuery pageQuery) {
        Page<InspectRecord> page = recordMapper.selectPage(pageQuery.build(), buildWrapper(bo));
        enrich(page.getRecords());
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<InspectRecord> queryExportList(InspectRecord bo) {
        List<InspectRecord> list = recordMapper.selectList(buildWrapper(bo));
        enrich(list);
        return list;
    }

    @Override
    public PageResult<InspectRecord> queryMyRecords(InspectRecord bo, PageQuery pageQuery) {
        Long userId = LoginHelper.getUserId();
        if (userId == null) {
            throw new ServiceException("无法识别当前巡检员,请重新登录");
        }
        InspectRecord query = bo == null ? new InspectRecord() : bo;
        query.setInspectorId(userId);
        Page<InspectRecord> page = recordMapper.selectPage(pageQuery.build(), buildWrapper(query));
        enrich(page.getRecords());
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public InspectRecord queryDetail(Long recordId) {
        InspectRecord record = recordMapper.selectById(recordId);
        if (record == null) {
            throw new ServiceException("巡检记录不存在");
        }
        enrich(Collections.singletonList(record));
        // 巡检项结果 + 逐项照片
        List<InspectRecordItem> items = recordItemMapper.selectList(new LambdaQueryWrapper<InspectRecordItem>()
            .eq(InspectRecordItem::getRecordId, recordId)
            .orderByAsc(InspectRecordItem::getOrderNum));
        List<InspectPhoto> photos = photoMapper.selectList(new LambdaQueryWrapper<InspectPhoto>()
            .eq(InspectPhoto::getRecordId, recordId));
        Map<Long, List<InspectPhoto>> byItem = new HashMap<>();
        for (InspectPhoto p : photos) {
            byItem.computeIfAbsent(p.getRecordItemId(), k -> new ArrayList<>()).add(p);
        }
        for (InspectRecordItem item : items) {
            item.setPhotos(byItem.getOrDefault(item.getRecordItemId(), Collections.emptyList()));
        }
        record.setItemResults(items);
        record.setPhotos(photos);
        return record;
    }

    @Override
    public Boolean appendAdminRemark(Long recordId, String adminRemark) {
        if (StrUtil.isBlank(adminRemark)) {
            throw new ServiceException("请填写备注内容");
        }
        InspectRecord record = recordMapper.selectById(recordId);
        if (record == null) {
            throw new ServiceException("巡检记录不存在");
        }
        InspectRecord update = new InspectRecord();
        update.setRecordId(recordId);
        update.setAdminRemark(adminRemark);
        recordMapper.updateById(update);
        return Boolean.TRUE;
    }

    /**
     * 组装查询条件（PRD 4.3 巡检记录表格筛选列）
     */
    private LambdaQueryWrapper<InspectRecord> buildWrapper(InspectRecord bo) {
        LambdaQueryWrapper<InspectRecord> lqw = new LambdaQueryWrapper<>();
        if (bo == null) {
            return lqw.orderByDesc(InspectRecord::getInspectTime);
        }
        lqw.eq(bo.getRoomId() != null, InspectRecord::getRoomId, bo.getRoomId());
        lqw.eq(bo.getPointId() != null, InspectRecord::getPointId, bo.getPointId());
        lqw.eq(bo.getInspectorId() != null, InspectRecord::getInspectorId, bo.getInspectorId());
        lqw.eq(StrUtil.isNotBlank(bo.getResult()), InspectRecord::getResult, bo.getResult());
        lqw.eq(StrUtil.isNotBlank(bo.getSource()), InspectRecord::getSource, bo.getSource());
        // 巡检时间区间（params.beginTime / endTime，与若依 v6 前端 addDateRange 约定一致）
        Map<String, Object> params = bo.getParams();
        if (params != null) {
            Object begin = params.get("beginTime");
            Object end = params.get("endTime");
            if (begin != null && StrUtil.isNotBlank(String.valueOf(begin))) {
                lqw.ge(InspectRecord::getInspectTime, String.valueOf(begin).length() <= 10
                    ? String.valueOf(begin) + " 00:00:00" : String.valueOf(begin));
            }
            if (end != null && StrUtil.isNotBlank(String.valueOf(end))) {
                lqw.le(InspectRecord::getInspectTime, String.valueOf(end).length() <= 10
                    ? String.valueOf(end) + " 23:59:59" : String.valueOf(end));
            }
        }
        lqw.orderByDesc(InspectRecord::getInspectTime);
        return lqw;
    }

    /**
     * 批量补齐点位 / 机房 / 巡检员名称，避免逐行查库
     */
    private void enrich(List<InspectRecord> records) {
        if (CollUtil.isEmpty(records)) {
            return;
        }
        Set<Long> pointIds = new HashSet<>();
        Set<Long> roomIds = new HashSet<>();
        Set<Long> userIds = new HashSet<>();
        for (InspectRecord r : records) {
            if (r.getPointId() != null) {
                pointIds.add(r.getPointId());
            }
            if (r.getRoomId() != null) {
                roomIds.add(r.getRoomId());
            }
            if (r.getInspectorId() != null) {
                userIds.add(r.getInspectorId());
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
        Map<Long, String> userNames = new HashMap<>();
        if (!userIds.isEmpty()) {
            List<SysUserVo> users = userService.selectUserByIds(userIds, null);
            if (CollUtil.isNotEmpty(users)) {
                for (SysUserVo u : users) {
                    userNames.put(u.getUserId(), StrUtil.blankToDefault(u.getNickName(), u.getUserName()));
                }
            }
        }
        for (InspectRecord r : records) {
            r.setPointName(pointNames.get(r.getPointId()));
            r.setRoomName(roomNames.get(r.getRoomId()));
            r.setInspectorName(userNames.get(r.getInspectorId()));
        }
    }

}
