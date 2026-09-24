package org.dromara.yuqing.ledger.dao;

import com.baomidou.dynamic.datasource.annotation.DS;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

/**
 * 台账 MySQL 侧数据访问：名称回填 + 预警 / 推送记录（F-016 验收标准 3、8）
 *
 * <p><b>为什么用 JdbcTemplate 而不是复用各模块的 Mapper：</b>
 * 名称回填要读 yq_task / yq_channel / yq_tag / sys_user，
 * 若 import 它们各自的 Entity 与 Mapper，F-016 就与
 * gen-yuqing.mjs（表的归属方）耦合在一起：
 * 对方改字段名，本模块跟着编译失败，而编译错误出现在「台账」文件里、
 * 根因却在别处。用 JdbcTemplate 只读所需列，耦合面缩到「列名」这一层，
 * 且台账本来就不需要这些表的其它列。</p>
 *
 * <p><b>安全：</b>所有 SQL 均使用 {@code ?} 预编译占位符，
 * IN 子句的占位符个数由集合大小生成、值全部走绑定，
 * 不存在字符串拼接注入。返回列均为非敏感字段
 * （名称、标题、状态），不带出手机号、身份证等个人信息。</p>
 *
 * <p><b>@DS("master") 显式标注：</b>防止被上游 {@code @DS("doris")} 的
 * 上下文污染（动态数据源是线程级上下文，不会自动切回主库）。</p>
 *
 * @author ruoyi
 */
@Repository
@RequiredArgsConstructor
@DS("master")
public class LedgerMetaDao {

    private final JdbcTemplate jdbc;

    /* ------------------------------------------------------------ 名称回填 */

    /**
     * 批量取任务名称（③A 的归属字段也在这里读）。
     *
     * <p>一处两用：既给列表回填 taskName，也是统计「本人名下任务」
     * 的取数入口（{@link #ownedTaskIds}）。</p>
     */
    public Map<Long, String> taskNames(Collection<Long> ids) {
        return nameMap("select task_id as k, task_name as v from yq_task where task_id in (%s)",
            ids);
    }

    /** 批量取渠道名称 */
    public Map<Long, String> channelNames(Collection<Long> ids) {
        return nameMap("select channel_id as k, channel_name as v from yq_channel where channel_id in (%s)",
            ids);
    }

    /** 批量取标签名称 */
    public Map<Long, String> tagNames(Collection<Long> ids) {
        return nameMap("select tag_id as k, tag_name as v from yq_tag where tag_id in (%s)",
            ids);
    }

    /** 批量取事件标题 */
    public Map<Long, String> clusterTitles(Collection<Long> ids) {
        return nameMap("select cluster_id as k, cluster_title as v from yq_opinion_cluster where cluster_id in (%s)",
            ids);
    }

    /**
     * 批量取用户昵称（预警处置人展示用）。
     *
     * <p>只取 user_id / nick_name，不触碰手机号、邮箱等字段。</p>
     */
    public Map<Long, String> userNames(Collection<Long> ids) {
        return nameMap("select user_id as k, nick_name as v from sys_user where user_id in (%s)", ids);
    }

    /* ------------------------------------------------------------ 数据权限 */

    /**
     * 当前用户名下的监测任务ID（③A 任务归属口径）。
     *
     * <p>只读 {@code yq_task.create_by} 一列，且带 {@code del_flag = '0'} ——
     * 已删除的任务不应再授权数据可见性，否则「删了任务还看得见数据」。
     * 返回空集时上层会得到 {@code LedgerScope.none()}（可见 0 条），
     * <b>不会退化为全量</b>。</p>
     */
    public Set<Long> ownedTaskIds(Long userId) {
        if (userId == null) {
            return new LinkedHashSet<>();
        }
        List<Long> ids = jdbc.queryForList(
            "select task_id from yq_task where create_by = ? and del_flag = '0'",
            Long.class, userId);
        return new LinkedHashSet<>(ids);
    }

    /* ------------------------------------------------------------ 预警 / 推送 */

    /** 某条舆情的预警记录（按触发时间倒序） */
    public List<Map<String, Object>> alertsOf(Long opinionId, int limit) {
        if (opinionId == null) {
            return List.of();
        }
        return jdbc.queryForList(
            "select alert_id, alert_title, trigger_scene, alert_level, trigger_value, "
                + "trigger_time, status, process_remark, process_by, process_time, push_result "
                + "from yq_alert where opinion_id = ? order by trigger_time desc limit " + Math.max(limit, 0),
            opinionId);
    }

