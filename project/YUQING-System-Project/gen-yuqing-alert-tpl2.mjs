/**
 * F-011 企业微信推送引擎模板
 */
export const PUSH_TPL = [

  /* ------------------------------------------------------------- 场景常量 */
  {
    rel: 'push/PushScene.java',
    content: `package org.dromara.yuqing.push;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * 推送场景（F-011 验收标准 2 / 字典 {@code yq_push_scene}）
 *
 * @author ruoyi
 */
public final class PushScene {

    /** 新增舆情 */
    public static final String NEW_OPINION = "new_opinion";

    /** 高风险舆情 */
    public static final String HIGH_RISK = "high_risk";

    /** 批量研判完成 */
    public static final String BATCH_COMPLETED = "batch_completed";

    /** 报告生成完成 */
    public static final String REPORT_READY = "report_ready";

    private PushScene() {
    }

    public static boolean isKnown(String scene) {
        return NEW_OPINION.equals(scene) || HIGH_RISK.equals(scene)
            || BATCH_COMPLETED.equals(scene) || REPORT_READY.equals(scene);
    }

    /** 解析逗号分隔的场景串，忽略空白与未知取值 */
    public static Set<String> parse(String csv) {
        Set<String> out = new LinkedHashSet<>();
        if (csv == null || csv.isBlank()) {
            return out;
        }
        for (String part : csv.split("[,，;；\\s]+")) {
            String s = part.trim();
            if (isKnown(s)) {
                out.add(s);
            }
        }
        return out;
    }

    public static boolean contains(String csv, String scene) {
        return parse(csv).contains(scene);
    }
}
`,
  },

  /* -------------------------------------------------------------- 免打扰 */
  {
    rel: 'push/QuietHours.java',
    content: `package org.dromara.yuqing.push;

import java.time.LocalTime;
import java.time.format.DateTimeParseException;

/**
 * 免打扰时段判定（F-011 验收标准 1）
 *
 * <p>支持跨夜时段（如 22:00 → 08:00）。约定：</p>
 * <ul>
 *   <li>任一端解析失败 → 视为未配置，不在免打扰内（宁可多发，不可漏发）。</li>
 *   <li>起止相同 → 视为未配置（防止误配成「全天免打扰」把预警全部吞掉）。</li>
 * </ul>
 *
 * @author ruoyi
 */
public final class QuietHours {

    private QuietHours() {
    }

    /** 解析 HH:mm；失败返回 null */
    public static LocalTime parse(String hhmm) {
        if (hhmm == null || hhmm.isBlank()) {
            return null;
        }
        String v = hhmm.trim();
        try {
            return LocalTime.parse(v.length() == 4 ? "0" + v : v);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    /**
     * 当前时刻是否处于免打扰时段
     *
     * @param start 起始 HH:mm
     * @param end   结束 HH:mm
     * @param now   当前时刻
     */
    public static boolean inQuiet(String start, String end, LocalTime now) {
        LocalTime s = parse(start);
        LocalTime e = parse(end);
        if (s == null || e == null || s.equals(e) || now == null) {
            return false;
        }
        if (s.isBefore(e)) {
            // 同日区间 [s, e)
            return !now.isBefore(s) && now.isBefore(e);
        }
        // 跨夜区间 [s, 24:00) ∪ [00:00, e)
        return !now.isBefore(s) || now.isBefore(e);
    }

    /**
     * 免打扰结束时刻（用于把定时批量顺延）
     *
     * @return 结束时刻；未配置返回 null
     */
    public static LocalTime resolveResumeTime(String end) {
        return parse(end);
    }
}
`,
  },

  /* ---------------------------------------------------------- 目标人目录 */
  {
    rel: 'push/PushUserDirectory.java',
    content: `package org.dromara.yuqing.push;

import java.util.Set;

/**
 * 推送目标人目录
 *
 * <p>抽成接口的原因有二：一是按角色/部门/人员三种口径的解析策略不同，
 * 二是离线自测需要注入内存实现（无 Spring 上下文、无数据库）。</p>
 *
 * @author ruoyi
 */
public interface PushUserDirectory {

    /** 按角色解析出用户 ID 集合 */
    Set<Long> byRole(Long roleId);

    /** 按部门解析出用户 ID 集合 */
    Set<Long> byDept(Long deptId);

    /** 直接解析逗号分隔的用户 ID 串，非法片段静默丢弃 */
    Set<Long> byExplicit(String csvIds);

    /**
     * 把系统用户 ID 映射为企业微信成员 ID
     *
     * @return 企微成员 ID；无法映射返回 null
     */
    String wecomUserId(Long userId);
}
`,
  },

  {
    rel: 'push/JdbcPushUserDirectory.java',
    content: `package org.dromara.yuqing.push;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * 基于 JDBC 的目标人目录实现
 *
 * <p><b>安全：</b>全部查询走 {@code ?} 预编译占位符，任何用户输入都不参与 SQL 拼接，
 * 杜绝注入；返回列只取 user_id / user_name，不带出手机号等敏感字段。</p>
 *
 * <p><b>企微成员 ID 映射口径（已知边界，需按实际通讯录对齐）：</b>
 * 优先取该用户在企业微信指令表 {@code yq_wecom_command} 中最近一次登记的
 * {@code wecom_user_id}；查不到则回落为登录名 {@code sys_user.user_name}
 * （企业微信成员 ID 常与域账号一致，这是常见部署约定）。两者都拿不到时返回 null，
 * 由上层把该目标计入失败原因，<b>不做静默丢弃</b>。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JdbcPushUserDirectory implements PushUserDirectory {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public Set<Long> byRole(Long roleId) {
        if (roleId == null) {
            return new LinkedHashSet<>();
        }
        List<Long> ids = jdbcTemplate.queryForList(
            "select ur.user_id from sys_user_role ur "
                + "join sys_user u on u.user_id = ur.user_id "
                + "where ur.role_id = ? and u.status = '0' and u.del_flag = '0'",
            Long.class, roleId);
        return new LinkedHashSet<>(ids);
    }

    @Override
    public Set<Long> byDept(Long deptId) {
        if (deptId == null) {
            return new LinkedHashSet<>();
        }
        List<Long> ids = jdbcTemplate.queryForList(
            "select u.user_id from sys_user u "
                + "where u.dept_id = ? and u.status = '0' and u.del_flag = '0'",
            Long.class, deptId);
        return new LinkedHashSet<>(ids);
    }

    @Override
    public Set<Long> byExplicit(String csvIds) {
        Set<Long> out = new LinkedHashSet<>();
        if (csvIds == null || csvIds.isBlank()) {
            return out;
        }
        for (String part : csvIds.split("[,，;；\\s]+")) {
            String s = part.trim();
            if (s.isEmpty()) {
                continue;
            }
            try {
                out.add(Long.valueOf(s));
            } catch (NumberFormatException e) {
                log.warn("[推送] 目标 ID 非法，已忽略: {}", s);
            }
        }
        return out;
    }

    @Override
    public String wecomUserId(Long userId) {
        if (userId == null) {
            return null;
        }
        List<String> fromCommand = jdbcTemplate.queryForList(
            "select wecom_user_id from yq_wecom_command "
                + "where user_id = ? and wecom_user_id is not null and wecom_user_id <> '' "
                + "order by command_id desc limit 1",
            String.class, userId);
        String mapped = fromCommand.stream().filter(Objects::nonNull).findFirst().orElse(null);
        if (mapped != null && !mapped.isBlank()) {
            return mapped;
        }
        List<String> names = jdbcTemplate.queryForList(
            "select user_name from sys_user where user_id = ?", String.class, userId);
        String name = names.stream().filter(Objects::nonNull).findFirst().orElse(null);
        return (name == null || name.isBlank()) ? null : name;
    }
}
`,
  },

  {
    rel: 'push/PushTargetResolver.java',
    content: `package org.dromara.yuqing.push;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * 推送目标解析（F-011 验收标准 1）
 *
 * <p>把「按角色 / 按部门 / 按指定人员」三种配置口径统一解析为系统用户 ID 集合。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PushTargetResolver {

    private final PushUserDirectory directory;

    /**
     * 解析目标
     *
     * @param targetType role / dept / user
     * @param targetIds  逗号分隔的 ID 串
     */
    public Set<Long> resolve(String targetType, String targetIds) {
        Set<Long> out = new LinkedHashSet<>();
        if (targetType == null || targetIds == null || targetIds.isBlank()) {
            return out;
        }
        if ("user".equals(targetType)) {
            return directory.byExplicit(targetIds);
        }
        for (Long id : directory.byExplicit(targetIds)) {
            if ("role".equals(targetType)) {
                out.addAll(directory.byRole(id));
            } else if ("dept".equals(targetType)) {
                out.addAll(directory.byDept(id));
            } else {
                log.warn("[推送] 未知目标类型，已忽略: {}", targetType);
                return new LinkedHashSet<>();
            }
        }
        return out;
    }

    /**
     * 把系统用户 ID 集合映射为企业微信成员 ID 串
     *
     * @return 结果对象（同时带回无法映射的用户，供失败原因留痕）
     */
    public WecomTargets toWecom(Set<Long> userIds) {
        StringBuilder sb = new StringBuilder();
        StringBuilder unmapped = new StringBuilder();
        int ok = 0;
        if (userIds != null) {
            for (Long uid : userIds) {
                String wu = directory.wecomUserId(uid);
                if (wu == null || wu.isBlank()) {
                    if (unmapped.length() > 0) {
                        unmapped.append(',');
                    }
                    unmapped.append(uid);
                    continue;
                }
                if (sb.length() > 0) {
                    sb.append('|');
                }
                sb.append(wu);
                ok++;
            }
        }
        return new WecomTargets(sb.toString(), unmapped.toString(), ok, userIds == null ? 0 : userIds.size());
    }

    /** 企微目标解析结果 */
    public static class WecomTargets {

        private final String touser;
        private final String unmappedUserIds;
        private final int mapped;
        private final int total;

        public WecomTargets(String touser, String unmappedUserIds, int mapped, int total) {
            this.touser = touser;
            this.unmappedUserIds = unmappedUserIds;
            this.mapped = mapped;
            this.total = total;
        }

        public String getTouser() {
            return touser;
        }

        public String getUnmappedUserIds() {
            return unmappedUserIds;
        }

        public int getMapped() {
            return mapped;
        }

        public int getTotal() {
            return total;
        }

        public boolean isEmpty() {
            return touser == null || touser.isEmpty();
        }
    }
}
`,
  },

  /* ------------------------------------------------------------ 模板渲染 */
  {
    rel: 'push/PushTemplateRenderer.java',
    content: `package org.dromara.yuqing.push;

import lombok.RequiredArgsConstructor;
import org.dromara.yuqing.alert.AlertCandidate;
import org.dromara.yuqing.alert.config.YqAlertProperties;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 推送模板渲染（F-011 验收标准 5 / 6 / 7）
 *
 * <p>统一明细模板固定包含 10 个要素：舆情标题、舆情等级、发布平台、发布时间、
 * 舆情核心内容、风险分析、传播态势、舆情原文链接、处置建议、推送时间。</p>
 *
 * <p>摘要模板包含采集概况统计与负面明细列表。</p>
 *
 * <p>长正文一律按 {@code push.maxContentChars} 截断并保留原文链接，
 * 保证单条消息不超企业微信应用消息上限。</p>
 *
 * @author ruoyi
 */
@RequiredArgsConstructor
@Component
public class PushTemplateRenderer {

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final YqAlertProperties props;

    /** 明细式（单条舆情，含 10 要素） */
    public String renderDetail(AlertCandidate c, String alertLevel, LocalDateTime pushTime) {
        AlertCandidate x = c == null ? new AlertCandidate() : c;
        int max = maxChars();
        Map<String, String> v = new LinkedHashMap<>();
        v.put("title", nvl(x.getTitle(), "(无标题)"));
        v.put("level", levelText(alertLevel == null ? x.getOpinionLevel() : alertLevel));
        v.put("channel", nvl(x.getChannelName(), x.getChannelId() == null ? "未知" : String.valueOf(x.getChannelId())));
        v.put("publishTime", x.getPublishTime() == null ? "未知" : FMT.format(x.getPublishTime()));
        v.put("content", truncate(nvl(x.getContent(), "(无正文)"), max));
        v.put("risk", riskText(x.getRiskLevel()));
        v.put("spread", spreadText(x));
        v.put("url", nvl(x.getOpinionUrl(), "无原文链接"));
        v.put("suggestion", suggestionText(alertLevel));
        v.put("pushTime", FMT.format(pushTime == null ? LocalDateTime.now() : pushTime));

        StringBuilder sb = new StringBuilder();
        sb.append("【舆情预警】").append(v.get("title")).append('\\n');
        sb.append("舆情等级：").append(v.get("level")).append('\\n');
        sb.append("发布平台：").append(v.get("channel")).append('\\n');
        sb.append("发布时间：").append(v.get("publishTime")).append('\\n');
        sb.append("核心内容：").append(v.get("content")).append('\\n');
        sb.append("风险分析：").append(v.get("risk")).append('\\n');
        sb.append("传播态势：").append(v.get("spread")).append('\\n');
        sb.append("原文链接：").append(v.get("url")).append('\\n');
        sb.append("处置建议：").append(v.get("suggestion")).append('\\n');
        sb.append("推送时间：").append(v.get("pushTime"));
        return truncate(sb.toString(), max);
    }

    /** 摘要式（采集概况 + 负面明细，验收标准 6） */
    public String renderSummary(String taskName, int total, int negative, int neutral, int deduped,
                                List<AlertCandidate> negatives, LocalDateTime pushTime) {
        int max = maxChars();
        StringBuilder sb = new StringBuilder();
        sb.append("【舆情采集概况】").append(nvl(taskName, "全站")).append('\\n');
        sb.append("采集总数：").append(total)
            .append(" ｜ 负面：").append(negative)
            .append(" ｜ 中性：").append(neutral)
            .append(" ｜ 去重后：").append(deduped).append('\\n');
        sb.append("负面明细：").append('\\n');
        if (negatives == null || negatives.isEmpty()) {
            sb.append("（无）").append('\\n');
        } else {
            int i = 1;
            for (AlertCandidate c : negatives) {
                sb.append(i++).append(". ").append(nvl(c.getTitle(), "(无标题)"))
                    .append(" | ").append(nvl(c.getChannelName(), "未知渠道"))
                    .append(" | ").append(c.getPublishTime() == null ? "未知" : FMT.format(c.getPublishTime()))
                    .append(" | ").append(levelText(c.getRiskLevel() == null ? c.getOpinionLevel() : c.getRiskLevel()))
                    .append('\\n');
                sb.append("   链接：").append(nvl(c.getOpinionUrl(), "无")).append('\\n');
                sb.append("   内容：").append(truncate(nvl(c.getContent(), "(无正文)"), 120)).append('\\n');
                if (sb.length() > max) {
                    sb.append("…（明细过长已截断，完整列表见平台台账）");
                    return truncate(sb.toString(), max);
                }
            }
        }
        sb.append("推送时间：").append(FMT.format(pushTime == null ? LocalDateTime.now() : pushTime));
        return truncate(sb.toString(), max);
    }

    /** 按自定义模板占位符渲染（占位符形如 {title}） */
    public String applyTemplate(String bodyTemplate, Map<String, String> vars) {
        if (bodyTemplate == null) {
            return "";
        }
        String out = bodyTemplate;
        if (vars != null) {
            for (Map.Entry<String, String> e : vars.entrySet()) {
                out = out.replace("{" + e.getKey() + "}", nvl(e.getValue(), ""));
            }
        }
        // 未在 vars 中提供的占位符一律清空：否则 {url} 这种字面量会被直接发到企业微信，
        // 既泄露内部实现，也让接收人以为是平台故障。
        return truncate(dropUnknownPlaceholders(out), maxChars());
    }

    /** 去掉模板里未被 vars 提供的 {xxx} 占位符（只认单层、长度受限的占位符，避免误删正文花括号） */
    private static String dropUnknownPlaceholders(String s) {
        StringBuilder sb = new StringBuilder(s.length());
        int i = 0;
        while (i < s.length()) {
            char c = s.charAt(i);
            if (c == '{') {
                int close = s.indexOf('}', i + 1);
                if (close > i && close - i <= 33) {
                    i = close + 1;
                    continue;
                }
            }
            sb.append(c);
            i++;
        }
        return sb.toString();
    }

    /** 截断并加省略号；不截断时原样返回 */
    public String truncate(String s, int max) {
        if (s == null) {
            return "";
        }
        int limit = max > 0 ? max : 1500;
        if (s.length() <= limit) {
            return s;
        }
        return s.substring(0, Math.max(0, limit - 1)) + "…";
    }

    private int maxChars() {
        return props.getPush().getMaxContentChars() > 0 ? props.getPush().getMaxContentChars() : 1500;
    }

    private static String nvl(String s, String dft) {
        return (s == null || s.isBlank()) ? dft : s;
    }

    private static String levelText(String level) {
        if (level == null) {
            return "未分级";
        }
        switch (level) {
            case "normal":
                return "一般";
            case "attention":
                return "关注";
            case "warning":
                return "预警";
            case "urgent":
                return "紧急";
            case "general":
                return "一般风险";
            case "moderate":
                return "较重风险";
            case "severe":
                return "严重风险";
            default:
                return level;
        }
    }

    private static String riskText(String riskLevel) {
        if (riskLevel == null) {
            return "未识别到明确风险等级（待智能研判补充）";
        }
        switch (riskLevel) {
            case "severe":
                return "严重：负面情绪集中，存在进一步发酵与大范围扩散可能，需立即介入";
            case "moderate":
                return "较重：负面舆情已有一定传播，需持续盯防并准备统一口径";
            case "general":
                return "一般：负面情绪存在但传播有限，建议例行跟踪";
            default:
                return riskLevel;
        }
    }

    private static String spreadText(AlertCandidate c) {
        String level = c.getSpreadLevel();
        String base;
        if (level == null) {
            base = "传播量级待评估";
        } else {
            switch (level) {
                case "viral":
                    base = "爆（大规模扩散）";
                    break;
                case "high":
                    base = "高（快速扩散）";
                    break;
                case "medium":
                    base = "中（局部传播）";
                    break;
                case "low":
                    base = "低（传播有限）";
                    break;
                default:
                    base = level;
            }
        }
        Long read = c.getReadCount();
        if (read != null && read > 0) {
            base = base + "，阅读 " + read;
        }
        return base;
    }

    private static String suggestionText(String alertLevel) {
        if (alertLevel == null) {
            return "建议按常规监测流程跟踪";
        }
        switch (alertLevel) {
            case "urgent":
                return "建议 30 分钟内核实情况并上报分管负责人，同步准备对外口径";
            case "warning":
                return "建议 2 小时内完成事实核查，明确责任部门并跟踪传播走势";
            case "attention":
                return "建议当日完成核查并纳入观察名单";
            default:
                return "建议按常规监测流程跟踪";
        }
    }
}
`,
  },

  /* ------------------------------------------------------------ 传输通道 */
  {
    rel: 'push/WecomTransport.java',
    content: `package org.dromara.yuqing.push;

import java.io.IOException;

/**
 * 企业微信消息通道 SPI（F-011 验收标准 4 / 10）
 *
 * <p>抽成 SPI 的意义：生产注入真实 HTTP 通道；凭据缺失或离线自测时注入日志通道，
 * <b>并且日志通道会把结果标记为失败</b>，绝不静默假装成功——
 * 一次没发出去的预警如果不留失败痕迹，整条预警链路就等于不存在。</p>
 *
 * @author ruoyi
 */
public interface WecomTransport {

    /** 通道名（用于推送记录留痕） */
    String name();

    /** 发送文本消息 */
    SendResult sendText(String touser, String content);

    /** 发送 markdown 消息 */
    SendResult sendMarkdown(String touser, String content);

    /** 上传文件并发送文件消息（报告推送，验收标准 10） */
    SendResult sendFile(String touser, String fileName, byte[] bytes);

    /** 发送结果 */
    class SendResult {

        private final boolean ok;
        private final int errcode;
        private final String errmsg;
        private final String raw;

        public SendResult(boolean ok, int errcode, String errmsg, String raw) {
            this.ok = ok;
            this.errcode = errcode;
            this.errmsg = errmsg;
            this.raw = raw;
        }

        public static SendResult ok(String raw) {
            return new SendResult(true, 0, "ok", raw);
        }

        public static SendResult fail(int errcode, String errmsg) {
            return new SendResult(false, errcode, errmsg, null);
        }

        public boolean isOk() {
            return ok;
        }

        public int getErrcode() {
            return errcode;
        }

        public String getErrmsg() {
            return errmsg;
        }

        public String getRaw() {
            return raw;
        }

        /** 失败原因描述（落 fail_reason） */
        public String failReason() {
            if (ok) {
                return null;
            }
            String msg = errmsg == null || errmsg.isBlank() ? "未知错误" : errmsg;
            return "errcode=" + errcode + " errmsg=" + msg;
        }
    }
}
`,
  },

  {
    rel: 'push/WecomTokenHolder.java',
    content: `package org.dromara.yuqing.push;

import lombok.extern.slf4j.Slf4j;
import org.dromara.common.json.utils.JsonUtils;
import org.dromara.yuqing.alert.config.YqAlertProperties;
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
 * 企业微信 access_token 持有者
 *
 * <p>token 有效期 7200 秒，这里提前 300 秒过期以避开边界；
 * 刷新失败不抛给业务方之外的线程（加锁双检，避免并发风暴刷爆企微接口限频）。</p>
 *
 * @author ruoyi
 */
@Slf4j
public class WecomTokenHolder {

    private static final long EARLY_EXPIRE_MS = 300_000L;

    private final YqAlertProperties props;
    private final HttpClient http;

    private volatile String token;
    private volatile long expireAtMs;

    public WecomTokenHolder(YqAlertProperties props) {
        this.props = props;
        YqAlertProperties.Push p = props.getPush();
        this.http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofMillis(p.getConnectTimeoutMs()))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();
    }

    /** 取有效 token，必要时刷新 */
    public synchronized String get() throws IOException {
        long now = System.currentTimeMillis();
        if (token != null && now < expireAtMs) {
            return token;
        }
        YqAlertProperties.Push p = props.getPush();
        String url = p.getApiBase() + "/cgi-bin/gettoken?corpid="
            + enc(p.getCorpId()) + "&corpsecret=" + enc(p.getCorpSecret());
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofMillis(p.getReadTimeoutMs()))
                .GET()
                .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            JsonNode node = JsonUtils.parseObject(resp.body(), JsonNode.class);
            if (node == null) {
                throw new IOException("企业微信 gettoken 返回无法解析: " + brief(resp.body()));
            }
            int errcode = node.path("errcode").asInt(-1);
            if (errcode != 0) {
                throw new IOException("企业微信 gettoken 失败 errcode=" + errcode
                    + " errmsg=" + node.path("errmsg").asString(""));
            }
            String t = node.path("access_token").asString("");
            int expires = node.path("expires_in").asInt(7200);
            if (t.isEmpty()) {
                throw new IOException("企业微信 gettoken 未返回 access_token");
            }
            this.token = t;
            this.expireAtMs = System.currentTimeMillis() + Math.max(60, expires) * 1000L - EARLY_EXPIRE_MS;
            log.info("[企微] access_token 已刷新，{} 秒后过期", expires);
            return t;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("企业微信 gettoken 被中断", e);
        }
    }

    /** 强制失效（收到 42001 / 40014 时调用） */
    public synchronized void invalidate() {
        this.token = null;
        this.expireAtMs = 0L;
    }

    private static String enc(String v) {
        return URLEncoder.encode(v == null ? "" : v, StandardCharsets.UTF_8);
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
    rel: 'push/HttpWecomTransport.java',
    content: `package org.dromara.yuqing.push;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.json.utils.JsonUtils;
import org.dromara.yuqing.alert.config.YqAlertProperties;
import tools.jackson.databind.JsonNode;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 企业微信应用消息真实通道（F-011）
 *
 * <p>接口：</p>
 * <ul>
 *   <li>{@code POST /cgi-bin/message/send} —— 文本 / markdown / 文件消息</li>
 *   <li>{@code POST /cgi-bin/media/upload} —— 文件上传换取 media_id</li>
 * </ul>
 *
 * <p>token 失效错误码（40014 / 42001）会自动失效并重试一次。</p>
 *
 * @author ruoyi
 */
@Slf4j
@RequiredArgsConstructor
public class HttpWecomTransport implements WecomTransport {

    private static final int HEAD = 40014;
    private static final int HEAD_EXPIRED = 42001;

    private final YqAlertProperties props;
    private final WecomTokenHolder tokenHolder;

    @Override
    public String name() {
        return "wecom-http";
    }

    @Override
    public SendResult sendText(String touser, String content) {
        Map<String, Object> text = new LinkedHashMap<>();
        text.put("content", content == null ? "" : content);
        return send(touser, "text", text);
    }

    @Override
    public SendResult sendMarkdown(String touser, String content) {
        Map<String, Object> md = new LinkedHashMap<>();
        md.put("content", content == null ? "" : content);
        return send(touser, "markdown", md);
    }

    @Override
    public SendResult sendFile(String touser, String fileName, byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            return SendResult.fail(-1, "文件内容为空");
        }
        String mediaId;
        try {
            mediaId = uploadMedia(fileName, bytes);
        } catch (IOException e) {
            return SendResult.fail(-1, "文件上传失败: " + e.getMessage());
        }
        Map<String, Object> media = new LinkedHashMap<>();
        media.put("media_id", mediaId);
        return send(touser, "file", media);
    }

    /* ------------------------------------------------------------------ 内部 */

    private SendResult send(String touser, String msgtype, Map<String, Object> body) {
        if (touser == null || touser.isBlank()) {
            return SendResult.fail(-1, "推送目标为空，未发送");
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("touser", touser);
        payload.put("msgtype", msgtype);
        payload.put("agentid", props.getPush().getAgentId());
        payload.put("safe", 0);
        payload.putAll(body);

        String json = JsonUtils.toJsonString(payload);
        SendResult first = post("/cgi-bin/message/send", json);
        if (!first.isOk() && (first.getErrcode() == HEAD || first.getErrcode() == HEAD_EXPIRED)) {
            // token 失效：失效重取后只重试一次，避免与上层重试策略叠加成风暴
            tokenHolder.invalidate();
            log.warn("[企微] token 失效，已刷新并重试一次");
            return post("/cgi-bin/message/send", json);
        }
        return first;
    }

    private SendResult post(String path, String json) {
        YqAlertProperties.Push p = props.getPush();
        try {
            String token = tokenHolder.get();
            String url = p.getApiBase() + path + "?access_token=" + token;
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofMillis(p.getReadTimeoutMs()))
                .header("Content-Type", "application/json; charset=UTF-8")
                .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                .build();
            HttpResponse<String> resp = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(p.getConnectTimeoutMs()))
                .build()
                .send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            return parse(resp.body());
        } catch (IOException e) {
            return SendResult.fail(-1, "网络异常: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return SendResult.fail(-1, "请求被中断");
        }
    }

    private String uploadMedia(String fileName, byte[] bytes) throws IOException {
        YqAlertProperties.Push p = props.getPush();
        String boundary = "----YuqingBoundary" + System.nanoTime();
        byte[] headBytes = ("--" + boundary + "\\r\\n"
            + "Content-Disposition: form-data; name=\\"media\\"; filename=\\"" + safeName(fileName) + "\\"\\r\\n"
            + "Content-Type: application/octet-stream\\r\\n\\r\\n").getBytes(StandardCharsets.UTF_8);
        byte[] tailBytes = ("\\r\\n--" + boundary + "--\\r\\n").getBytes(StandardCharsets.UTF_8);
        byte[] payload = new byte[headBytes.length + bytes.length + tailBytes.length];
        System.arraycopy(headBytes, 0, payload, 0, headBytes.length);
        System.arraycopy(bytes, 0, payload, headBytes.length, bytes.length);
        System.arraycopy(tailBytes, 0, payload, headBytes.length + bytes.length, tailBytes.length);

        String token = tokenHolder.get();
        // 上传接口要求 multipart，把 type 放在 query 上
        String url = p.getApiBase() + "/cgi-bin/media/upload?access_token=" + token + "&type=file";
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofMillis(p.getReadTimeoutMs() * 4L))
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(payload))
                .build();
            HttpResponse<String> resp = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(p.getConnectTimeoutMs()))
                .build()
                .send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            JsonNode node = JsonUtils.parseObject(resp.body(), JsonNode.class);
            if (node == null) {
                throw new IOException("media/upload 返回无法解析: " + brief(resp.body()));
            }
            int errcode = node.path("errcode").asInt(-1);
            if (errcode != 0) {
                throw new IOException("media/upload 失败 errcode=" + errcode + " errmsg=" + node.path("errmsg").asString(""));
            }
            String mediaId = node.path("media_id").asString("");
            if (mediaId.isEmpty()) {
                throw new IOException("media/upload 未返回 media_id");
            }
            return mediaId;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("文件上传被中断", e);
        }
    }

    private static SendResult parse(String body) {
        JsonNode node = JsonUtils.parseObject(body, JsonNode.class);
        if (node == null) {
            return SendResult.fail(-1, "响应无法解析: " + brief(body));
        }
        int errcode = node.path("errcode").asInt(-1);
        String errmsg = node.path("errmsg").asString("");
        if (errcode == 0) {
            return SendResult.ok(body);
        }
        return SendResult.fail(errcode, errmsg);
    }

    private static String safeName(String fileName) {
        if (fileName == null || fileName.isBlank()) {
            return "report.dat";
        }
        return fileName.replace("\\"", "").replace("\\r", "").replace("\\n", "");
    }

    private static String brief(String body) {
        if (body == null) {
            return "null";
        }
        return body.length() > 300 ? body.substring(0, 300) : body;
    }
}
`,
  },

  {
    rel: 'push/LoggingWecomTransport.java',
    content: `package org.dromara.yuqing.push;

