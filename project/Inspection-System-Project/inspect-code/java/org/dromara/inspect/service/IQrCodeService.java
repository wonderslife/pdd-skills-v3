package org.dromara.inspect.service;

/**
 * 二维码服务
 * <p>
 * 点位 ID 加密后写入二维码，防止手工伪造 `p` 参数访问他人点位。
 *
 * @author ruoyi
 */
public interface IQrCodeService {

    /**
     * 生成二维码内容（PRD：https://{host}/h5/scan?p={encrypted_point_id}）
     *
     * @param pointId 点位ID
     * @return 二维码内容字符串
     */
    String buildContent(Long pointId);

    /**
     * 解析二维码内容，还原点位ID
     *
     * @param content 二维码中的内容或裸的 p 参数值
     * @return 点位ID；解密失败或非法返回 null
     */
    Long resolvePointId(String content);

    /**
     * 生成二维码 PNG 字节数组
     *
     * @param content 二维码内容
     * @param width   宽度（像素）
     * @param height  高度（像素）
     * @return PNG 字节数组
     */
    byte[] generatePng(String content, int width, int height);

}
