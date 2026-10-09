package org.dromara.yuqing.collect.http;

import java.io.IOException;

/**
 * 下载器 SPI。
 *
 * <p>《技术架构说明》§5.2 主选 Apache HttpClient 5；本实现为控制离线构建依赖，
 * 采用 JDK 21 内置 {@code java.net.http.HttpClient}（HTTP/2 + 连接池 + 每请求代理），
 * 能力等价。后续如需 JA3/JA4 指纹伪装（§5.5 二级对抗），把本接口的实现换成
 * curl-impersonate 通道即可，上层适配器与管道无需改动。</p>
 *
 * @author ruoyi
 */
public interface HttpFetcher {

    /**
     * 执行抓取。内部完成：限流闸门 → 代理选取 → 请求头轮换 → 随机延时 →
     * 反爬判定 → 退避重试。
     *
     * @param request 请求描述
     * @return 响应；被判定拦截时 {@code blockSignal.isBlocked()} 为 true
     * @throws IOException 网络层失败（重试耗尽后抛出）
     */
    FetchResponse execute(FetchRequest request) throws IOException;
}
