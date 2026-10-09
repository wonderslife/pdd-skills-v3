package org.dromara.yuqing.wecom.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 企业微信 H5 端配置（F-012）
 *
 * <p>配置前缀 {@code yuqing.wecom}，样例见 {@code script/sql/yuqing/config/yq_wecom.yml}。</p>
 *
 * <p><b>与 F-011 推送配置的关系：</b>推送走 {@code yuqing.alert.push} 下的应用凭据；
 * 本类独立配置 H5 免登所使用的自建应用凭据。若两者是同一个应用，则填相同值即可；
 * 若不是，必须分别配置 —— 混用会导致 token 互相顶掉（先换的失效）。</p>
 *
 * <p><b>安全：</b>{@code corpSecret} 只允许走配置中心 / 环境变量，禁止硬编码进代码或提交进仓库。</p>
 *
 * @author ruoyi
 */
@Data
@Component
@ConfigurationProperties(prefix = "yuqing.wecom")
public class YqWecomProperties {

    /** 免登总开关：关闭后 /yuqing/wecom/auth 直接返回未启用，H5 自动降级到账号密码登录 */
    private boolean enabled = true;

    /** 企业微信接口基址（一般无需改） */
    private String apiBase = "https://qyapi.weixin.qq.com";

    /** 企业 ID（CorpId） */
    private String corpId = "";

    /** 自建应用 Secret（CorpSecret） */
    private String corpSecret = "";

    /** 自建应用 AgentId（发送消息 / 构造授权链接时需要） */
    private String agentId = "";

    /** 网页授权 scope：snsapi_base 仅取成员 ID；snsapi_privateinfo 可另取手机号/邮箱 */
    private String oauthScope = "snsapi_base";

    /** 网页授权回调地址（需在企业微信应用后台配置为可信域名下的地址） */
    private String redirectUri = "";

    /** 连接超时（毫秒） */
    private int connectTimeoutMs = 5000;

    /** 读取超时（毫秒） */
    private int readTimeoutMs = 10000;

    /**
     * 首次免登时，若企微成员 ID 无法映射到若依用户，是否按「登录名 == 企微成员ID」自动绑定。
     *
     * <p>默认 true：企业微信成员 ID 常与域账号一致，这是常见部署约定。
     * 若企业环境两者不一致，应置为 false 并由管理员在 PC 端手工维护绑定关系，
     * 否则会把「同名不同人」误绑成同一账号（越权风险）。</p>
     */
    private boolean autoBindByLoginName = true;

    /** 免登成功后签发令牌的有效期（秒），0 表示沿用 Sa-Token 客户端默认 */
    private long tokenTimeoutSeconds = 0L;

    /** 指令解析：单次指令文本最大长度（防超长文本打爆解析） */
    private int maxCommandLength = 500;

    /** 指令解析：是否允许指令触发采集任务创建（高风险操作，默认允许） */
    private boolean commandAllowTaskCreate = true;

    /** 指令解析：是否允许指令触发报告生成（默认允许） */
    private boolean commandAllowReportTrigger = true;

    /** 首页聚合：待办报告最多展示条数 */
    private int homeTodoReportLimit = 5;

    /** 首页聚合：最近研判结论最多展示条数 */
    private int homeRecentAnalysisLimit = 5;
}
