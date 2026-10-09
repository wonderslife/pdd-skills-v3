package org.dromara.yuqing.wecom.config;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * 企业微信网页授权链接构造器（F-012 验收标准 1）
 *
 * <p>纯字符串拼接，无副作用，便于单测直接断言。</p>
 *
 * @author ruoyi
 */
@Component
@RequiredArgsConstructor
public class YqWecomAuthLinkBuilder {

    private final YqWecomProperties props;

    /**
     * 构造企业微信网页授权跳转链接。
     *
     * <p>企业微信侧流程：用户点开本链接 -> 企微鉴权 -> 回调 {@code redirectUri}?code=xxx&amp;state=yyy
     * -> H5 收到 code 后调 {@code /yuqing/wecom/auth} 换 token。</p>
     *
     * @param state 防 CSRF 的一次性随机串（透传回跳，由前端校验）
     * @return 完整授权链接；corpId 或 redirectUri 未配置时返回 null
     */
    public String build(String state) {
        if (props.getCorpId() == null || props.getCorpId().isBlank()) {
            return null;
        }
        if (props.getRedirectUri() == null || props.getRedirectUri().isBlank()) {
            return null;
        }
        return props.getApiBase() + "/connect/oauth2/authorize"
            + "?appid=" + enc(props.getCorpId())
            + "&redirect_uri=" + enc(props.getRedirectUri())
            + "&response_type=code"
            + "&scope=" + enc(props.getOauthScope())
            + "&state=" + enc(state == null ? "" : state)
            + "#wechat_redirect";
    }

    private static String enc(String v) {
        return URLEncoder.encode(v == null ? "" : v, StandardCharsets.UTF_8);
    }
}