import lombok.extern.slf4j.Slf4j;

/**
 * 日志降级通道
 *
 * <p>两种用途，语义严格区分（由构造参数决定）：</p>
 * <ol>
 *   <li><b>凭据缺失降级</b>（{@code markSuccess=false}）：一律返回失败。
 *       没配凭据就是「没发出去」，把结果标成 success 会让推送记录、成功率看板、
 *       失败重试全部失真，运维再也发现不了推送其实是空转。</li>
 *   <li><b>演练模式</b>（{@code markSuccess=true}，由 {@code push.dryRun} 打开）：
 *       人为开关，联调期避免打扰真实用户，按成功留痕并在内容里标注。</li>
 * </ol>
 *
 * @author ruoyi
 */
@Slf4j
public class LoggingWecomTransport implements WecomTransport {

    /** 默认：凭据缺失降级 —— 必须标记失败 */
    public static final String UNCONFIGURED_REASON =
        "企业微信凭据未配置（corpId/corpSecret/agentId），通道降级为日志，消息未发送";

    private final boolean markSuccess;
    private final String reason;

    /** 凭据缺失降级（默认用法） */
    public LoggingWecomTransport() {
        this(false, UNCONFIGURED_REASON);
    }

    /** 演练模式 */
    public LoggingWecomTransport(boolean markSuccess, String reason) {
        this.markSuccess = markSuccess;
        this.reason = reason == null ? UNCONFIGURED_REASON : reason;
    }

