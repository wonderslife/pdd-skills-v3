package org.dromara.yuqing.wecom.config;

import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.alert.config.YqAlertProperties;
import org.dromara.yuqing.push.WecomTokenHolder;
import org.dromara.yuqing.wecom.WecomApiClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 企业微信 H5 免登装配（F-012）
 *
 * <p><b>为什么不直接在 WecomApiClient 上打 @Component：</b>
 * F-011 的 {@link WecomTokenHolder} 在本项目里是手工 new 出来的（见 {@code YqAlertConfig}），
 * 并不是 Spring Bean。它是 {@code synchronized} 的 token 缓存 —— 如果为免登再 new 一个，
 * 两个持有者会各自刷新 token 并互相顶掉（企业微信同一应用的 access_token 是全局唯一且会顶号），
 * 导致推送和免登间歇性 42001 失败。</p>
 *
 * <p><b>因此：</b>这里复用同一个 {@link WecomTokenHolder} 实例语义 ——
 * 取 F-011 推送应用凭据的 {@link YqAlertProperties} 构造持有者，作为单例 Bean 供两端共用。
 * 若免登与推送不是同一个自建应用，需把本方法的持有者切换为按 {@code YqWecomProperties} 构造的独立实例，
 * 并接受「两个应用各自一份 token」的事实（此时互不干扰，因为企微不同应用的 token 相互独立）。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Configuration
public class YqWecomConfig {

    /**
     * 企业微信 token 持有者（与 F-011 推送共用同一实例）。
     *
     * <p>Bean 名与其它模块不冲突；同一 Spring 上下文内只装配一次，两个调用方注入的是同一个对象。</p>
     */
    @Bean
    public WecomTokenHolder wecomTokenHolder(YqAlertProperties alertProps) {
        log.info("[企微] token 持有者装配完成（与 F-011 推送共用，避免 token 互相顶掉）");
        return new WecomTokenHolder(alertProps);
    }

    @Bean
    public WecomApiClient wecomApiClient(YqWecomProperties props, WecomTokenHolder wecomTokenHolder) {
        if (!props.isEnabled()) {
            log.warn("[企微] yuqing.wecom.enabled=false，H5 免登接口将直接返回未启用，前端自动降级到账号密码登录");
        } else if (props.getCorpId() == null || props.getCorpId().isBlank()
            || props.getCorpSecret() == null || props.getCorpSecret().isBlank()) {
            log.warn("[企微] 免登凭据未配置（corpId / corpSecret 为空），"
                + "请补齐 yuqing.wecom.corpId / corpSecret / agentId；未补齐前免登接口返回失败，H5 自动降级");
        }
        return new WecomApiClient(props, wecomTokenHolder);
    }
}
