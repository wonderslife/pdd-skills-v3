package org.dromara.yuqing.report.push;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.yuqing.domain.YqPushRule;
import org.dromara.yuqing.domain.YqReport;
import org.dromara.yuqing.mapper.YqPushRuleMapper;
import org.dromara.yuqing.push.PushDispatcher;
import org.dromara.yuqing.push.PushOutcome;
import org.dromara.yuqing.push.PushRequest;
import org.dromara.yuqing.push.PushScene;
import org.dromara.yuqing.push.PushTargetResolver;
import org.dromara.yuqing.report.build.ReportFileName;
import org.dromara.yuqing.report.render.DocumentFormat;
import org.dromara.yuqing.report.render.RenderResult;
import org.dromara.yuqing.report.render.WordRenderer;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 报告推送器（F-014 验收标准 6）
 *
 * <p>完全复用 F-011 的推送基建：推送规则取自 {@code yq_push_rule} 中
 * scene={@link PushScene#REPORT_READY} 的记录，目标解析走
 * {@link PushTargetResolver}，发送 / 静默时段 / 重试 / 落 push_record 全部
 * 交给 {@link PushDispatcher}。本类只做三件事：取规则、渲染文件、拼请求。</p>
 *
 * <p><b>文件类型：</b>企微应用消息的 file 类型只支持 doc/docx/xls/xlsx/ppt/pptx/pdf，
 * 因此推送用 {@link WordRenderer} 产出的 docx 字节。渲染失败则降级为
 * 发送 Markdown 正文摘要（msgType=text）—— 宁可收到正文也好过收不到。</p>
 *
 * <p><b>不静默失败：</b>没有配置 report_ready 规则、或规则解析不出接收人时，
 * 返回的是明确的「跳过原因」文本，而不是空字符串。上层会把它写进报告的
 * 生成提示区，让报送员看得见。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ReportPusher {

    private final WordRenderer wordRenderer;
    private final PushTargetResolver targetResolver;
    private final PushDispatcher pushDispatcher;
    private final YqPushRuleMapper pushRuleMapper;

    /**
     * 推送报告
     *
     * @param report 报告实体
     * @param userId 操作人（手工推送时非空，定时任务为 null）
     * @return 结果摘要（写入报告正文的生成提示区）
     */
    public String push(YqReport report, Long userId) {
        if (report == null || report.getReportId() == null) {
            return "推送跳过：报告不存在";
        }
        if (StringUtils.isBlank(report.getContent())) {
            return "推送跳过：报告正文为空";
        }

        List<YqPushRule> rules = loadRules();
        if (rules.isEmpty()) {
            log.warn("[报告推送] #{} 未找到 report_ready 场景的启用规则", report.getReportId());
            return "推送跳过：未配置「报告生成完成」场景的推送规则";
        }

        /* 渲染文件：成功推文件，失败降级推正文 */
        byte[] fileBytes = null;
        String fileName = null;
        RenderResult rendered = wordRenderer.render(report.getReportName(), report.getContent(),
            ReportFileName.of(report.getReportType(), report.getReportDate(),
                report.getReportName(), DocumentFormat.DOCX.getExt()));
        if (rendered.ok() && rendered.size() > 0) {
            fileBytes = rendered.bytes();
            fileName = rendered.fileName();
        } else {
            log.warn("[报告推送] #{} Word 渲染失败，降级为正文推送: {}", report.getReportId(), rendered.message());
        }

        int sent = 0;
        int failed = 0;
        int skipped = 0;
        int unmappedTotal = 0;
        StringBuilder details = new StringBuilder();

        for (YqPushRule rule : rules) {
            Set<Long> userIds = resolveTargets(rule);
            if (userIds.isEmpty()) {
                skipped++;
                details.append("规则「").append(rule.getRuleName()).append("」未解析到接收人；");
                continue;
            }
            PushTargetResolver.WecomTargets wecom = targetResolver.toWecom(userIds);
            unmappedTotal += (wecom.getTotal() - wecom.getMapped());
            if (wecom.isEmpty()) {
                skipped++;
                details.append("规则「").append(rule.getRuleName()).append("」全部接收人未绑定企业微信；");
                continue;
            }

            PushRequest req = PushRequest.builder()
                .scene(PushScene.REPORT_READY)
                .pushLevel(rule.getPushLevel())
                .ruleId(rule.getRuleId())
                .ruleName(rule.getRuleName())
                .msgType(fileBytes == null ? "text" : "file")
                .contentType("detail")
                .content(fileBytes == null ? summary(report.getContent()) : null)
                .fileName(fileName)
                .fileBytes(fileBytes)
                .targetUserIds(userIds)
                .quietStart(rule.getQuietStart())
                .quietEnd(rule.getQuietEnd())
                .maxRetry(rule.getMaxRetry() == null ? 2 : rule.getMaxRetry())
                .reportId(report.getReportId())
                .highPriority("immediate".equals(rule.getPushLevel()))
                .now(LocalDateTime.now())
                .build();

            PushOutcome outcome = pushDispatcher.dispatch(req);
            if (outcome == null) {
                failed++;
                details.append("规则「").append(rule.getRuleName()).append("」无返回；");
                continue;
            }
            if (outcome.isSuccess()) {
                sent++;
            } else {
                failed++;
                details.append("规则「").append(rule.getRuleName()).append("」")
                    .append(outcome.getSendStatus()).append("：")
                    .append(outcome.getReason() == null ? "无原因" : outcome.getReason()).append("；");
            }
        }

        StringBuilder msg = new StringBuilder();
        msg.append("已推送 ").append(fileBytes != null ? "文件 " + fileName : "正文摘要");
        msg.append("，成功 ").append(sent).append(" 条规则");
        if (failed > 0) {
            msg.append("，失败 ").append(failed).append(" 条");
        }
        if (skipped > 0) {
            msg.append("，跳过 ").append(skipped).append(" 条");
        }
        if (unmappedTotal > 0) {
            msg.append("；").append(unmappedTotal).append(" 名接收人未绑定企业微信");
        }
        if (details.length() > 0) {
            msg.append("。明细：").append(details);
        }
        log.info("[报告推送] #{} {}", report.getReportId(), msg);
        return msg.toString();
    }

    /**
     * 取含 report_ready 场景的启用规则。
     *
     * <p>{@code yq_push_rule.push_scenes} 是逗号分隔的多场景串（一条规则可覆盖
     * 多个场景），因此不能用 eq 精确匹配，必须取全量后在内存里按
     * {@link PushScene#contains} 过滤 —— 这是 F-011 表结构决定的，
     * 用 eq 会漏掉「同时配了 high_risk 和 report_ready」的规则。</p>
     */
    private List<YqPushRule> loadRules() {
        try {
            List<YqPushRule> all = pushRuleMapper.selectList(new LambdaQueryWrapper<YqPushRule>()
                .eq(YqPushRule::getStatus, "0"));
            List<YqPushRule> out = new ArrayList<>();
            if (all == null) {
                return out;
            }
            for (YqPushRule r : all) {
                if (PushScene.contains(r.getPushScenes(), PushScene.REPORT_READY)) {
                    out.add(r);
                }
            }
            if (out.isEmpty()) {
                log.info("[报告推送] 无启用中的 report_ready 规则，候选规则 {} 条", all.size());
            }
            return out;
        } catch (Exception e) {
            log.warn("[报告推送] 查询推送规则失败", e);
            return new ArrayList<>();
        }
    }

    /**
     * 按规则的 targetType / targetIds 解析接收人。
     *
     * <p>一条规则可能同时配了角色、部门、用户三类目标，用分号分隔：
     * {@code role:1,2;dept:103;user:5}。逐段解析后并集去重。</p>
     */
    private Set<Long> resolveTargets(YqPushRule rule) {
        Set<Long> out = new LinkedHashSet<>();
        String targets = rule.getTargetIds();
        if (StringUtils.isBlank(targets)) {
            return out;
        }
        for (String seg : targets.split("[;；]")) {
            String s = seg.trim();
            if (s.isEmpty()) {
                continue;
            }
            int idx = s.indexOf(':');
            if (idx > 0) {
                String type = s.substring(0, idx).trim().toLowerCase();
                String ids = s.substring(idx + 1).trim();
                out.addAll(targetResolver.resolve(type, ids));
            } else {
                /* 未带类型前缀时按用户ID理解 —— 兼容运维手工填的简单写法 */
                out.addAll(targetResolver.resolve("user", s));
            }
        }
        return out;
    }

    /** 降级推正文时只取尾部（结论区），避免超长被企微截断 */
    private String summary(String content) {
        if (content.length() <= 1800) {
            return content;
        }
        return content.substring(0, 1800) + "\n\n> （正文过长已截断，完整内容请到系统查看）";
    }
}