    /**
     * 某条舆情的推送记录。
     *
     * <p>{@code yq_push_record.opinion_ids} 是逗号分隔字符串（历史设计），
     * 因此用 {@code FIND_IN_SET} 判定包含关系 —— 参数走绑定，
     * 不会因为 opinionId 是字符串而注入。该写法无法命中索引，
     * 仅在详情页单条查询时使用；若将来推送记录量级上来，
     * 应改为在推送时落一张关联表。</p>
     *
     * <p>内容快照只取前 200 字符：它是推送审计证据，全文对详情页无意义。</p>
     */
    public List<Map<String, Object>> pushesOf(Long opinionId, int limit) {
        if (opinionId == null) {
            return List.of();
        }
        return jdbc.queryForList(
            "select record_id, push_scene, push_level, send_status, target_ids, retry_count, "
                + "fail_reason, send_time, left(content_snapshot, 200) as content_digest "
                + "from yq_push_record where find_in_set(?, opinion_ids) "
                + "order by send_time desc limit " + Math.max(limit, 0),
            String.valueOf(opinionId));
    }

    /** 推送规则名称（推送记录展示用） */
    public Map<Long, String> pushRuleNames(Collection<Long> ids) {
        return nameMap("select rule_id as k, rule_name as v from yq_push_rule where rule_id in (%s)", ids);
    }

    /* ------------------------------------------------------------ 内部 */

    /** 通用「ID -> 名称」批量查询；空集合直接返回空 Map，不产生 IN () 语法错误 */
    private Map<Long, String> nameMap(String tpl, Collection<Long> ids) {
        Map<Long, String> out = new LinkedHashMap<>();
        if (ids == null || ids.isEmpty()) {
            return out;
        }
        Set<Long> clean = new LinkedHashSet<>();
        for (Long id : ids) {
            if (id != null) {
                clean.add(id);
            }
        }
        if (clean.isEmpty()) {
            return out;
        }
        String sql = String.format(tpl, placeholders(clean.size()));
        Object[] args = clean.toArray();
        List<Map<String, Object>> rows = jdbc.queryForList(sql, args);
        for (Map<String, Object> row : rows) {
            Object k = row.get("k");
            Object v = row.get("v");
            if (k == null) {
                continue;
            }
            out.put(((Number) k).longValue(), v == null ? null : String.valueOf(v));
        }
        return out;
    }

    /** 生成 n 个 ? 占位符（由集合大小决定，不含任何用户输入） */
    private static String placeholders(int n) {
        StringBuilder sb = new StringBuilder(n * 2);
        for (int i = 0; i < n; i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append('?');
        }
        return sb.toString();
    }

    /** 供子类/扩展使用的空 Map 常量防护 */
    static <K, V> Map<K, V> emptyMap() {
        return new HashMap<>();
    }

    /** 便于函数式回填：取 name 或回落占位 */
    static String nameOr(Map<Long, String> m, Long id, String fallback) {
        if (id == null || m == null) {
            return fallback;
        }
        String v = m.get(id);
        return v == null || v.isBlank() ? fallback : v;
    }

    /** 便于函数式转换：从 Map 取 long 值 */
    static Long asLong(Object v, Long fallback) {
        if (v == null) {
            return fallback;
        }
        if (v instanceof Number n) {
            return n.longValue();
        }
        try {
            return Long.valueOf(String.valueOf(v));
        } catch (RuntimeException e) {
            return fallback;
        }
    }

    /** 便于函数式转换：从 Map 取字符串 */
    static String asString(Object v) {
        return v == null ? null : String.valueOf(v);
    }

    /** 便于函数式转换：把查询结果按字段名抽取（预防驱动返回大小写差异） */
    static Object pick(Map<String, Object> row, String key, String... aliases) {
        if (row == null) {
            return null;
        }
        Object v = row.get(key);
        if (v != null) {
            return v;
        }
        for (String a : aliases) {
            v = row.get(a);
            if (v != null) {
                return v;
            }
        }
        return null;
    }

    /** 便于函数式转换：统一小写字段名索引，规避驱动大小写差异 */
    static Function<Map<String, Object>, Map<String, Object>> lowerKeyed() {
        return src -> {
            Map<String, Object> m = new HashMap<>();
            if (src != null) {
                for (Map.Entry<String, Object> e : src.entrySet()) {
                    m.put(e.getKey() == null ? null : e.getKey().toLowerCase(), e.getValue());
                }
            }
            return m;
        };
    }
}
