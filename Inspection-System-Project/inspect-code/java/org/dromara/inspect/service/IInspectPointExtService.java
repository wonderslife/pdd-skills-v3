package org.dromara.inspect.service;

import org.dromara.inspect.domain.InspectPoint;
import org.dromara.inspect.domain.vo.PointImportRowVo;
import org.dromara.inspect.domain.vo.ScanPointVo;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * 点位扩展服务
 * <p>
 * 覆盖生成器无法机械产出的业务（PRD 模块 3/4/5/7）：
 * - 新增/修改点位时一并写入巡检项（事务）
 * - 点位唯一性校验（编码全局唯一、同机房内名称唯一）
 * - 二维码内容生成与 PNG/ZIP 导出
 * - Excel 逐行校验导入
 * - 扫码解析 + 点位状态 + 本周期重复校验
 *
 * @author ruoyi
 */
public interface IInspectPointExtService {

    /**
     * 新增点位（含巡检项），返回点位ID（PRD：POST /inspect/point 返回点位ID + 二维码URL）
     */
    Long insertPoint(InspectPoint bo);

    /**
     * 修改点位（含巡检项全量覆盖）
     */
    Boolean updatePoint(InspectPoint bo);

    /**
     * 生成单点位二维码 PNG
     */
    byte[] generateQrCodePng(Long pointId);

    /**
     * 批量导出二维码 ZIP（PRD：批量导出超过 200 个点位时提示分批导出）
     */
    byte[] batchExportQrCodeZip(List<Long> pointIds);

    /**
     * 下载 Excel 导入模板（含示例行）
     */
    List<org.dromara.inspect.domain.bo.InspectPointImportBo> importTemplateSample();

    /**
     * 上传 Excel 并逐行校验，返回每行结果（不落库）
     */
    List<PointImportRowVo> importData(MultipartFile file);

    /**
     * 确认导入：仅落库校验通过的行，并批量生成二维码
     *
     * @param rows 由 importData 返回的通过行（前端回传 success=true 的行）
     * @return 实际入库条数
     */
    Integer importConfirm(List<PointImportRowVo> rows);

    /**
     * 扫码解析：二维码内容 -> 点位详情（校验状态与本周期）
     */
    ScanPointVo resolveScan(String content);

    /**
     * 本人可巡检的点位列表（H5 手动输码兜底，PRD 4.5）
     */
    List<ScanPointVo> myPointList();

    /**
     * 查询点位详情（含巡检项），供 H5 巡检执行页使用
     */
    ScanPointVo queryDetailWithItems(Long pointId);

}
