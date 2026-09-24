package org.dromara.inspect.domain.bo;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * 扫码解析请求（PRD 模块 7）
 * <p>
 * content 既可以是扫码得到的加密串，也可以是 H5 手动输入的点位编码（兜底入口）。
 * 由 resolveScan 内部自动判断类型。
 *
 * @author ruoyi
 */
@Data
public class ScanResolveBo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 二维码原始内容（加密串）或点位编码 */
    @NotBlank(message = "二维码内容不能为空")
    private String content;

}