    public static LoggingWecomTransport dryRun() {
        return new LoggingWecomTransport(true, "演练模式（push.dryRun=true），消息未真正发送");
    }

    @Override
    public String name() {
        return markSuccess ? "logging-dryrun" : "logging-fallback";
    }

    @Override
    public SendResult sendText(String touser, String content) {
        log.warn("[推送降级] {}。touser={} content={}", reason, touser, brief(content));
        return result();
    }

    @Override
    public SendResult sendMarkdown(String touser, String content) {
        return sendText(touser, content);
    }

    @Override
    public SendResult sendFile(String touser, String fileName, byte[] bytes) {
        log.warn("[推送降级] {}。touser={} file={} size={}", reason, touser, fileName,
            bytes == null ? 0 : bytes.length);
        return result();
    }

    private SendResult result() {
        return markSuccess ? SendResult.ok(null) : SendResult.fail(-1, reason);
    }

    private static String brief(String s) {
        if (s == null) {
            return "";
        }
        return s.length() > 200 ? s.substring(0, 200) + "…" : s;
    }
}
`,
  },

  /* ------------------------------------------------------------ 重试策略 */
  {
    rel: 'push/PushRetryPolicy.java',
    content: `package org.dromara.yuqing.push;

/**
 * 推送失败重试策略（F-011 验收标准 8）
 *
 * <p>指数退避：第 n 次重试等待 {@code backoff * 2^(n-1)} 毫秒。
 * 重试上限耗尽的失败会把最终原因写入 {@code yq_push_record.fail_reason}，
 * 记录保持 {@code failed} 状态由前端标红，<b>不自动删除、不静默置成功</b>。</p>
 *
 * @author ruoyi
 */
