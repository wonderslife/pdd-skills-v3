package org.dromara.yuqing.push;

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
        for (String part : csvIds.split("[,，;；\s]+")) {
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
