/**
 * F-012 企微 H5 管控模板（一）：配置 + 免登核心 + 数据模型
 *
 * 拆分为独立 ES module 的目的：主生成器 gen-yuqing-wecom.mjs 直接 import 本文件，
 * 每个 part 都能单独 node --check。
 *
 * ⚠ 三层转义约定：Java 产物内不使用 \n / \t 转义序列（用文本块或显式拼接）；
 *   产物内不能出现未转义的反引号。
 */
export const WECOM_TPL = [

  /* ------------------------------------------------------------ 配置 */

  {
    rel: 'wecom/config/YqWecomProperties.java',
    content: `package org.dromara.yuqing.wecom.config;

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
`,
  },

  {
    rel: 'wecom/config/YqWecomAuthLinkBuilder.java',
    content: `package org.dromara.yuqing.wecom.config;

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
`,
  },

  /* ------------------------------------------------------------ 免登核心 */

  {
    rel: 'wecom/WecomMemberInfo.java',
    content: `package org.dromara.yuqing.wecom;

/**
 * 企业微信成员信息（F-012 验收标准 1）
 *
 * <p>免登换取到的成员身份载体，不落库，仅作为服务层返回值。</p>
 *
 * @param userId   企业微信成员 ID（UserId，企微通讯录内唯一）
 * @param openId   非企业成员访问时的 OpenId（外部联系人场景）
 * @param userTicket 使用 snsapi_privateinfo 授权时返回，可用于换取手机号/邮箱
 * @param deviceId 设备 ID（企业微信返回，一般不用）
 *
 * @author ruoyi
 */
public record WecomMemberInfo(String userId, String openId, String userTicket, String deviceId) {

    /** 是否为可信的企业内部成员（拿到 UserId 才算） */
    public boolean isEnterpriseMember() {
        return userId != null && !userId.isBlank();
    }
}
`,
  },

  {
    rel: 'wecom/WecomApiClient.java',
    content: `package org.dromara.yuqing.wecom;

import lombok.extern.slf4j.Slf4j;
import org.dromara.common.json.utils.JsonUtils;
import org.dromara.yuqing.push.WecomTokenHolder;
import org.dromara.yuqing.wecom.config.YqWecomProperties;
import tools.jackson.databind.JsonNode;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * 企业微信 API 客户端（F-012）
 *
 * <p><b>复用 F-011 的 token 持有者：</b>access_token 通过 {@link WecomTokenHolder} 获取，
 * 该持有者已实现提前 300 秒过期与 synchronized 双检，避免并发刷新打爆企微限频。</p>
 *
 * <p><b>安全：</b>所有请求参数均做 URL 编码；corpSecret 只出现在 gettoken 的内部请求里，
 * 不记录进日志（token 持有者已在日志中做了脱敏处理）。</p>
 *
 * <p><b>装配说明：</b>本类不是 {@code @Component} —— 因为它依赖 {@link WecomTokenHolder}，
 * 而该持有者在本项目里是手工 {@code new} 出来的（见 {@code YqAlertConfig}），
 * 由 {@code YqWecomConfig} 统一装配，避免出现两个 token 持有者互相顶掉 token。</p>
 *
 * @author ruoyi
 */
@Slf4j
public class WecomApiClient {

    private final YqWecomProperties props;
    private final WecomTokenHolder tokenHolder;
    private final HttpClient http;

    public WecomApiClient(YqWecomProperties props, WecomTokenHolder tokenHolder) {
        this.props = props;
        this.tokenHolder = tokenHolder;
        this.http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofMillis(props.getConnectTimeoutMs()))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();
    }

    /**
     * 用网页授权 code 换取成员身份（企微文档：获取访问用户身份）。
     *
     * @param code 企业微信回调带回的 code（一次性，5 分钟有效）
     * @return 成员信息；调用失败抛 IOException
     */
    public WecomMemberInfo getUserInfoByCode(String code) throws IOException {
        if (code == null || code.isBlank()) {
            throw new IOException("企业微信授权 code 为空");
        }
        String token = tokenHolder.get();
        String url = props.getApiBase() + "/cgi-bin/auth/getuserinfo"
            + "?access_token=" + enc(token)
            + "&code=" + enc(code);
        JsonNode node = getJson(url, "getuserinfo");

        int errcode = node.path("errcode").asInt(-1);
        if (errcode != 0) {
            // 40029 code 无效 / 42001 token 过期，刷新后重试一次
            tokenHolder.invalidate();
            String retryToken = tokenHolder.get();
            String retryUrl = props.getApiBase() + "/cgi-bin/auth/getuserinfo"
                + "?access_token=" + enc(retryToken)
                + "&code=" + enc(code);
            node = getJson(retryUrl, "getuserinfo(retry)");
            errcode = node.path("errcode").asInt(-1);
            if (errcode != 0) {
                throw new IOException("企业微信 getuserinfo 失败 errcode=" + errcode
                    + " errmsg=" + node.path("errmsg").asString(""));
            }
        }
        return new WecomMemberInfo(
            textOrNull(node, "userid"),
            textOrNull(node, "openid"),
            textOrNull(node, "user_ticket"),
            textOrNull(node, "deviceid"));
    }

    /**
     * 查询成员详情（需 snsapi_privateinfo 授权拿到 user_ticket）。
     *
     * @param userTicket 授权时返回的 user_ticket
     * @return 成员详情 JSON；未配置或失败返回 null（调用方按「信息缺失」处理，不阻塞免登）
     */
    public JsonNode getUserDetail(String userTicket) {
        if (userTicket == null || userTicket.isBlank()) {
            return null;
        }
        try {
            String token = tokenHolder.get();
            String url = props.getApiBase() + "/cgi-bin/auth/getuserdetail?access_token=" + enc(token);
            String body = "{\\"user_ticket\\":\\"" + jsonEscape(userTicket) + "\\"}";
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofMillis(props.getReadTimeoutMs()))
                .header("Content-Type", "application/json; charset=utf-8")
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            JsonNode node = JsonUtils.parseObject(resp.body(), JsonNode.class);
            if (node == null || node.path("errcode").asInt(-1) != 0) {
                log.warn("[企微] getuserdetail 未取到详情，按信息缺失处理");
                return null;
            }
            return node;
        } catch (IOException e) {
            log.warn("[企微] getuserdetail 调用异常，按信息缺失处理: {}", e.getMessage());
            return null;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return null;
        }
    }

    /** 是否已配置可用凭据（corpId + corpSecret 均非空） */
    public boolean configured() {
        return props.getCorpId() != null && !props.getCorpId().isBlank()
            && props.getCorpSecret() != null && !props.getCorpSecret().isBlank();
    }

    private JsonNode getJson(String url, String scene) throws IOException {
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofMillis(props.getReadTimeoutMs()))
                .GET()
                .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            JsonNode node = JsonUtils.parseObject(resp.body(), JsonNode.class);
            if (node == null) {
                throw new IOException("企业微信 " + scene + " 返回无法解析: " + brief(resp.body()));
            }
            return node;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("企业微信 " + scene + " 被中断", e);
        }
    }

    private static String textOrNull(JsonNode node, String field) {
        String v = node.path(field).asString("");
        return v.isBlank() ? null : v;
    }

    private static String enc(String v) {
        return URLEncoder.encode(v == null ? "" : v, StandardCharsets.UTF_8);
    }

    private static String jsonEscape(String v) {
        return v.replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"");
    }

    private static String brief(String body) {
        if (body == null) {
            return "null";
        }
        return body.length() > 200 ? body.substring(0, 200) : body;
    }
}
`,
  },

  {
    rel: 'wecom/WecomBindResolver.java',
    content: `package org.dromara.yuqing.wecom;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.wecom.config.YqWecomProperties;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * 企业微信成员 ID ↔ 若依用户 ID 映射解析器（F-012 验收标准 1）
 *
 * <p><b>映射优先级（三级，与 F-011 的 {@code JdbcPushUserDirectory} 口径保持一致）：</b></p>
 * <ol>
 *   <li>命中已登记绑定：{@code yq_wecom_command} 中最近一次该成员的 {@code user_id}；</li>
 *   <li>按登录名精确匹配：{@code sys_user.user_name == wecomUserId}
 *       （仅在 {@code yuqing.wecom.auto-bind-by-login-name=true} 时启用）；</li>
 *   <li>都匹配不到 → 返回 null，由上层明确拒绝并提示，<b>绝不静默创建账号或放行</b>。</li>
 * </ol>
 *
 * <p><b>安全：</b>全部查询走 {@code ?} 预编译占位符，用户输入不参与 SQL 拼接；
 * 只取 {@code user_id}，不带出手机号等敏感字段。</p>
 *
 * <p><b>越权防护：</b>第 2 级「按登录名匹配」是自动绑定，存在「同名不同人」被误绑的风险。
 * 生产环境若企业微信成员 ID 与域账号不一致，必须把 {@code auto-bind-by-login-name} 置为 false，
 * 改为由管理员在 PC 端手工维护绑定。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WecomBindResolver {

    private final JdbcTemplate jdbcTemplate;
    private final YqWecomProperties props;

    /**
     * 解析企微成员 ID 对应的若依用户 ID。
     *
     * @param wecomUserId 企业微信成员 ID
     * @return 若依用户 ID；无法解析返回 null
     */
    public Long resolve(String wecomUserId) {
        if (wecomUserId == null || wecomUserId.isBlank()) {
            return null;
        }
        Long byHistory = findByCommandHistory(wecomUserId);
        if (byHistory != null) {
            return byHistory;
        }
        if (props.isAutoBindByLoginName()) {
            return findByLoginName(wecomUserId);
        }
        return null;
    }

    /** 一级：查历史指令记录里登记过的映射 */
    private Long findByCommandHistory(String wecomUserId) {
        var list = jdbcTemplate.queryForList(
            "select user_id from yq_wecom_command "
                + "where wecom_user_id = ? and user_id is not null "
                + "order by command_id desc limit 1",
            Long.class, wecomUserId);
        return list.isEmpty() ? null : list.get(0);
    }

    /** 二级：登录名精确匹配（仅返回启用且未删除的用户） */
    private Long findByLoginName(String wecomUserId) {
        var list = jdbcTemplate.queryForList(
            "select user_id from sys_user "
                + "where user_name = ? and status = '0' and del_flag = '0' limit 1",
            Long.class, wecomUserId);
        return list.isEmpty() ? null : list.get(0);
    }

    /**
     * 记录一次绑定（免登成功时调用），写入指令表作为映射留痕。
     *
     * <p>用 {@code ON DUPLICATE KEY} 之外的策略：直接插一条 {@code command_type=login} 的记录，
     * 不更新历史行 —— 保留「谁在什么时候用什么成员 ID 登录过」的完整审计痕迹。</p>
     *
     * @param userId      若依用户 ID
     * @param wecomUserId 企业微信成员 ID
     */
    public void recordBinding(Long userId, String wecomUserId) {
        if (userId == null || wecomUserId == null || wecomUserId.isBlank()) {
            return;
        }
        try {
            jdbcTemplate.update(
                "insert into yq_wecom_command "
                    + "(command_id, user_id, wecom_user_id, command_text, command_type, exec_status, exec_time, create_time) "
                    + "values (?, ?, ?, ?, 'login', 'success', now(), now())",
                snowflake(), userId, wecomUserId, "[免登绑定]");
        } catch (Exception e) {
            // 绑定留痕失败不应阻塞免登主流程，但必须留日志
            log.warn("[企微] 免登绑定留痕写入失败 userId={} wecomUserId={}: {}",
                userId, wecomUserId, e.getMessage());
        }
    }

    /** 简单雪花 ID（与若依 IdUtil 同段位；此处避免额外依赖，使用时间戳+随机） */
    private static long snowflake() {
        return System.currentTimeMillis() * 1000L + (long) (Math.random() * 1000);
    }
}
`,
  },

  /* ------------------------------------------------------------ 装配 */

  {
    rel: 'wecom/config/YqWecomConfig.java',
    content: `package org.dromara.yuqing.wecom.config;

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
`,
  },

];