public final class PushRetryPolicy {

    private PushRetryPolicy() {
    }

    /** 归一化重试上限：负数=显式禁用重试（0 次），0=未配置回落 fallback，硬上限 10 防止把企微接口打爆 */
    public static int normalizeMaxRetry(int configured, int fallback) {
        if (configured < 0) {
            return 0;
        }
        int v = configured > 0 ? configured : (fallback > 0 ? fallback : 0);
        return Math.min(v, 10);
    }

    /** 第 attempt 次重试（attempt 从 1 开始）的等待毫秒数 */
    public static long backoffMs(long base, int attempt) {
        if (base <= 0 || attempt <= 0) {
            return 0L;
        }
        int shift = Math.min(attempt - 1, 10);
        return base * (1L << shift);
    }

    /** 是否还有重试额度 */
    public static boolean canRetry(int retryCount, int maxRetry) {
        return retryCount < maxRetry;
    }
}
`,
  },

  /* ------------------------------------------------------------ 推送请求 */
  {
    rel: 'push/PushRequest.java',
    content: `package org.dromara.yuqing.push;

import lombok.Builder;
import lombok.Data;
import org.dromara.yuqing.alert.AlertCandidate;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 一次推送请求
 *
 * @author ruoyi
 */
@Data
@Builder
public class PushRequest {

