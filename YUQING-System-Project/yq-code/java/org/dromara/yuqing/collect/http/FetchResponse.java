package org.dromara.yuqing.collect.http;

import lombok.Data;
import org.dromara.yuqing.collect.model.BlockSignal;

import java.util.List;
import java.util.Map;

/**
 * 一次抓取响应。
 *
 * @author ruoyi
 */
@Data
public class FetchResponse {

    /** HTTP 状态码；本地文件读取时为 200 */
    private int statusCode;

    /** 解码后的文本正文 */
    private String body;

    /** 原始字节（快照留存用） */
    private byte[] bytes;

    /** 响应头 */
    private Map<String, List<String>> headers;

    /** 最终地址（跟随重定向后） */
    private String finalUrl;

    /** 实际使用的出口代理 */
    private String proxyUsed;

    /** 耗时毫秒 */
    private long costMs;

    /** 重试次数 */
    private int attempts;

    /** 反爬判定结果 */
    private BlockSignal blockSignal = BlockSignal.ok();

    /**
     * 是否 HTTP 成功。
     *
     * @return 2xx 返回 true
     */
    public boolean isHttpOk() {
        return statusCode >= 200 && statusCode < 300;
    }

    /**
     * 正文长度。
     *
     * @return 字符数；正文为空返回 0
     */
    public int bodyLength() {
        return body == null ? 0 : body.length();
    }
}
