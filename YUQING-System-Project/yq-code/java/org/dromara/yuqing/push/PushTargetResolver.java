package org.dromara.yuqing.push;

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