    /** 推送场景（yq_push_scene） */
    private String scene;

    /** 推送级别 immediate / scheduled */
    private String pushLevel;

    /** 命中的推送规则 ID */
    private Long ruleId;
    private String ruleName;

    /** 消息形态：text / markdown / file */
    @Builder.Default
    private String msgType = "text";

    /** 内容形态：summary（摘要式）/ detail（明细式） */
    @Builder.Default
    private String contentType = "detail";

    /** 渲染好的消息正文（由 Service 调 PushTemplateRenderer 产出） */
    private String content;

    /** 文件内容（msgType = file 时使用） */
    private String fileName;
    private byte[] fileBytes;

    /** 解析后的目标用户（系统用户 ID） */
    private java.util.Set<Long> targetUserIds;

    /** 免打扰时段 */
    private String quietStart;
    private String quietEnd;

    /** 失败重试上限 */
    private int maxRetry;

    /** 关联舆情 ID（落 yq_push_record.opinion_ids） */
    private List<Long> opinionIds;

    /** 关联报告 ID */
    private Long reportId;

    /** 是否高风险直达（决定能否穿透免打扰） */
    private boolean highPriority;

    /** 推送时刻 */
    private LocalDateTime now;

    /** 候选快照（推送记录 content_snapshot 的可读来源） */
    private List<AlertCandidate> candidates;
}
`,
  },

  {
    rel: 'push/PushOutcome.java',
    content: `package org.dromara.yuqing.push;

