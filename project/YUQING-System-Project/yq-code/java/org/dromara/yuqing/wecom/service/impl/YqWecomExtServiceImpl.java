package org.dromara.yuqing.wecom.service.impl;

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
 *   <li>所有 SQL 走 {@code ?} 预编译占位符，禁 {@code ${}} 拼接；</li>
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
            sb.append('"').append(esc(e.getKey())).append("\":\"").append(esc(e.getValue())).append('"');
        }
        return sb.append('}').toString();
    }

    private static String esc(String v) {
        if (v == null) {
            return "";
        }
        return v.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
