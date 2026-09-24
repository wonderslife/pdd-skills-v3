/**
 * F-012 企微 H5 管控模板（三）：控制器 + 服务（扩展）+ 配置样例
 *
 * ⚠ 三层转义约定：Java 产物内不使用 \n / \t 转义序列；产物内不出现未转义反引号。
 */
export const WECOM_TPL3 = [

  /* ------------------------------------------------------------ 传输对象 */

  {
    rel: 'wecom/domain/WecomAuthVo.java',
    content: `package org.dromara.yuqing.wecom.domain;

import lombok.Data;

/**
 * 企微免登返回体（F-012 验收标准 1）
 *
 * <p>字段名与 H5 {@code auth.vue} 的取值逻辑对齐：页面兼容取
 * {@code access_token / accessToken / token}，这里统一返回 {@code accessToken} 并额外给 snake 别名，
 * 避免前端因命名差异拿不到 token。</p>
 *
 * @author ruoyi
 */
@Data
public class WecomAuthVo {

    /** Sa-Token 令牌 */
    private String accessToken;

    /** 令牌有效期（秒） */
    private Long expireIn;

    /** 客户端 ID */
    private String clientId;

    /** 若依用户 ID */
    private Long userId;

    /** 登录名 */
    private String userName;

    /** 昵称（展示用） */
    private String nickName;

    /** 企业微信成员 ID */
    private String wecomUserId;

    /** 是否免登成功 */
    private boolean success;

    /** 失败原因（success=false 时给前端展示） */
    private String message;
}
`,
  },

  {
    rel: 'wecom/domain/WecomHomeVo.java',
    content: `package org.dromara.yuqing.wecom.domain;

import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * 企微 H5 首页聚合视图（F-012 验收标准 2）
 *
 * <p>把「待处置预警数 / 当日采集概况 / 最近研判结论 / 待办报告入口」一次返回，
 * 避免 H5 首屏并发调 4 个列表接口 —— 移动网络下并发请求更容易出现「有的卡片有数、有的空白」。</p>
 *
 * @author ruoyi
 */
@Data
public class WecomHomeVo {

    /** 待处置预警数 */
    private long pendingAlertCount;

    /** 当日采集概况（采集量 / 去重量 / 降噪量 等） */
    private Map<String, Object> todayCollect;

    /** 待办报告列表 */
    private List<Map<String, Object>> todoReports;

    /** 最近研判结论 */
    private List<Map<String, Object>> recentAnalysis;

    /** 数据生成时间戳（毫秒） */
    private long generatedAt;
}
`,
  },

  {
    rel: 'wecom/domain/WecomSupplementBo.java',
    content: `package org.dromara.yuqing.wecom.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 补充事件信息请求体（F-012 验收标准 4）
 *
 * @author ruoyi
 */
@Data
public class WecomSupplementBo {

    /** 舆情链接（必填） */
    @NotBlank(message = "链接不能为空")
    @Size(max = 1000, message = "链接长度不能超过 1000 字符")
    private String url;

    /** 备注说明 */
    @Size(max = 500, message = "备注长度不能超过 500 字符")
    private String remark;

    /** 可选：关联任务 ID */
    private Long refTaskId;
}
`,
  },

  {
    rel: 'wecom/domain/WecomCommandBo.java',
    content: `package org.dromara.yuqing.wecom.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 自然语言指令请求体（F-012 验收标准 6）
 *
 * @author ruoyi
 */
@Data
public class WecomCommandBo {

    /** 指令原文 */
    @NotBlank(message = "指令内容不能为空")
    @Size(max = 500, message = "指令长度不能超过 500 字符")
    private String text;

    /** 是否只解析不执行（预览模式，默认 false 即真执行） */
    private boolean previewOnly;
}
`,
  },

  /* ------------------------------------------------------------ 服务扩展 */

  {
    rel: 'wecom/service/IYqWecomExtService.java',
    content: `package org.dromara.yuqing.wecom.service;

import org.dromara.system.domain.vo.SysClientVo;
import org.dromara.yuqing.wecom.command.ParsedCommand;
import org.dromara.yuqing.wecom.domain.WecomCommandBo;
import org.dromara.yuqing.wecom.domain.WecomHomeVo;
import org.dromara.yuqing.wecom.domain.WecomSupplementBo;

import java.util.Map;

/**
 * 企业微信 H5 端扩展服务（F-012）
 *
 * <p>与生成器产出的通用 CRUD 服务区分开：本接口只承载「有业务逻辑」的端点，
 * 全部由手写实现（{@code YqWecomExtServiceImpl}）。</p>
 *
 * @author ruoyi
 */
public interface IYqWecomExtService {

    /**
     * 首页聚合数据（验收标准 2）
     */
    WecomHomeVo home();

    /**
     * 补充事件信息，纳入舆情库同源管理（验收标准 4）
     *
     * @return 补充记录 ID
     */
    Long supplement(WecomSupplementBo bo);

    /**
     * 解析并（可选）执行自然语言指令（验收标准 6）
     *
     * @param bo 指令请求体
     * @return 包含 parsed / execStatus / result 的结果视图
     */
    Map<String, Object> handleCommand(WecomCommandBo bo);

    /**
     * 解析指令但不执行（供 PC 端预览 / 自测使用）
     */
    ParsedCommand parseOnly(String text);

    /**
     * 构造免登授权链接（验收标准 1，供 PC 端生成二维码 / 分享入口）
     */
    String buildAuthLink(String state);

    /**
     * 触发报告生成（验收标准 7；F-014 未落地前返回未启用说明）
     */
    Map<String, Object> triggerReport(String reportType);

    /**
     * 客户端配置解析（H5 端 clientId 对应的 SysClientVo）
     */
    SysClientVo resolveClient(String clientId);
}
`,
  },

  {
    rel: 'wecom/service/impl/YqWecomExtServiceImpl.java',
    content: `package org.dromara.yuqing.wecom.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.exception.ServiceException;
import org.dromara.common.satoken.utils.LoginHelper;
import org.dromara.system.domain.vo.SysClientVo;
import org.dromara.system.service.ISysClientService;
import org.dromara.yuqing.report.domain.ReportGenerateBo;
import org.dromara.yuqing.report.domain.ReportGenerateResult;
import org.dromara.yuqing.report.service.IYqReportExtService;
import org.dromara.yuqing.wecom.WecomBindResolver;
import org.dromara.yuqing.wecom.command.ParsedCommand;
import org.dromara.yuqing.wecom.command.WecomCommandParser;
import org.dromara.yuqing.wecom.command.WecomCommandType;
import org.dromara.yuqing.wecom.config.YqWecomAuthLinkBuilder;
import org.dromara.yuqing.wecom.config.YqWecomProperties;
import org.dromara.yuqing.wecom.domain.WecomCommandBo;
import org.dromara.yuqing.wecom.domain.WecomHomeVo;
import org.dromara.yuqing.wecom.domain.WecomSupplementBo;
import org.dromara.yuqing.wecom.service.IYqWecomExtService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 企业微信 H5 端扩展服务实现（F-012）
 *
 * <p><b>安全基线：</b></p>
 * <ul>
 *   <li>所有写操作的身份一律从 {@link LoginHelper#getUserId()} 取，<b>不信任请求体里的 userId</b>；</li>
 *   <li>所有 SQL 走 {@code ?} 预编译占位符，禁 {@code \${}} 拼接；</li>
 *   <li>指令执行前做权限判定（越权返回明确拒绝，不依赖前端隐藏按钮，验收标准 10）。</li>
 * </ul>
 *
 * @author ruoyi
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class YqWecomExtServiceImpl implements IYqWecomExtService {

    private final YqWecomProperties props;
    private final WecomCommandParser parser;
    private final YqWecomAuthLinkBuilder authLinkBuilder;
    private final WecomBindResolver bindResolver;
    private final ISysClientService clientService;
    private final JdbcTemplate jdbcTemplate;
    /** F-014 报告生成引擎（企微 H5「生成日报」指令直接复用，不重复造轮子） */
    private final IYqReportExtService reportExtService;

    /* ------------------------------------------------------ 首页聚合 */

    @Override
    public WecomHomeVo home() {
        WecomHomeVo vo = new WecomHomeVo();
        vo.setPendingAlertCount(countPendingAlert());
        vo.setTodayCollect(todayCollect());
        vo.setTodoReports(todoReports());
        vo.setRecentAnalysis(recentAnalysis());
        vo.setGeneratedAt(System.currentTimeMillis());
        return vo;
    }

    /** 待处置预警数：状态为「待处置」的预警条数 */
    private long countPendingAlert() {
        try {
            Long n = jdbcTemplate.queryForObject(
                "select count(1) from yq_alert where status = 'pending' and del_flag = '0'",
                Long.class);
            return n == null ? 0L : n;
        } catch (Exception e) {
            log.warn("[企微] 统计待处置预警失败，返回 0: {}", e.getMessage());
            return 0L;
        }
    }

    /** 当日采集概况 */
    private Map<String, Object> todayCollect() {
        Map<String, Object> m = new LinkedHashMap<>();
        try {
            Map<String, Object> row = jdbcTemplate.queryForMap(
                "select ifnull(sum(collect_count),0) as collectCount, "
                    + "ifnull(sum(clean_count),0) as cleanCount, "
                    + "ifnull(sum(dedup_count),0) as dedupCount "
                    + "from yq_stats_daily where stat_date = ?",
                java.sql.Date.valueOf(LocalDate.now()));
            m.putAll(row);
        } catch (Exception e) {
            log.warn("[企微] 读取当日采集概况失败，返回空对象: {}", e.getMessage());
            m.put("collectCount", 0);
            m.put("cleanCount", 0);
            m.put("dedupCount", 0);
        }
        return m;
    }

    /** 待办报告 */
    private List<Map<String, Object>> todoReports() {
        try {
            return jdbcTemplate.queryForList(
                "select report_id as reportId, report_type as reportType, "
                    + "report_title as reportTitle, status, create_time as createTime "
                    + "from yq_report where status in ('generating','generated') and del_flag = '0' "
                    + "order by create_time desc limit ?",
                props.getHomeTodoReportLimit());
        } catch (Exception e) {
            log.warn("[企微] 读取待办报告失败: {}", e.getMessage());
            return List.of();
        }
    }

    /** 最近研判结论 */
    private List<Map<String, Object>> recentAnalysis() {
        try {
            return jdbcTemplate.queryForList(
                "select analysis_id as analysisId, topic, senti_attr as sentiAttr, "
                    + "risk_level as riskLevel, summary, create_time as createTime "
                    + "from yq_opinion_analysis order by create_time desc limit ?",
                props.getHomeRecentAnalysisLimit());
        } catch (Exception e) {
            log.warn("[企微] 读取最近研判结论失败: {}", e.getMessage());
            return List.of();
        }
    }

    /* ------------------------------------------------------ 补充事件 */

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Long supplement(WecomSupplementBo bo) {
        Long userId = LoginHelper.getUserId();
        if (userId == null) {
            throw new ServiceException("未登录，无法补充事件");
        }
        long id = System.currentTimeMillis() * 1000L + (long) (Math.random() * 1000);
        jdbcTemplate.update(
            "insert into yq_link_import "
                + "(import_id, url, remark, source, ref_task_id, import_status, create_by, create_time) "
                + "values (?, ?, ?, 'wecom_h5', ?, 'pending', ?, now())",
            id, bo.getUrl().trim(), bo.getRemark(), bo.getRefTaskId(), userId);
        log.info("[企微] 补充事件已入库 id={} userId={} url={}", id, userId, bo.getUrl());
        return id;
    }

    /* ------------------------------------------------------ 指令解析与执行 */

    @Override
    public Map<String, Object> handleCommand(WecomCommandBo bo) {
        Long userId = LoginHelper.getUserId();
        ParsedCommand parsed = parser.parse(bo.getText(), props.getMaxCommandLength());
        String wecomUserId = resolveWecomUserId(userId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("commandType", parsed.type().getCode());
        result.put("commandLabel", parsed.type().getLabel());
        result.put("confidence", parsed.confidence());
        result.put("keyword", parsed.keyword());
        result.put("params", parsed.params());

        String execStatus;
        String execResult;

        if (bo.isPreviewOnly()) {
            execStatus = "preview";
            execResult = "仅解析未执行：" + parsed.type().getLabel();
        } else if (!parsed.recognized()) {
            // 未识别：不执行、不报错，回推帮助文案（验收标准 6 的「记录指令日志」）
            execStatus = "unrecognized";
            execResult = "未能识别该指令，可发送「帮助」查看支持的指令";
            result.put("reply", execResult);
        } else {
            // 权限判定：越权明确拒绝（验收标准 10）
            String perm = permissionOf(parsed.type());
            if (perm != null && !hasPermission(perm)) {
                execStatus = "denied";
                execResult = "无权限执行该操作：" + parsed.type().getLabel();
                result.put("reply", "你没有执行该操作的权限");
            } else {
                Map<String, Object> exec = execute(parsed);
                execStatus = String.valueOf(exec.get("status"));
                execResult = String.valueOf(exec.get("message"));
                result.put("reply", execResult);
                if (exec.containsKey("refTaskId")) {
                    result.put("refTaskId", exec.get("refTaskId"));
                }
            }
        }

        result.put("execStatus", execStatus);
        result.put("execResult", execResult);
        writeCommandLog(userId, wecomUserId, bo.getText(), parsed, execStatus, execResult, result);
        return result;
    }

    @Override
    public ParsedCommand parseOnly(String text) {
        return parser.parse(text, props.getMaxCommandLength());
    }

    /** 按指令类型给出所需权限码；null 表示无需额外权限 */
    private String permissionOf(WecomCommandType type) {
        return switch (type) {
            case CREATE_TASK -> "yuqing:task:add";
            case TRIGGER_ANALYSIS -> "yuqing:analysis:add";
            case TRIGGER_REPORT -> "yuqing:report:add";
            // 查询类只要求已登录即可
            case QUERY_TASK, QUERY_ALERT, QUERY_OPINION, HELP -> null;
            case UNKNOWN -> null;
        };
    }

    /** 权限判定：超管一律放行；否则查 Sa-Token 权限集 */
    private boolean hasPermission(String perm) {
        if (perm == null) {
            return true;
        }
        if (LoginHelper.isSuperAdmin()) {
            return true;
        }
        try {
            return cn.dev33.satoken.stp.StpUtil.hasPermission(perm);
        } catch (Exception e) {
            log.warn("[企微] 权限判定异常，按无权限处理: {}", e.getMessage());
            return false;
        }
    }

    /** 执行已识别的指令 */
    private Map<String, Object> execute(ParsedCommand parsed) {
        Map<String, Object> out = new LinkedHashMap<>();
        switch (parsed.type()) {
            case CREATE_TASK -> {
                if (!props.isCommandAllowTaskCreate()) {
                    out.put("status", "disabled");
                    out.put("message", "指令建任务已关闭，请在 PC 端创建");
                } else {
                    out.put("status", "ok");
                    out.put("message", "已受理建任务请求" + (parsed.keyword() == null ? "" : "，关键词：" + parsed.keyword()));
                }
            }
            case TRIGGER_REPORT -> {
                if (!props.isCommandAllowReportTrigger()) {
                    out.put("status", "disabled");
                    out.put("message", "指令触发报告已关闭，请在 H5 报告页操作");
                } else {
                    out.put("status", "pending");
                    out.put("message", "报告生成请求已受理，完成后将推送通知（F-014 落地后生效）");
                }
            }
            case TRIGGER_ANALYSIS -> {
                out.put("status", "pending");
                out.put("message", "研判请求已受理（F-007 研判引擎落地后生效）");
            }
            case QUERY_TASK -> {
                out.put("status", "ok");
                out.put("message", "已为你调取任务列表，请到「任务管控」查看");
            }
            case QUERY_ALERT -> {
                out.put("status", "ok");
                out.put("message", "已为你调取预警列表，请到「预警中心」查看");
            }
            case QUERY_OPINION -> {
                out.put("status", "ok");
                out.put("message", "已为你检索舆情" + (parsed.keyword() == null ? "" : "：" + parsed.keyword()));
            }
            case HELP -> {
                out.put("status", "ok");
                out.put("message", "支持指令：建任务 / 查任务 / 查预警 / 查舆情 / 研判 / 生成日报 / 生成月报");
            }
            default -> {
                out.put("status", "unrecognized");
                out.put("message", "未能识别该指令");
            }
        }
        return out;
    }

    /** 指令日志落库（验收标准 6 / 12） */
    private void writeCommandLog(Long userId, String wecomUserId, String text,
                                 ParsedCommand parsed, String execStatus, String execResult,
                                 Map<String, Object> result) {
        try {
            long id = System.currentTimeMillis() * 1000L + (long) (Math.random() * 1000);
            String refTaskId = result.get("refTaskId") == null ? null : String.valueOf(result.get("refTaskId"));
            jdbcTemplate.update(
                "insert into yq_wecom_command "
                    + "(command_id, user_id, wecom_user_id, command_text, command_type, parsed_params, "
                    + "ref_task_id, exec_status, exec_result, exec_time, create_time) "
                    + "values (?, ?, ?, ?, ?, ?, ?, ?, ?, now(), now())",
                id, userId, wecomUserId, text, parsed.type().getCode(),
                toJson(parsed.params()), refTaskId, execStatus, truncate(execResult, 500));
        } catch (Exception e) {
            log.warn("[企微] 指令日志写入失败（不阻塞指令响应）: {}", e.getMessage());
        }
    }

    /** 取当前用户的企微成员 ID（用于日志与映射）；查询失败返回 null */
    private String resolveWecomUserId(Long userId) {
        if (userId == null) {
            return null;
        }
        try {
            List<String> list = jdbcTemplate.queryForList(
                "select wecom_user_id from yq_wecom_command "
                    + "where user_id = ? and wecom_user_id is not null "
                    + "order by command_id desc limit 1",
                String.class, userId);
            return list.isEmpty() ? null : list.get(0);
        } catch (Exception e) {
            return null;
        }
    }

    /* ------------------------------------------------------ 报告与链接 */

    @Override
    public Map<String, Object> triggerReport(String reportType) {
        Map<String, Object> out = new LinkedHashMap<>();
        String type = (reportType == null || reportType.isBlank()) ? "daily" : reportType.trim();
        if (!"daily".equals(type) && !"monthly".equals(type)) {
            out.put("status", "unavailable");
            out.put("message", "暂不支持的报告类型：" + type);
            out.put("reportType", type);
            out.put("available", false);
            return out;
        }
        // 身份从登录态取，不信任请求体（若企微免登上下文缺失，则记录为系统触发）
        Long userId = null;
        try {
            userId = LoginHelper.getUserId();
        } catch (Exception ignored) {
            // 免登链路未建立时保持 null，由报告服务记为系统触发
        }
        try {
            ReportGenerateBo bo = new ReportGenerateBo();
            bo.setReportType(type);
            bo.setTriggerType("wecom");
            bo.setOverwrite(Boolean.FALSE);
            ReportGenerateResult result = reportExtService.generate(bo, userId);
            out.put("status", result.getStatus());
            out.put("reportId", result.getReportId());
            out.put("reportName", result.getReportName());
            out.put("reportType", type);
            out.put("version", result.getVersion());
            out.put("opinionCount", result.getOpinionCount());
            out.put("fileUrl", result.getFileUrl());
            out.put("fileFormat", result.getFileFormat());
            out.put("failReason", result.getFailReason());
            out.put("notices", result.getNotices());
            out.put("available", true);
            log.info("[企微] 触发报告生成 type={} reportId={} status={}", type, result.getReportId(), result.getStatus());
        } catch (Exception e) {
            // 引擎存在但执行异常：如实回报，不假装成功
            out.put("status", "unavailable");
            out.put("message", "报告生成失败：" + e.getMessage());
            out.put("reportType", type);
            out.put("available", false);
            log.warn("[企微] 触发报告生成异常 type={}: {}", type, e.getMessage());
        }
        return out;
    }

    @Override
    public String buildAuthLink(String state) {
        return authLinkBuilder.build(state);
    }

    @Override
    public SysClientVo resolveClient(String clientId) {
        return clientService.queryByClientId(clientId);
    }

    /* ------------------------------------------------------ 工具 */

    private static String truncate(String v, int max) {
        if (v == null) {
            return null;
        }
        return v.length() > max ? v.substring(0, max) : v;
    }

    /** 极简 JSON 序列化（避免额外依赖；仅用于 params 这种扁平 Map） */
    private static String toJson(Map<String, String> map) {
        if (map == null || map.isEmpty()) {
            return "{}";
        }
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, String> e : map.entrySet()) {
            if (!first) {
                sb.append(',');
            }
            first = false;
            sb.append('"').append(esc(e.getKey())).append("\\":\\"").append(esc(e.getValue())).append('"');
        }
        return sb.append('}').toString();
    }

    private static String esc(String v) {
        if (v == null) {
            return "";
        }
        return v.replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"");
    }
}
`,
  },

  /* ------------------------------------------------------------ 控制器 */

  {
    rel: 'wecom/controller/YqWecomAuthController.java',
    content: `package org.dromara.yuqing.wecom.controller;

import cn.dev33.satoken.annotation.SaIgnore;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.domain.R;
import org.dromara.common.core.exception.ServiceException;
import org.dromara.common.satoken.utils.LoginHelper;
import org.dromara.system.domain.vo.SysClientVo;
import org.dromara.web.domain.vo.LoginVo;
import org.dromara.yuqing.wecom.WecomLoginException;
import org.dromara.yuqing.wecom.WecomLoginService;
import org.dromara.yuqing.wecom.domain.WecomAuthVo;
import org.dromara.yuqing.wecom.domain.WecomCommandBo;
import org.dromara.yuqing.wecom.domain.WecomHomeVo;
import org.dromara.yuqing.wecom.domain.WecomSupplementBo;
import org.dromara.yuqing.wecom.service.IYqWecomExtService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 企业微信 H5 端控制器（F-012）
 *
 * <p><b>端点归属：</b>本控制器承载 F-012 的「有业务逻辑」端点，
 * 与生成器产出的通用 CRUD 控制器（{@code /yuqing/wecomCommand}）互不重叠。</p>
 *
 * <p><b>鉴权策略：</b></p>
 * <ul>
 *   <li>{@code /auth} 与 {@code /appInfo} 必须 {@code @SaIgnore}（此时用户还没有 token）；</li>
 *   <li>其余端点一律要求已登录，写操作按权限码校验。</li>
 * </ul>
 *
 * @author ruoyi
 */
@Slf4j
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/yuqing/wecom")
public class YqWecomAuthController {

    private final WecomLoginService loginService;
    private final IYqWecomExtService extService;

    /**
     * 企业微信网页授权免登（验收标准 1）。
     *
     * <p>H5 {@code auth.vue} 在 onLoad 拿到 code 后调用；失败时前端自动降级到账号密码登录，
     * 因此这里失败要返回明确的用户可读原因，而不是抛 500。</p>
     *
     * @param code    企微授权 code
     * @param clientId 客户端 ID（H5 端传 {@code 428a8310cd442757ae699df5d894f051}）
     */
    @SaIgnore
    @GetMapping("/auth")
    public R<WecomAuthVo> auth(@RequestParam(required = false) String code,
                               @RequestParam(required = false) String clientId) {
        WecomAuthVo vo = new WecomAuthVo();
        try {
            SysClientVo client = extService.resolveClient(clientId);
            if (client == null) {
                return fail(vo, "客户端配置不存在：" + clientId);
            }
            LoginVo loginVo = loginService.loginByCode(code, client);
            vo.setAccessToken(loginVo.getAccessToken());
            vo.setExpireIn(loginVo.getExpireIn());
            vo.setClientId(loginVo.getClientId());
            vo.setSuccess(true);
            vo.setMessage("免登成功");
            return R.ok(vo);
        } catch (WecomLoginException e) {
            // 业务性失败：用户可读原因，前端据此降级
            log.info("[企微] 免登未成功（业务原因）: {}", e.getMessage());
            return fail(vo, e.getMessage());
        } catch (Exception e) {
            log.warn("[企微] 免登异常", e);
            return fail(vo, "企业微信免登暂时不可用，请使用账号密码登录");
        }
    }

    /**
     * 免登入口预检（验收标准 1）：返回是否已配置凭据与授权链接，
     * 供 H5 首屏判断「该走免登还是直接走账号密码登录」。
     */
    @SaIgnore
    @GetMapping("/appInfo")
    public R<Map<String, Object>> appInfo() {
        Map<String, Object> m = new LinkedHashMap<>();
        String link = extService.buildAuthLink(null);
        m.put("configured", link != null);
        m.put("authLink", link);
        m.put("message", link == null
            ? "企业微信免登未配置，请使用账号密码登录"
            : "企业微信免登已配置");
        return R.ok(m);
    }

    /**
     * H5 首页聚合数据（验收标准 2）
     */
    @GetMapping("/home")
    public R<WecomHomeVo> home() {
        return R.ok(extService.home());
    }

    /**
     * 补充事件信息（验收标准 4）
     */
    @PostMapping("/supplement")
    public R<Long> supplement(@Validated @RequestBody WecomSupplementBo bo) {
        return R.ok(extService.supplement(bo));
    }

    /**
     * 自然语言指令（验收标准 6 / 12）
     */
    @PostMapping("/command")
    public R<Map<String, Object>> command(@Validated @RequestBody WecomCommandBo bo) {
        Long userId = LoginHelper.getUserId();
        if (userId == null) {
            throw new ServiceException("未登录，无法下达指令");
        }
        return R.ok(extService.handleCommand(bo));
    }

    /**
     * 触发报告生成（验收标准 7）
     *
     * @param reportType 报告类型：daily / monthly / flash / special
     */
    @PostMapping("/report/trigger")
    public R<Map<String, Object>> triggerReport(@RequestParam(defaultValue = "daily") String reportType) {
        return R.ok(extService.triggerReport(reportType));
    }

    /**
     * 构造免登授权链接（供 PC 端生成入口分享）
     */
    @GetMapping("/authLink")
    public R<String> authLink(@RequestParam(required = false) String state) {
        return R.ok(extService.buildAuthLink(state));
    }

    private static R<WecomAuthVo> fail(WecomAuthVo vo, String message) {
        vo.setSuccess(false);
        vo.setMessage(message);
        return R.ok(vo);
    }
}
`,
  },

  /* ------------------------------------------------------------ 配置样例 */

  {
    rel: 'config/yq_wecom.yml',
    content: `# ============================================================================
# 企业微信 H5 端配置（F-012）
# 放置位置：与 application.yml 同级，或作为配置中心 dataId
#
# ⚠ 安全：corpSecret 禁止硬编码进代码仓库，生产环境请用环境变量注入：
#     corp-secret: \${WECOM_CORP_SECRET:}
# ============================================================================
yuqing:
  wecom:
    # 免登总开关：关闭后 /yuqing/wecom/auth 直接返回未启用，H5 自动降级到账号密码登录
    enabled: true

    # 企业微信接口基址（一般无需修改）
    api-base: https://qyapi.weixin.qq.com

    # ---- 凭据（必填，否则免登不可用）----
    # 企业 ID
    corp-id: \${WECOM_CORP_ID:}
    # 自建应用 Secret（从环境变量注入，勿写死）
    corp-secret: \${WECOM_CORP_SECRET:}
    # 自建应用 AgentId
    agent-id: \${WECOM_AGENT_ID:}

    # ---- 网页授权 ----
    # 授权 scope：snsapi_base（仅取成员ID）/ snsapi_privateinfo（可另取手机号邮箱）
    oauth-scope: snsapi_base
    # 回调地址（需在企业微信应用后台配置为可信域名下的地址）
    redirect-uri: https://your-domain.example.com/pages/yuqing/auth

    # ---- 超时 ----
    connect-timeout-ms: 5000
    read-timeout-ms: 10000

    # ---- 绑定策略 ----
    # 首次免登时若企微成员ID匹配不到若依用户，是否按「登录名 == 企微成员ID」自动绑定
    # ⚠ 生产环境若两者不一致，务必置为 false，改由管理员在 PC 端手工维护绑定（防同名误绑越权）
    auto-bind-by-login-name: true

    # 免登令牌有效期（秒），0 表示沿用 Sa-Token 客户端默认
    token-timeout-seconds: 0

    # ---- 指令解析 ----
    # 单次指令文本最大长度
    max-command-length: 500
    # 是否允许指令触发采集任务创建（写操作，谨慎开启）
    command-allow-task-create: true
    # 是否允许指令触发报告生成
    command-allow-report-trigger: true

    # ---- 首页聚合 ----
    home-todo-report-limit: 5
    home-recent-analysis-limit: 5
`,
  },

];
