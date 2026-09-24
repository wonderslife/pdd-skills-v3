package org.dromara.yuqing.wecom;

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