import lombok.Data;

/**
 * 一次推送的执行结果
 *
 * <p>{@code kind} 取值：{@code sent}（已发送，成败看 success）/ {@code deferred}（免打扰顺延）
 * / {@code skipped}（无目标或开关关闭）。</p>
 *
 * @author ruoyi
 */
@Data
public class PushOutcome {

    public static final String SENT = "sent";
    public static final String DEFERRED = "deferred";
    public static final String SKIPPED = "skipped";

    private String kind = SKIPPED;

    /** 是否为成功发送（kind = sent 时有意义） */
    private boolean success;

    /** 落 yq_push_record.send_status 的值 */
    private String sendStatus;

    /** 失败原因 / 跳过原因 */
    private String reason;

    /** 实际重试次数 */
    private int retryCount;

    /** 实际下发的企微成员 ID 串 */
    private String wecomTargets;

    /** 无法映射为企微成员的系统用户 ID */
    private String unmappedUserIds;

    /** 通道名 */
    private String channel;

    /** 耗时毫秒 */
    private long costMs;

    /** 免打扰顺延到的时刻（kind = deferred） */
    private java.time.LocalTime deferredUntil;

    public static PushOutcome skipped(String reason) {
        PushOutcome o = new PushOutcome();
        o.setKind(SKIPPED);
        o.setSendStatus("pending");
        o.setReason(reason);
        return o;
    }

