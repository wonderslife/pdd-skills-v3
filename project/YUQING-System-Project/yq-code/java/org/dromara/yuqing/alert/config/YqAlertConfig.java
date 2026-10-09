package org.dromara.yuqing.alert.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.push.HttpWecomTransport;
import org.dromara.yuqing.push.LoggingWecomTransport;
import org.dromara.yuqing.push.WecomTokenHolder;
import org.dromara.yuqing.push.WecomTransport;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 推送通道装配（F-011）
 *
 * <p>三条分支，优先级从高到低：</p>
 * <ol>
 *   <li>{@code push.dryRun=true} → 演练通道（按成功留痕，不打扰真实用户）</li>
 *   <li>凭据齐全 → 真实 HTTP 通道</li>
 *   <li>凭据缺失 → 日志通道，<b>并把结果标记为失败</b>（绝不静默假成功）</li>
 * </ol>
 *
 * @author ruoyi
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
public class YqAlertConfig {

    private final YqAlertProperties props;

    @Bean
    public WecomTransport wecomTransport() {
        if (!props.getPush().isEnabled()) {
            log.warn("[推送] push.enabled=false，推送通道以日志通道装配（所有推送将标记为 skipped）");
            return new LoggingWecomTransport();
        }
        if (props.getPush().isDryRun()) {
            log.warn("[推送] 演练模式开启（push.dryRun=true），不会真正发送企业微信消息");
            return LoggingWecomTransport.dryRun();
        }
        if (!props.wecomConfigured()) {
            log.warn("[推送] 企业微信凭据未配置，通道降级为日志；推送记录将标记 failed，"
                + "请补齐 yuqing.alert.push.corpId / corpSecret / agentId");
            return new LoggingWecomTransport();
        }
        return new HttpWecomTransport(props, new WecomTokenHolder(props));
    }
}
