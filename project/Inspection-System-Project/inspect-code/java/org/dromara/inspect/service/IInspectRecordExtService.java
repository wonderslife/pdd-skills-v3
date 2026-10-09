package org.dromara.inspect.service;

import org.dromara.common.core.domain.PageResult;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.inspect.domain.InspectRecord;
import org.dromara.inspect.domain.bo.InspectRecordSubmitBo;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * 巡检记录扩展服务
 * <p>
 * 覆盖生成器无法机械产出的业务（PRD 模块 8/9/10）：
 * - H5 提交巡检记录（校验 + 结果/照片/异常项落库，事务）
 * - PC 逾期补录（来源标记 pc_supplement，写操作日志）
 * - 照片上传（原图 + 压缩图，走若依 OSS）
 * - 记录列表带关联名称、我的记录、详情、追加管理员备注
 *
 * @author ruoyi
 */
public interface IInspectRecordExtService {

    /**
     * 提交巡检记录
     *
     * @param bo        提交数据
     * @param supplement true=PC 逾期补录，false=H5 现场提交
     * @return 记录ID
     */
    Long submitRecord(InspectRecordSubmitBo bo, boolean supplement);

    /**
     * 上传单张照片（原图 + 压缩图），返回两个 URL
     */
    Map<String, Object> uploadPhoto(MultipartFile original, MultipartFile compressed);

    /**
     * 记录列表（含点位/机房/巡检员名称，支持多维筛选）
     */
    PageResult<InspectRecord> queryPageListWithNames(InspectRecord bo, PageQuery pageQuery);

    /**
     * 导出用的完整列表
     */
    List<InspectRecord> queryExportList(InspectRecord bo);

    /**
     * 本人巡检记录（H5「我的记录」）
     */
    PageResult<InspectRecord> queryMyRecords(InspectRecord bo, PageQuery pageQuery);

    /**
     * 记录详情（含巡检项结果、照片 URL、异常标记）
     */
    InspectRecord queryDetail(Long recordId);

    /**
     * 追加管理员备注（PRD：已提交记录不可修改，仅可追加备注）
     */
    Boolean appendAdminRemark(Long recordId, String adminRemark);

}
