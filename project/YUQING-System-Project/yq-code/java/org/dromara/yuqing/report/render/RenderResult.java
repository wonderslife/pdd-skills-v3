package org.dromara.yuqing.report.render;

/**
 * 渲染结果（不可变）
 *
 * <p>刻意用「成功 + 字节」而非抛异常：报告生成是长流程，
 * 渲染失败要能让上层落一条 status=failed 记录并写 failReason，
 * 异常一路抛到 Controller 会丢掉已生成的前半截内容。</p>
 *
 * @param ok       是否成功
 * @param format   目标格式
 * @param fileName 建议文件名（不含路径）
 * @param bytes    文件字节；失败时为 null
 * @param message  成功时的说明或失败原因
 * @author ruoyi
 */
public record RenderResult(boolean ok, DocumentFormat format, String fileName, byte[] bytes, String message) {

    public static RenderResult ok(DocumentFormat format, String fileName, byte[] bytes) {
        return new RenderResult(true, format, fileName, bytes, "渲染成功，共 " + (bytes == null ? 0 : bytes.length) + " 字节");
    }

    public static RenderResult fail(DocumentFormat format, String fileName, String message) {
        return new RenderResult(false, format, fileName, null, message);
    }

    public int size() {
        return bytes == null ? 0 : bytes.length;
    }
}
