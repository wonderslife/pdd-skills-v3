package org.dromara.inspect.service.impl;

import cn.hutool.core.collection.CollUtil;
import cn.hutool.core.util.StrUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.exception.ServiceException;
import org.dromara.common.excel.utils.ExcelBuilder;
import org.dromara.inspect.domain.InspectArea;
import org.dromara.inspect.domain.InspectPoint;
import org.dromara.inspect.domain.InspectPointItem;
import org.dromara.inspect.domain.InspectRecord;
import org.dromara.inspect.domain.InspectRoom;
import org.dromara.inspect.domain.bo.InspectPointImportBo;
import org.dromara.inspect.domain.vo.PointImportRowVo;
import org.dromara.inspect.domain.vo.ScanPointVo;
import org.dromara.inspect.mapper.InspectAreaMapper;
import org.dromara.inspect.mapper.InspectPointItemMapper;
import org.dromara.inspect.mapper.InspectPointMapper;
import org.dromara.inspect.mapper.InspectRecordMapper;
import org.dromara.inspect.mapper.InspectRoomMapper;
import org.dromara.inspect.service.IInspectPointExtService;
import org.dromara.inspect.service.IQrCodeService;
import org.dromara.inspect.utils.InspectCycleUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * 点位扩展服务实现
 *
 * @author ruoyi
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InspectPointExtServiceImpl implements IInspectPointExtService {

    /** 单次最多处理条数（PRD：批量超限提示） */
    private static final int BATCH_LIMIT = 500;

    /** 批量导出二维码上限（PRD 模块 5 验收标准 4） */
    private static final int QR_EXPORT_LIMIT = 200;

    /** 单点位最多照片数 */
    private static final int MAX_PHOTO_PER_POINT = 5;

    private final InspectPointMapper pointMapper;
    private final InspectPointItemMapper pointItemMapper;
    private final InspectRoomMapper roomMapper;
    private final InspectAreaMapper areaMapper;
    private final InspectRecordMapper recordMapper;
    private final IQrCodeService qrCodeService;

    /* ==================== 新增 / 修改 ==================== */

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Long insertPoint(InspectPoint bo) {
        validatePoint(bo, null);
        bo.setPointId(null);
        // 点位编码留空时按 机房编码 + 日期 + 序号 自动生成
        if (StrUtil.isBlank(bo.getPointCode())) {
            InspectRoom room = roomMapper.selectById(bo.getRoomId());
            String roomCode = room == null ? "ROOM" : room.getRoomCode();
            bo.setPointCode(InspectCycleUtils.generatePointCode(roomCode, nextSeqOfRoom(bo.getRoomId())));
        }
        if (StrUtil.isBlank(bo.getStatus())) {
            bo.setStatus("active");
        }
        pointMapper.insert(bo);
        saveItems(bo);
        return bo.getPointId();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean updatePoint(InspectPoint bo) {
        if (bo.getPointId() == null) {
            throw new ServiceException("点位ID不能为空");
        }
        InspectPoint exists = pointMapper.selectById(bo.getPointId());
        if (exists == null) {
            throw new ServiceException("点位不存在或已删除");
        }
        validatePoint(bo, bo.getPointId());
        pointMapper.updateById(bo);
        // 巡检项全量覆盖：先软删旧项再写入新项
        pointItemMapper.delete(new LambdaQueryWrapper<InspectPointItem>()
            .eq(InspectPointItem::getPointId, bo.getPointId()));
        saveItems(bo);
        return Boolean.TRUE;
    }

    /**
     * 点位校验：必填、编码全局唯一、同机房内名称唯一、巡检项非空、周期合法
     */
    private void validatePoint(InspectPoint bo, Long excludePointId) {
        if (bo.getRoomId() == null) {
            throw new ServiceException("所属机房不能为空");
        }
        if (StrUtil.isBlank(bo.getPointName())) {
            throw new ServiceException("点位名称不能为空");
        }
        if (CollUtil.isEmpty(bo.getItemList())) {
            throw new ServiceException("每个点位至少配置 1 个巡检项");
        }
        if (StrUtil.isBlank(bo.getCycleType())) {
            bo.setCycleType("daily");
        }
        if (!InspectCycleUtils.isValidCycleType(bo.getCycleType())) {
            throw new ServiceException("巡检周期类型不合法");
        }
        if ("custom".equals(bo.getCycleType())) {
            Integer v = bo.getCycleValue();
            if (v == null || v < 1 || v > 365) {
                throw new ServiceException("自定义间隔天数需在 1-365 之间");
            }
        } else {
            bo.setCycleValue(null);
        }

        // 机房存在性
        if (roomMapper.selectById(bo.getRoomId()) == null) {
            throw new ServiceException("所属机房不存在");
        }
        // 区域必须属于该机房
        if (bo.getAreaId() != null) {
            InspectArea area = areaMapper.selectById(bo.getAreaId());
            if (area == null || !area.getRoomId().equals(bo.getRoomId())) {
                throw new ServiceException("所选区域不属于该机房");
            }
        }
        // 编码全局唯一
        if (StrUtil.isNotBlank(bo.getPointCode())) {
            LambdaQueryWrapper<InspectPoint> codeQw = new LambdaQueryWrapper<InspectPoint>()
                .eq(InspectPoint::getPointCode, bo.getPointCode());
            if (excludePointId != null) {
                codeQw.ne(InspectPoint::getPointId, excludePointId);
            }
            if (pointMapper.selectCount(codeQw) > 0) {
                throw new ServiceException("该编码已存在");
            }
        }
        // 同机房内名称唯一
        LambdaQueryWrapper<InspectPoint> nameQw = new LambdaQueryWrapper<InspectPoint>()
            .eq(InspectPoint::getRoomId, bo.getRoomId())
            .eq(InspectPoint::getPointName, bo.getPointName());
        if (excludePointId != null) {
            nameQw.ne(InspectPoint::getPointId, excludePointId);
        }
        if (pointMapper.selectCount(nameQw) > 0) {
            throw new ServiceException("该机房下已存在同名点位");
        }
    }

    /**
     * 写入点位巡检项
     */
    private void saveItems(InspectPoint bo) {
        List<InspectPointItem> items = bo.getItemList();
        if (CollUtil.isEmpty(items)) {
            return;
        }
        int order = 1;
        for (InspectPointItem item : items) {
            item.setItemId(null);
            item.setPointId(bo.getPointId());
            item.setOrderNum(item.getOrderNum() == null ? order : item.getOrderNum());
            if (StrUtil.isBlank(item.getItemType())) {
                item.setItemType("radio");
            }
            if (StrUtil.isBlank(item.getRequired())) {
                item.setRequired("1");
            }
            pointItemMapper.insert(item);
            order++;
        }
    }

    /**
     * 机房内已有点位数量（用于自动生成编码序号）
     */
    private int nextSeqOfRoom(Long roomId) {
        Long count = pointMapper.selectCount(new LambdaQueryWrapper<InspectPoint>()
            .eq(InspectPoint::getRoomId, roomId));
        return (count == null ? 0 : count.intValue()) + 1;
    }

    /* ==================== 二维码 ==================== */

    @Override
    public byte[] generateQrCodePng(Long pointId) {
        InspectPoint point = pointMapper.selectById(pointId);
        if (point == null) {
            throw new ServiceException("点位不存在或已删除");
        }
        // 查看/下载二维码是管理动作，不按点位状态拦截：
        // 二维码内容只是加密后的 pointId，与状态无关；停用/维护中的点位仍然要能重新打印标签。
        // 巡检闭环里的「已停用」拦截在扫码解析(resolveScan)与记录提交处，不在这里。
        return qrCodeService.generatePng(qrCodeService.buildContent(pointId), 0, 0);
    }

    @Override
    public byte[] batchExportQrCodeZip(List<Long> pointIds) {
        if (CollUtil.isEmpty(pointIds)) {
            throw new ServiceException("请先勾选需要导出二维码的点位");
        }
        if (pointIds.size() > QR_EXPORT_LIMIT) {
            throw new ServiceException("单次最多处理 500 条,请分批操作");
        }
        List<InspectPoint> points = pointMapper.selectByIds(pointIds);
        if (CollUtil.isEmpty(points)) {
            throw new ServiceException("未找到可导出的点位");
        }
        // 与单点位二维码保持一致：不按状态过滤。
        // 二维码只是加密后的 pointId，停用/维护中的点位同样需要补打标签；
        // 原来的静默过滤还会让「勾了 5 个只导出 3 个」且毫无提示。
        List<InspectPoint> exportable = points;
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        Set<String> usedNames = new HashSet<>();
        try (ZipOutputStream zos = new ZipOutputStream(bos, StandardCharsets.UTF_8)) {
            for (InspectPoint p : exportable) {
                String name = buildUniqueEntryName(usedNames, p);
                zos.putNextEntry(new ZipEntry(name));
                byte[] png = qrCodeService.generatePng(qrCodeService.buildContent(p.getPointId()), 0, 0);
                zos.write(png);
                zos.closeEntry();
            }
        } catch (IOException e) {
            throw new ServiceException("二维码打包失败: " + e.getMessage());
        }
        return bos.toByteArray();
    }

    private String buildUniqueEntryName(Set<String> used, InspectPoint p) {
        String base = StrUtil.blankToDefault(p.getPointCode(), String.valueOf(p.getPointId()))
            .replaceAll("[\\\\/:*?\"<>|]", "_");
        String name = base + ".png";
        int i = 1;
        while (!used.add(name)) {
            name = base + "_" + (i++) + ".png";
        }
        return name;
    }

    /* ==================== Excel 导入 ==================== */

    @Override
    public List<InspectPointImportBo> importTemplateSample() {
        InspectPointImportBo sample = new InspectPointImportBo();
        sample.setPointName("1号机柜-温度");
        sample.setRoomCode("ROOM-A3");
        sample.setAreaName("机柜区");
        sample.setPointCode("PT-A3-001");
        sample.setLocation("A行3列");
        sample.setCycleType("daily");
        sample.setItemNames("温度,湿度,指示灯");
        return Collections.singletonList(sample);
    }

    @Override
    public List<PointImportRowVo> importData(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ServiceException("请选择要导入的 Excel 文件");
        }
        List<InspectPointImportBo> rows;
        try (InputStream is = file.getInputStream()) {
            rows = ExcelBuilder.read(is, InspectPointImportBo.class)
                .validate(false).failFast(false).doReadSync();
        } catch (IOException e) {
            throw new ServiceException("Excel 解析失败: " + e.getMessage());
        } catch (Exception e) {
            throw new ServiceException("模板格式错误,请下载最新模板");
        }
        if (CollUtil.isEmpty(rows)) {
            throw new ServiceException("Excel 中没有可导入的数据行");
        }
        if (rows.size() > BATCH_LIMIT) {
            throw new ServiceException("单次最多处理 500 条,请分批操作");
        }

        // 预载机房 / 区域 / 已有点位编码，避免逐行查库
        Map<String, InspectRoom> roomByCode = roomMapper.selectList(null).stream()
            .filter(r -> StrUtil.isNotBlank(r.getRoomCode()))
            .collect(Collectors.toMap(r -> r.getRoomCode().trim().toUpperCase(), Function.identity(), (a, b) -> a));
        Map<String, InspectArea> areaByRoomAndName = new HashMap<>();
        for (InspectArea a : areaMapper.selectList(null)) {
            areaByRoomAndName.put(a.getRoomId() + "#" + a.getAreaName(), a);
        }
        Set<String> existedCodes = pointMapper.selectList(null).stream()
            .map(InspectPoint::getPointCode).filter(StrUtil::isNotBlank)
            .map(String::toUpperCase).collect(Collectors.toCollection(HashSet::new));
        Set<String> existedNames = pointMapper.selectList(null).stream()
            .map(p -> p.getRoomId() + "#" + p.getPointName())
            .collect(Collectors.toCollection(HashSet::new));

        List<PointImportRowVo> results = new ArrayList<>(rows.size());
        Set<String> seenCodes = new HashSet<>();
        Set<String> seenNames = new HashSet<>();

        int rowNum = 2;
        for (InspectPointImportBo row : rows) {
            PointImportRowVo vo = new PointImportRowVo();
            vo.setRowNum(rowNum++);
            vo.setPointName(StrUtil.trim(row.getPointName()));
            vo.setPointCode(StrUtil.trim(row.getPointCode()));
            vo.setRoomName(StrUtil.trim(row.getRoomCode()));
            vo.setLocation(StrUtil.trim(row.getLocation()));
            vo.setCycleType(StrUtil.trim(row.getCycleType()));
            vo.setCycleValue(row.getCycleValue());
            vo.setItemNames(StrUtil.trim(row.getItemNames()));

            List<String> errors = new ArrayList<>();
            if (StrUtil.isBlank(vo.getPointName())) {
                errors.add("点位名称不能为空");
            }
            if (StrUtil.isBlank(row.getRoomCode())) {
                errors.add("机房编码不能为空");
            }
            String cycleType = StrUtil.blankToDefault(vo.getCycleType(), "daily");
            if (!InspectCycleUtils.isValidCycleType(cycleType)) {
                errors.add("巡检周期只能是 daily/weekly/monthly/custom");
            }
            if ("custom".equals(cycleType)
                && (vo.getCycleValue() == null || vo.getCycleValue() < 1 || vo.getCycleValue() > 365)) {
                errors.add("自定义间隔天数需在 1-365 之间");
            }
            if (CollUtil.isEmpty(splitItems(vo.getItemNames()))) {
                errors.add("每个点位至少配置 1 个巡检项");
            }

            InspectRoom room = null;
            if (StrUtil.isNotBlank(row.getRoomCode())) {
                room = roomByCode.get(row.getRoomCode().trim().toUpperCase());
                if (room == null) {
                    errors.add("机房编码不存在");
                }
            }
            Long roomId = room == null ? null : room.getRoomId();
            Long areaId = null;
            if (roomId != null && StrUtil.isNotBlank(row.getAreaName())) {
                InspectArea area = areaByRoomAndName.get(roomId + "#" + row.getAreaName().trim());
                if (area == null) {
                    errors.add("区域名称在该机房下不存在");
                } else {
                    areaId = area.getAreaId();
                }
            }
            if (StrUtil.isNotBlank(vo.getPointCode())) {
                String code = vo.getPointCode().toUpperCase();
                if (existedCodes.contains(code)) {
                    errors.add("该编码已存在");
                } else if (!seenCodes.add(code)) {
                    errors.add("文件内点位编码重复");
                }
            }
            if (roomId != null && StrUtil.isNotBlank(vo.getPointName())) {
                String key = roomId + "#" + vo.getPointName();
                if (existedNames.contains(key)) {
                    errors.add("该机房下已存在同名点位");
                } else if (!seenNames.add(key)) {
                    errors.add("文件内同机房点位名称重复");
                }
            }

            vo.setRoomId(roomId);
            vo.setAreaId(areaId);
            vo.setCycleType(cycleType);
            vo.setSuccess(errors.isEmpty());
            vo.setMessage(errors.isEmpty() ? "校验通过" : String.join("；", errors));
            results.add(vo);
        }
        return results;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Integer importConfirm(List<PointImportRowVo> rows) {
        if (CollUtil.isEmpty(rows)) {
            throw new ServiceException("没有可导入的数据行");
        }
        List<PointImportRowVo> ok = rows.stream()
            .filter(r -> Boolean.TRUE.equals(r.getSuccess()))
            .toList();
        if (CollUtil.isEmpty(ok)) {
            throw new ServiceException("没有校验通过的数据行");
        }
        if (ok.size() > BATCH_LIMIT) {
            throw new ServiceException("单次最多处理 500 条,请分批操作");
        }
        int inserted = 0;
        for (PointImportRowVo row : ok) {
            InspectPoint point = new InspectPoint();
            point.setRoomId(row.getRoomId());
            point.setAreaId(row.getAreaId());
            point.setPointName(row.getPointName());
            point.setPointCode(row.getPointCode());
            point.setLocation(row.getLocation());
            point.setCycleType(row.getCycleType());
            point.setCycleValue(row.getCycleValue());
            point.setStatus("active");
            point.setGpsEnabled(null);
            // 逐行复用 insertPoint 的校验与巡检项写入（编码留空则自动生成）
            insertPoint(point);
            inserted++;
        }
        return inserted;
    }

    private List<String> splitItems(String itemNames) {
        if (StrUtil.isBlank(itemNames)) {
            return Collections.emptyList();
        }
        return java.util.Arrays.stream(itemNames.split("[,，、;；]"))
            .map(String::trim).filter(StrUtil::isNotBlank).toList();
    }

    /* ==================== 扫码 / 查询 ==================== */

    @Override
    public ScanPointVo resolveScan(String content) {
        if (StrUtil.isBlank(content)) {
            throw new ServiceException("二维码无效,请手动输入点位编码");
        }
        String token = content.trim();
        Long pointId = qrCodeService.resolvePointId(token);
        InspectPoint point;
        if (pointId != null) {
            point = pointMapper.selectById(pointId);
            if (point == null) {
                throw new ServiceException("二维码无效,请手动输入点位编码");
            }
        } else if (looksLikeQrPayload(token)) {
            // 形似二维码内容但解不出来 —— 视为被篡改（PRD 模块 7 验收标准 8）
            throw new ServiceException("二维码无效,请手动输入点位编码");
        } else {
            // 手动输入点位编码兜底（PRD 模块 7 验收标准 6）
            point = pointMapper.selectOne(new LambdaQueryWrapper<InspectPoint>()
                .eq(InspectPoint::getPointCode, token)
                .last("limit 1"));
            if (point == null) {
                throw new ServiceException("点位不存在");
            }
        }
        if ("inactive".equals(point.getStatus())) {
            throw new ServiceException("该点位已停用,本次巡检无法提交");
        }
        if ("maintenance".equals(point.getStatus())) {
            throw new ServiceException("该点位维护中");
        }
        return buildScanVo(point, true);
    }

    /**
     * 判断入参是否「形似二维码内容」：URL 形式、带 p/code 参数，或长度较长的 Base64 串。
     * 用于区分「二维码被篡改」与「用户手输了不存在的点位编码」，以便给出不同提示。
     */
    private boolean looksLikeQrPayload(String token) {
        if (StrUtil.isBlank(token)) {
            return false;
        }
        String lower = token.toLowerCase();
        if (lower.startsWith("http://") || lower.startsWith("https://")
            || lower.contains("p=") || lower.contains("code=")) {
            return true;
        }
        // 纯 Base64（含 URL 安全字符）且长度超过点位编码的合理范围，判为二维码载荷
        return token.length() > 24 && token.matches("[A-Za-z0-9\\-_+/=]+");
    }

    @Override
    public ScanPointVo queryDetailWithItems(Long pointId) {
        InspectPoint point = pointMapper.selectById(pointId);
        if (point == null) {
            throw new ServiceException("点位不存在或已删除");
        }
        return buildScanVo(point, true);
    }

    @Override
    public List<ScanPointVo> myPointList() {
        // TODO 数据权限：PRD 要求「本人所属机房的点位」，需与若依部门/机房映射打通后加过滤条件
        List<InspectPoint> points = pointMapper.selectList(new LambdaQueryWrapper<InspectPoint>()
            .eq(InspectPoint::getStatus, "active")
            .orderByAsc(InspectPoint::getRoomId)
            .orderByAsc(InspectPoint::getPointName));
        return points.stream().map(p -> buildScanVo(p, false)).toList();
    }

    /**
     * 组装扫码视图（含机房/区域名称、巡检项、本周期是否已巡检）
     */
    private ScanPointVo buildScanVo(InspectPoint point, boolean withItems) {
        ScanPointVo vo = new ScanPointVo();
        vo.setPointId(point.getPointId());
        vo.setPointName(point.getPointName());
        vo.setPointCode(point.getPointCode());
        vo.setRoomId(point.getRoomId());
        vo.setAreaId(point.getAreaId());
        vo.setLocation(point.getLocation());
        vo.setCycleType(point.getCycleType());
        vo.setCycleValue(point.getCycleValue());
        vo.setGpsEnabled(point.getGpsEnabled());
        vo.setStatus(point.getStatus());
        vo.setLastInspectTime(point.getLastInspectTime());

        InspectRoom room = point.getRoomId() == null ? null : roomMapper.selectById(point.getRoomId());
        vo.setRoomName(room == null ? null : room.getRoomName());
        if (point.getAreaId() != null) {
            InspectArea area = areaMapper.selectById(point.getAreaId());
            vo.setAreaName(area == null ? null : area.getAreaName());
        }
        if (withItems) {
            vo.setItemList(pointItemMapper.selectList(new LambdaQueryWrapper<InspectPointItem>()
                .eq(InspectPointItem::getPointId, point.getPointId())
                .orderByAsc(InspectPointItem::getOrderNum)));
        }
        LocalDateTime start = InspectCycleUtils.cycleStart(point.getCycleType(), point.getCycleValue(), LocalDateTime.now());
        Long cnt = recordMapper.selectCount(new LambdaQueryWrapper<InspectRecord>()
            .eq(InspectRecord::getPointId, point.getPointId())
            .ge(InspectRecord::getInspectTime, start));
        vo.setInspectedInCycle(cnt != null && cnt > 0);
        vo.setStatusTip("maintenance".equals(point.getStatus()) ? "该点位维护中" : null);
        return vo;
    }

}
