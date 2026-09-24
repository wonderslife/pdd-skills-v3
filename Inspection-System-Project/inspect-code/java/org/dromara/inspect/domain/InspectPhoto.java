package org.dromara.inspect.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.common.mybatis.core.domain.BaseEntity;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
import java.time.LocalDateTime;
import java.io.Serial;

/**
 * 巡检照片对象 insp_photo
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("insp_photo")
@ExcelIgnoreUnannotated
public class InspectPhoto extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 巡检照片ID,主键 */
    @TableId(value = "photo_id")
    private Long photoId;

    /** 所属记录ID */
    private Long recordId;

    /** 关联巡检项结果ID */
    private Long recordItemId;

    /** 原图URL（MinIO） */
    private String originalUrl;

    /** 原图字节数 */
    private Long originalSize;

    /** 压缩图URL（MinIO） */
    private String compressedUrl;

    /** 压缩图字节数 */
    private Long compressedSize;

    /** 原始文件名 */
    private String fileName;
}
