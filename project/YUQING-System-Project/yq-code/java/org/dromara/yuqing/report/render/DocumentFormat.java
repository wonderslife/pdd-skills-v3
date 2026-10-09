package org.dromara.yuqing.report.render;

/**
 * 报告导出格式（F-014 验收标准 5：PDF 与 Word 两种）
 *
 * <p>企业微信应用消息的 file 类型只吃 doc/docx/xls/xlsx/ppt/pptx/pdf，
 * 因此两种格式都能直接推送，无需中转。</p>
 *
 * @author ruoyi
 */
public enum DocumentFormat {

    /** Word 文档（.docx），由 poi-tl 渲染 */
    DOCX("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),

    /** PDF 文档，由 openhtmltopdf 渲染 */
    PDF("pdf", "application/pdf"),

    /** 纯 Markdown 文本，仅用于在线查看与降级，不推送 */
    MARKDOWN("md", "text/markdown");

    private final String ext;

    private final String mime;

    DocumentFormat(String ext, String mime) {
        this.ext = ext;
        this.mime = mime;
    }

    public String getExt() {
        return ext;
    }

    public String getMime() {
        return mime;
    }

    /**
     * 宽松解析：未知或空值回落 MARKDOWN 而不是抛异常 ——
     * 导出格式是前端传参，不该因为一个拼错的值让整个接口 500。
     */
    public static DocumentFormat of(String v) {
        if (v == null) {
            return MARKDOWN;
        }
        String s = v.trim().toLowerCase();
        for (DocumentFormat f : values()) {
            if (f.ext.equals(s) || f.name().equalsIgnoreCase(s)) {
                return f;
            }
        }
        if ("word".equals(s) || "doc".equals(s)) {
            return DOCX;
        }
        return MARKDOWN;
    }
}
