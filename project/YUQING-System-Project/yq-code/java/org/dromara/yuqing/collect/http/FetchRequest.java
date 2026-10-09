package org.dromara.yuqing.collect.http;

import lombok.Data;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 一次抓取请求的完整描述。
 *
 * <p>把「限流参数、代理分组、随机延时区间、附加请求头」都挂在请求上，下载器与适配器解耦：</p>
 *
 * @author ruoyi
 */
@Data
public class FetchRequest {

    /** 目标地址；支持 http/https 与 file: 前缀（离线自测用） */
    private String url;

    /** 请求方法：GET / POST */
    private String method = "GET";

    /** 请求体（POST 时使用） */
    private String body;

    /** 请求体类型 */
    private String contentType = "application/json;charset=UTF-8";

    /** 附加请求头（适配器级别，会覆盖 HeaderPool 的同名项） */
    private Map<String, String> headers = new LinkedHashMap<>();

    /** 渠道ID（限流、粘性代理会话的维度） */
    private Long channelId;

    /** 站点适配器标识（日志定位用） */
    private String adapterCode;

    /** 代理池分组ID */
    private Long proxyGroupId;

    /** 是否使用代理 */
    private boolean useProxy = true;

    /** 随机延时下限（毫秒），反爬的频率算法对抗 */
    private Integer minIntervalMs;

    /** 随机延时上限（毫秒） */
    private Integer maxIntervalMs;

    /** 检索词（用于蜜罐/降级内容判定） */
    private String keyword;

    /** 超时毫秒 */
    private long timeoutMs = 20000L;

    /** 是否跟随重定向 */
    private boolean followRedirect = true;

    /** 最低可接受内容长度（低于该长度且含脚本壳 → 判为需渲染） */
    private int minContentLength = 200;

    /** 渠道请求间隔（毫秒），限流闸门用 */
    private Integer requestIntervalMs;

    /** 渠道并发上限，限流闸门用 */
    private Integer concurrencyLimit;

    /**
     * 复制一份请求并替换地址，避免适配器之间互相污染。
     *
     * @param newUrl 新地址
     * @return 新请求对象
     */
    public FetchRequest copyWithUrl(String newUrl) {
        FetchRequest r = new FetchRequest();
        r.url = newUrl;
        r.method = this.method;
        r.body = this.body;
        r.contentType = this.contentType;
        r.headers = new LinkedHashMap<>(this.headers);
        r.channelId = this.channelId;
        r.adapterCode = this.adapterCode;
        r.proxyGroupId = this.proxyGroupId;
        r.useProxy = this.useProxy;
        r.minIntervalMs = this.minIntervalMs;
        r.maxIntervalMs = this.maxIntervalMs;
        r.keyword = this.keyword;
        r.timeoutMs = this.timeoutMs;
        r.followRedirect = this.followRedirect;
        r.minContentLength = this.minContentLength;
        r.requestIntervalMs = this.requestIntervalMs;
        r.concurrencyLimit = this.concurrencyLimit;
        return r;
    }
}
