package org.dromara.yuqing.alert.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 预警 / 推送引擎配置（F-010 + F-011）
 *
 * <p>配置前缀 {@code yuqing.alert}，样例见 {@code script/sql/yuqing/config/yq_alert.yml}。</p>
 *
 * <p>安全约定：企业微信凭据（corpSecret）只允许走配置中心 / 环境变量，禁止硬编码进代码。</p>
 *
 * @author ruoyi
 */
@Data
@Component
@ConfigurationProperties(prefix = "yuqing.alert")
public class YqAlertProperties {

    /** 预警引擎总开关 */
    private boolean enabled = true;

    /** 每次扫描回看的时间范围（分钟）：扫描 [now-scanWindowMinutes, now) 内新增舆情 */
    private int scanWindowMinutes = 30;

    /** 单次扫描最多载入的舆情条数（保护性上限） */
    private int maxScanRecords = 2000;

    /** 突发增量基线取最近多少个同长度窗口的移动均值 */
    private int baselineWindows = 7;

    /** 突发增量最小条数下限：低于该值不判定为突发（防小样本虚高） */
    private int minBurstCount = 5;

    /** 规则未显式配置时的默认突发倍数阈值 */
    private double defaultBurstRatio = 3.0d;

    /** 规则未显式配置时的默认冷却期（分钟） */
    private int defaultCooldownMinutes = 360;

    /** 需要在列表/台账做醒目提示（红标）的预警级别，逗号分隔 */
    private String highlightLevels = "warning,urgent";

    /** 企业微信推送（F-011）配置 */
    private Push push = new Push();

    /**
     * 企业微信自建应用消息通道配置
     */
    @Data
    public static class Push {

        /** 推送总开关 */
        private boolean enabled = true;

        /** 企业微信 corpId */
        private String corpId = "";

        /** 自建应用 secret（敏感，仅从配置/环境变量读取） */
        private String corpSecret = "";

        /** 自建应用 agentId */
        private String agentId = "";

        /** 企业微信 API 基址 */
        private String apiBase = "https://qyapi.weixin.qq.com";

        /** 连接超时（毫秒） */
        private int connectTimeoutMs = 3000;

        /** 读取超时（毫秒） */
        private int readTimeoutMs = 8000;

        /** 单条文本消息正文最大字符数（企业微信应用消息上限 2048 字节，中文按 3 字节算故留冗余） */
        private int maxContentChars = 1500;

        /** 失败重试上限（规则可覆盖） */
        private int maxRetry = 3;

        /** 重试退避基数（毫秒），实际间隔 = backoff * 2^attempt */
        private long retryBackoffMs = 2000L;

        /** H5 查看入口基址，用于拼接「查看详情」链接；为空则不下发链接 */
        private String h5BaseUrl = "";

        /**
         * 高风险即时推送是否穿透免打扰时段。
         *
         * <p>默认 <b>true</b>：免打扰的设计目的是不让常规批量消息打扰休息时间，
         * 若把最要紧的高风险即时预警也一起吞掉，就变成了「最该被看到的消息最看不到」的
         * 安全反模式。定时批量（scheduled）一律遵守免打扰并顺延到时段结束。</p>
         */
        private boolean immediatePierceQuiet = true;

        /**
         * 演练模式：不真正调用企业微信，只落推送记录并标记 success。
         * <b>与「无凭据降级」不是一回事</b>——无凭据是配置缺失，必须标记 failed；
         * 演练是人为开关，用于联调期避免打扰真实用户。
         */
        private boolean dryRun = false;
    }

    /** 判断指定预警级别是否需要醒目提示 */
    public boolean isHighlight(String alertLevel) {
        if (alertLevel == null || highlightLevels == null) {
            return false;
        }
        for (String part : highlightLevels.split("[,，\s]+")) {
            if (part.trim().equalsIgnoreCase(alertLevel)) {
                return true;
            }
        }
        return false;
    }

    /** 企业微信凭据是否齐全；不齐全时不发真实请求，直接标记失败 */
    public boolean wecomConfigured() {
        Push p = getPush();
        return p != null
            && p.getCorpId() != null && !p.getCorpId().isBlank()
            && p.getCorpSecret() != null && !p.getCorpSecret().isBlank()
            && p.getAgentId() != null && !p.getAgentId().isBlank();
    }
}
