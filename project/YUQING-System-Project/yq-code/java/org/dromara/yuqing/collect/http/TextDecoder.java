package org.dromara.yuqing.collect.http;

import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;

/**
 * 响应体解码工具。
 *
 * <p>中文站点常见 GBK / GB2312，且大量站点 Content-Type 声明与真实编码不符，
 * 因此这里做「声明优先 + BOM 嗅探 + UTF-8 误解码自检回退 GBK」三重处理。</p>
 *
 * @author ruoyi
 */
public final class TextDecoder {

    private static final byte[] BOM_UTF8 = {(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};
    private static final byte[] BOM_UTF16LE = {(byte) 0xFF, (byte) 0xFE};

    private TextDecoder() {
    }

    /**
     * 解码字节数组。
     *
     * @param bytes       原始字节
     * @param contentType 响应头里的 Content-Type
     * @return 解码后的文本；入参为空返回空串
     */
    public static String decode(byte[] bytes, String contentType) {
        if (bytes == null || bytes.length == 0) {
            return "";
        }
        Charset charset = fromBom(bytes);
        if (charset == null) {
            charset = fromContentType(contentType);
        }
        if (charset == null) {
            charset = StandardCharsets.UTF_8;
        }
        String text = new String(bytes, charset);
        if (charset == StandardCharsets.UTF_8 && text.indexOf(0xFFFD) >= 0) {
            String gbk = tryCharset(bytes, "GBK");
            if (gbk != null && gbk.indexOf(0xFFFD) < 0) {
                return gbk;
            }
        }
        return text;
    }

    private static Charset fromBom(byte[] bytes) {
        if (bytes.length >= 3 && bytes[0] == BOM_UTF8[0] && bytes[1] == BOM_UTF8[1] && bytes[2] == BOM_UTF8[2]) {
            return StandardCharsets.UTF_8;
        }
        if (bytes.length >= 2 && bytes[0] == BOM_UTF16LE[0] && bytes[1] == BOM_UTF16LE[1]) {
            return StandardCharsets.UTF_16LE;
        }
        return null;
    }

    private static Charset fromContentType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return null;
        }
        String lower = contentType.toLowerCase();
        int idx = lower.indexOf("charset=");
        if (idx < 0) {
            return null;
        }
        String name = contentType.substring(idx + 8).trim();
        int semi = name.indexOf(';');
        if (semi > 0) {
            name = name.substring(0, semi);
        }
        name = name.replace("\"", "").replace("'", "").trim();
        if (name.isEmpty() || "utf8".equalsIgnoreCase(name)) {
            name = name.isEmpty() ? "" : "UTF-8";
        }
        try {
            return name.isEmpty() ? null : Charset.forName(name);
        } catch (Exception e) {
            return null;
        }
    }

    private static String tryCharset(byte[] bytes, String name) {
        try {
            return new String(bytes, Charset.forName(name));
        } catch (Exception e) {
            return null;
        }
    }
}
