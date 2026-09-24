package org.dromara.inspect.domain.bo;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.List;

/**
 * 巡检记录提交请求
 * <p>
 * 同时服务两个入口（PRD 模块 8 / 模块 10）：
 * - H5 现场提交：pointId + itemResults + photos
 * - PC 逾期补录：额外指定 inspectorId 与 inspectTime，并填写 supplementReason
 *
 * @author ruoyi
 */
@Data
public class InspectRecordSubmitBo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 点位ID（必填） */
    @NotNull(message = "点位ID不能为空")
    private Long pointId;

    /** 耗时（秒），H5 由前端计算 */
    private Integer duration;

    /** 整体备注 */
    private String remark;

    /**
     * 巡检时间；仅 PC 补录可指定（PRD 模块 10：日期可选）
     * 格式 yyyy-MM-dd HH:mm:ss，留空时取服务端当前时间
     */
    private String inspectTime;

    /** 被补录的巡检员ID；仅 PC 补录使用，H5 忽略（取当前登录用户） */
    private Long inspectorId;

    /** 补录原因；仅 PC 补录必填（会写入操作日志） */
    private String supplementReason;

    /** 巡检项结果列表 */
    private List<ItemResult> itemResults;

    /**
     * 巡检项结果项
     */
    @Data
    public static class ItemResult implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        /** 点位巡检项ID（insp_point_item.item_id） */
        private Long itemId;

        /** 巡检项名称快照 */
        private String itemName;

        /** 判定结果 normal/abnormal/na */
        private String result;

        /** 填写数值（itemType=number 时） */
        private String value;

        /** 异常说明（result=abnormal 时必填） */
        private String description;

        /** 显示顺序 */
        private Integer orderNum;

        /** 该项照片（result=abnormal 时至少 1 张） */
        private List<Photo> photos;
    }

    /**
     * 照片项（原图 + 压缩图成对保存）
     */
    @Data
    public static class Photo implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        /** 原图 URL（MinIO） */
        private String originalUrl;

        /** 原图字节数 */
        private Long originalSize;

        /** 压缩图 URL（MinIO） */
        private String compressedUrl;

        /** 压缩图字节数 */
        private Long compressedSize;

        /** 原始文件名 */
        private String fileName;
    }

}
