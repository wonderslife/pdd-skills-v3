/**
 * F-012 企微 H5 管控模板（二）：免登服务 + 指令解析引擎
 *
 * ⚠ 三层转义约定：Java 产物内不使用 \n / \t 转义序列；产物内不出现未转义反引号。
 */
export const WECOM_TPL2 = [

  /* ------------------------------------------------------------ 指令解析（纯函数，可离线自测） */

  {
    rel: 'wecom/command/WecomCommandType.java',
    content: `package org.dromara.yuqing.wecom.command;

import java.util.Arrays;

/**
 * 企业微信自然语言指令类型（F-012 验收标准 6）
 *
 * <p>码值为稳定契约，H5 端 {@code utils/yuqingDict.js} 的 {@code COMMAND_TYPE_MAP} 与之对应，
 * 新增类型必须两端同步，否则前端会显示成原始码值。</p>
 *
 * @author ruoyi
 */
public enum WecomCommandType {

    /** 未识别 */
    UNKNOWN("unknown", "未识别"),

    /** 查询任务状态，如「查一下今天的采集任务」 */
    QUERY_TASK("query_task", "查询任务"),

    /** 创建采集任务，如「建一个关于XX的临时任务，到今晚8点」 */
    CREATE_TASK("create_task", "创建任务"),

    /** 查询预警，如「今天有哪些预警」 */
    QUERY_ALERT("query_alert", "查询预警"),

    /** 查询舆情，如「查一下XX的舆情」 */
    QUERY_OPINION("query_opinion", "查询舆情"),

    /** 触发研判，如「研判一下这条」 */
    TRIGGER_ANALYSIS("trigger_analysis", "触发研判"),

    /** 触发报告生成，如「生成今天的日报」 */
    TRIGGER_REPORT("trigger_report", "生成报告"),

    /** 帮助 */
    HELP("help", "帮助");

    private final String code;
    private final String label;

    WecomCommandType(String code, String label) {
        this.code = code;
        this.label = label;
    }

    public String getCode() {
        return code;
    }

    public String getLabel() {
        return label;
    }

    /** 按码值反查，未知返回 UNKNOWN */
    public static WecomCommandType ofCode(String code) {
        if (code == null) {
            return UNKNOWN;
        }
        return Arrays.stream(values())
            .filter(t -> t.code.equalsIgnoreCase(code))
            .findFirst()
            .orElse(UNKNOWN);
    }
}
`,
  },

  {
    rel: 'wecom/command/ParsedCommand.java',
    content: `package org.dromara.yuqing.wecom.command;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 指令解析结果（F-012 验收标准 6）
 *
 * @param type       识别出的指令类型
 * @param confidence 置信度（0~1）：命中关键词越多、越靠前，置信度越高
 * @param keyword    从指令里抽取的核心关键词（查询/建任务用）
 * @param params     结构化参数（渠道、结束时间原始表述等），落库为 parsed_params JSON
 *
 * @author ruoyi
 */
public record ParsedCommand(WecomCommandType type, double confidence, String keyword, Map<String, String> params) {

    public static ParsedCommand unknown(String reason) {
        Map<String, String> p = new LinkedHashMap<>();
        p.put("reason", reason);
        return new ParsedCommand(WecomCommandType.UNKNOWN, 0d, null, p);
    }

    public boolean recognized() {
        return type != null && type != WecomCommandType.UNKNOWN;
    }
}
`,
  },

  {
    rel: 'wecom/command/WecomCommandParser.java',
    content: `package org.dromara.yuqing.wecom.command;

import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 自然语言指令解析器（F-012 验收标准 6）
 *
 * <p><b>纯函数设计：</b>不依赖 Spring、数据库、网络，输入字符串、输出 {@link ParsedCommand}，
 * 便于 {@code OfflineCollectTestRunner} 直接反射调用做离线断言。</p>
 *
 * <p><b>解析策略（规则优先，不做大模型调用）：</b>
 * 规则解析的好处是「确定性 + 零成本 + 可审计」，且不会因为大模型不可用而整条链路挂掉。
 * 后续如需引入大模型兜底，应在规则全部未命中时调用，并且大模型结果只作为「建议」，
 * 仍需人工在 {@code yq_wecom_command} 里确认，避免误触发建任务这类写操作。</p>
 *
 * <p><b>安全：</b>本类不执行任何指令，<b>只做解析</b>。真正的执行由 {@code YqWecomCommandServiceExtImpl}
 * 在做完权限校验后发起 —— 解析与执行分离，避免「一句话就把任务建了」的越权风险。</p>
 *
 * @author ruoyi
 */
@Component
public class WecomCommandParser {

    /** 指令类型 -> 关键词组（命中任一即算该类型候选；命中越多置信度越高） */
    private static final Map<WecomCommandType, List<String>> KEYWORDS = new LinkedHashMap<>();

    /** 抽取「关于 XX / 查询 XX」里核心关键词的表达式
     *  终止符含「的 / 等 / 相关 / 舆情 / 任务」等虚词与类别词，避免贪婪吞掉整句
     *  （实测：不加终止符时「关于台风の临时任务」会被整段抽出） */
    private static final Pattern ABOUT = Pattern.compile("(?:关于|有关|针对)\\\\s*[\\"\\u201c]?([^\\"\\u201d，,。；;\\\\s的等和与]{2,30})");
    private static final Pattern QUERY_OF = Pattern.compile("(?:查询|查一下|查查|搜一下|检索)\\\\s*(?:关于|有关)?\\\\s*[\\"\\u201c]?([^\\"\\u201d，,。；;\\\\s的等和与]{2,30})");

    /** 结束时间表述抽取：到今晚8点 / 到明天中午 / 至 18:00
     *  终止符含「结束 / 为止 / 之前 / 截止」等动词虚词，避免把「今晚8点结束」整段抽出 */
    private static final Pattern UNTIL = Pattern.compile("(?:到|至|截止到?)\\\\s*([^，,。；;结束为止之前]{2,20})");

    static {
        // ⚠ 声明顺序 = 平票仲裁顺序（命中数相同时取先声明者）。
        //   排序原则：**具体意图优先于泛化意图**。实测踩坑：
        //   「研判一下这条舆情」同时命中 TRIGGER_ANALYSIS 的「研判」与 QUERY_OPINION 的「舆情」，
        //   两者各命中 1 次平票 —— 若把泛化的「舆情」放前面，会误判成「查询舆情」而丢掉研判意图。
        //   因此把写操作 / 具体动作类（建任务、研判、生成报告）排在泛化的查询类之前。
        KEYWORDS.put(WecomCommandType.CREATE_TASK, List.of("建任务", "建个任务", "创建任务", "新建任务", "临时任务", "专项任务", "加个任务"));
        KEYWORDS.put(WecomCommandType.TRIGGER_ANALYSIS, List.of("研判", "分析一下", "智能分析"));
        KEYWORDS.put(WecomCommandType.TRIGGER_REPORT, List.of("生成报告", "出报告", "生成日报", "生成月报", "出个日报", "出个月报", "日报", "月报"));
        KEYWORDS.put(WecomCommandType.QUERY_TASK, List.of("查任务", "任务状态", "采集任务", "任务进度", "任务列表"));
        KEYWORDS.put(WecomCommandType.QUERY_ALERT, List.of("预警", "告警", "报警", "风险提示"));
        KEYWORDS.put(WecomCommandType.QUERY_OPINION, List.of("舆情", "查一下", "查询", "搜一下", "检索"));
        KEYWORDS.put(WecomCommandType.HELP, List.of("帮助", "怎么用", "指令", "help", "菜单"));
    }

    /**
     * 解析指令。
     *
     * @param text 用户输入的原始指令
     * @param maxLength 允许的最大长度（超长直接判为未识别，防打爆解析）
     * @return 解析结果，永不为 null
     */
    public ParsedCommand parse(String text, int maxLength) {
        if (text == null || text.isBlank()) {
            return ParsedCommand.unknown("指令为空");
        }
        String t = text.trim();
        if (maxLength > 0 && t.length() > maxLength) {
            return ParsedCommand.unknown("指令过长（" + t.length() + " > " + maxLength + "）");
        }
        String lower = t.toLowerCase();

        WecomCommandType best = WecomCommandType.UNKNOWN;
        int bestHits = 0;
        String bestHitWord = null;

        for (Map.Entry<WecomCommandType, List<String>> e : KEYWORDS.entrySet()) {
            for (String kw : e.getValue()) {
                if (lower.contains(kw.toLowerCase())) {
                    int hits = countHits(lower, e.getValue());
                    // 同命中数时，先声明者优先。
                    // ⚠ 声明顺序已被刻意排序为「具体意图优先于泛化意图」——
                    //   实测：「研判一下这条舆情」同时命中 TRIGGER_ANALYSIS 的「研判」与 QUERY_OPINION 的「舆情」，
                    //   各命中 1 次平票，若泛化的「舆情」在前会误判成查询，丢掉研判意图。
                    //   KEYWORDS 的 put 顺序即仲裁顺序，调整顺序前务必先跑 F012WecomTest。
                    if (hits > bestHits) {
                        bestHits = hits;
                        best = e.getKey();
                        bestHitWord = kw;
                    }
                }
            }
        }

        /* 参数抽取统一在此处进行，**不因类型未识别而丢弃**。
         * 实测踩坑：早期实现把「未识别则直接 return」放在抽取之前，
         * 导致「建个任务，到今晚8点结束」这类未命中关键词的指令，
         * 连抽到的 untilText 都一起丢了 —— 排查时看不到任何有用信息。 */
        Map<String, String> params = new LinkedHashMap<>();
        String keyword = extractKeyword(t);
        if (keyword != null) {
            params.put("keyword", keyword);
        }
        String until = extract(t, UNTIL);
        if (until != null) {
            params.put("untilText", until);
        }

        if (best == WecomCommandType.UNKNOWN) {
            params.put("reason", "未命中任何指令关键词");
            return new ParsedCommand(WecomCommandType.UNKNOWN, 0d, keyword, params);
        }

        params.put("hitWord", bestHitWord);
        double confidence = Math.min(1.0d, 0.5d + bestHits * 0.15d);
        return new ParsedCommand(best, confidence, keyword, params);
    }

    /** 抽取查询/建任务的核心对象词 */
    private static String extractKeyword(String t) {
        String k = extract(t, ABOUT);
        if (k == null) {
            k = extract(t, QUERY_OF);
        }
        return k;
    }

    private static String extract(String text, Pattern p) {
        Matcher m = p.matcher(text);
        if (m.find()) {
            String g = m.group(1);
            if (g == null) {
                return null;
            }
            String v = g.trim();
            return v.isEmpty() ? null : v;
        }
        return null;
    }

    private static int countHits(String lower, List<String> words) {
        int n = 0;
        for (String w : words) {
            if (lower.contains(w.toLowerCase())) {
                n++;
            }
        }
        return n;
    }
}
`,
  },

  /* ------------------------------------------------------------ 免登服务 */

  {
    rel: 'wecom/WecomLoginService.java',
    content: `package org.dromara.yuqing.wecom;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.constant.SystemConstants;
import org.dromara.common.satoken.utils.LoginHelper;
import org.dromara.system.domain.vo.SysUserVo;
import org.dromara.system.mapper.SysUserMapper;
import org.dromara.yuqing.wecom.config.YqWecomProperties;
import org.dromara.web.domain.vo.LoginVo;
import org.dromara.web.service.IAuthStrategy;
import org.dromara.web.service.SysLoginService;
import org.dromara.system.domain.vo.SysClientVo;
import org.springframework.stereotype.Service;

import cn.dev33.satoken.stp.StpUtil;
import cn.dev33.satoken.stp.parameter.SaLoginParameter;

import java.io.IOException;

/**
 * 企业微信网页授权免登服务（F-012 验收标准 1）
 *
 * <p><b>流程：</b>code → 企微换成员身份 → 映射若依用户 → 构造 LoginUser → 签发 token。</p>
 *
 * <p><b>关键设计（与若依登录体系对齐）：</b>
 * 本服务仿 {@code PasswordAuthStrategy} 的写法：拿 {@link SysClientVo} 的 clientKey/deviceType
 * 填充 LoginUser，并用 {@link IAuthStrategy#buildLoginParameter} 构造登录参数 ——
 * 这样签发的 token 与账号密码登录签发的 token 结构完全一致，
 * H5 端 {@code App-Token} 的后续请求才能通过 {@code @SaCheckPermission} 鉴权。</p>
 *
 * <p><b>安全：</b></p>
 * <ul>
 *   <li>只信任企微服务端返回的 UserId，不信任前端传入的任何用户标识；</li>
 *   <li>映射不到若依用户时明确抛错，<b>不自动创建账号</b>；</li>
 *   <li>校验用户状态（停用 / 已删除一律拒绝）。</li>
 * </ul>
 *
 * @author ruoyi
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WecomLoginService {

    private final YqWecomProperties props;
    private final WecomApiClient apiClient;
    private final WecomBindResolver bindResolver;
    private final SysLoginService loginService;
    private final SysUserMapper userMapper;

    /**
     * 用企业微信授权 code 完成免登并返回登录凭证。
     *
     * @param code   企微网页授权 code
     * @param client 当前客户端配置（H5 应用端 clientId 对应的配置）
     * @return 登录结果（accessToken / expireIn / clientId）
     * @throws IOException 企微接口调用失败
     * @throws WecomLoginException 免登不可用或用户映射失败（业务异常，含用户可读原因）
     */
    public LoginVo loginByCode(String code, SysClientVo client) throws IOException {
        if (!props.isEnabled()) {
            throw new WecomLoginException("企业微信免登未启用，请使用账号密码登录");
        }
        if (!apiClient.configured()) {
            throw new WecomLoginException("企业微信免登凭据未配置，请联系管理员或使用账号密码登录");
        }
        if (code == null || code.isBlank()) {
            throw new WecomLoginException("缺少企业微信授权 code");
        }

        // 1. 换成员身份（只信企微服务端结果）
        WecomMemberInfo member = apiClient.getUserInfoByCode(code);
        if (!member.isEnterpriseMember()) {
            throw new WecomLoginException("当前企业微信账号不是本企业成员，无法免登");
        }
        String wecomUserId = member.userId();

        // 2. 映射若依用户
        Long userId = bindResolver.resolve(wecomUserId);
        if (userId == null) {
            log.warn("[企微] 免登失败：成员 {} 未映射到任何若依用户", wecomUserId);
            throw new WecomLoginException("该企业微信成员未绑定系统账号，请联系管理员在后台完成绑定");
        }

        // 3. 校验用户状态
        SysUserVo user = userMapper.selectVoById(userId);
        if (user == null) {
            throw new WecomLoginException("绑定关系已失效，请重新绑定");
        }
        if (SystemConstants.DISABLE.equals(user.getStatus())) {
            log.warn("[企微] 免登被拒：用户 {} 已停用", userId);
            throw new WecomLoginException("账号已停用，请联系管理员");
        }

        // 4. 构造登录用户（口径与账号密码登录一致）
        var loginUser = loginService.buildLoginUser(user);
        loginUser.setClientKey(client.getClientKey());
        loginUser.setDeviceType(client.getDeviceType());
        SaLoginParameter model = IAuthStrategy.buildLoginParameter(client);

        // 5. 签发 token
        LoginHelper.login(loginUser, model);

        // 6. 留痕绑定（失败不阻塞主流程）
        bindResolver.recordBinding(userId, wecomUserId);

        LoginVo vo = new LoginVo();
        vo.setAccessToken(StpUtil.getTokenValue());
        vo.setExpireIn(StpUtil.getTokenTimeout());
        vo.setClientId(client.getClientId());
        log.info("[企微] 免登成功 userId={} wecomUserId={}", userId, wecomUserId);
        return vo;
    }
}
`,
  },

  {
    rel: 'wecom/WecomLoginException.java',
    content: `package org.dromara.yuqing.wecom;

/**
 * 企业微信免登业务异常（F-012 验收标准 1 / 11）
 *
 * <p>携带用户可读原因：H5 端会把它直接展示成提示文案，
 * 因此 message 必须是人话，不能是堆栈或错误码。</p>
 *
 * @author ruoyi
 */
public class WecomLoginException extends RuntimeException {

    public WecomLoginException(String message) {
        super(message);
    }

    public WecomLoginException(String message, Throwable cause) {
        super(message, cause);
    }
}
`,
  },

];