    public static PushOutcome deferred(String reason, java.time.LocalTime until) {
        PushOutcome o = new PushOutcome();
        o.setKind(DEFERRED);
        o.setSendStatus("pending");
        o.setReason(reason);
        o.setDeferredUntil(until);
        return o;
    }
}
`,
  },

  /* ---------------------------------------------------------------- 调度器 */
  {
    rel: 'push/PushDispatcher.java',
    content: `package org.dromara.yuqing.push;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.alert.config.YqAlertProperties;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * 推送调度器（F-011）
 *
 * <p>职责边界：只做「免打扰判定 → 目标映射 → 通道发送 → 指数退避重试」，
 * 内容渲染与落库分别在 {@link PushTemplateRenderer} 与 Service 层完成，
 * 便于各自单测。</p>
 *
 * <p><b>免打扰语义：</b>定时批量一律顺延；高风险直达在
 * {@code push.immediatePierceQuiet=true}（默认）时穿透——免打扰不该吞掉最要紧的预警。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PushDispatcher {

    private final YqAlertProperties props;
    private final PushTargetResolver targetResolver;
    private final WecomTransport transport;

    public PushOutcome dispatch(PushRequest req) {
        long t0 = System.currentTimeMillis();
        PushOutcome out = new PushOutcome();
        out.setChannel(transport.name());

        if (!props.getPush().isEnabled()) {
            out.setKind(PushOutcome.SKIPPED);
            out.setSendStatus("pending");
            out.setReason("推送总开关（yuqing.alert.push.enabled）已关闭");
            out.setCostMs(System.currentTimeMillis() - t0);
            return out;
        }

        LocalDateTime now = req.getNow() == null ? LocalDateTime.now() : req.getNow();
        boolean quiet = QuietHours.inQuiet(req.getQuietStart(), req.getQuietEnd(), now.toLocalTime());
        boolean pierce = req.isHighPriority() && props.getPush().isImmediatePierceQuiet();
        if (quiet && !pierce) {
            out.setKind(PushOutcome.DEFERRED);
            out.setSendStatus("pending");
            out.setReason("处于免打扰时段 " + req.getQuietStart() + "-" + req.getQuietEnd() + "，已顺延");
            out.setDeferredUntil(QuietHours.resolveResumeTime(req.getQuietEnd()));
            out.setCostMs(System.currentTimeMillis() - t0);
            return out;
        }

        PushTargetResolver.WecomTargets targets = targetResolver.toWecom(req.getTargetUserIds());
        out.setWecomTargets(targets.getTouser());
        out.setUnmappedUserIds(targets.getUnmappedUserIds());
        if (targets.isEmpty()) {
            out.setKind(PushOutcome.SKIPPED);
            out.setSendStatus("failed");
            String reason = targets.getTotal() == 0
                ? "推送目标解析为空（规则未配置有效对象）"
                : "目标均无法映射为企业微信成员 ID，共 " + targets.getTotal() + " 人，未发送";
            out.setReason(reason);
            out.setCostMs(System.currentTimeMillis() - t0);
            log.warn("[推送] {}", reason);
            return out;
        }

        int maxRetry = PushRetryPolicy.normalizeMaxRetry(req.getMaxRetry(), props.getPush().getMaxRetry());
        WecomTransport.SendResult result = null;
        int attempt = 0;
        while (true) {
            result = invoke(req, targets.getTouser());
            if (result.isOk()) {
                break;
            }
            if (!PushRetryPolicy.canRetry(attempt, maxRetry)) {
                break;
            }
            attempt++;
            long wait = PushRetryPolicy.backoffMs(props.getPush().getRetryBackoffMs(), attempt);
            if (wait > 0) {
                try {
                    Thread.sleep(wait);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }

        out.setKind(PushOutcome.SENT);
        out.setRetryCount(attempt);
        out.setSuccess(result.isOk());
        out.setSendStatus(result.isOk() ? "success" : "failed");
        String reason = result.failReason();
        if (!result.isOk() && targets.getUnmappedUserIds() != null && !targets.getUnmappedUserIds().isEmpty()) {
            reason = reason + "；另有 " + targets.getUnmappedUserIds().split(",").length + " 人未映射企微成员ID";
        }
        out.setReason(reason);
        out.setCostMs(System.currentTimeMillis() - t0);
        return out;
    }

    private WecomTransport.SendResult invoke(PushRequest req, String touser) {
        String type = req.getMsgType() == null ? "text" : req.getMsgType();
        switch (type) {
            case "markdown":
                return transport.sendMarkdown(touser, req.getContent());
            case "file":
                if (req.getFileBytes() == null || req.getFileBytes().length == 0) {
                    return WecomTransport.SendResult.fail(-1, "文件内容为空，未发送");
                }
                return transport.sendFile(touser, req.getFileName(), req.getFileBytes());
            default:
                return transport.sendText(touser, req.getContent());
        }
    }

    /** 定时批量顺延后的重投：仅判断当前是否已脱离免打扰 */
    public boolean canFlushNow(String quietStart, String quietEnd, LocalTime now) {
        return !QuietHours.inQuiet(quietStart, quietEnd, now);
    }
}
`,
  },

];
