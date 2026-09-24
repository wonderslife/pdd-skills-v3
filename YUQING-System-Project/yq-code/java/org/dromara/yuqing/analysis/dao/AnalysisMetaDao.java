package org.dromara.yuqing.analysis.dao;

import com.baomidou.dynamic.datasource.annotation.DS;
import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 研判链路 MySQL 侧数据访问（F-007 验收标准 3、8、9、11）
 *
 * <p><b>职责边界：</b>只碰 MySQL 上的表 —— {@code yq_tag}（标签定义）、
 * {@code yq_train_sample}（训练样本）、{@code yq_model_version}（模型版本）、
 * {@code yq_knowledge}（案例）、{@code sys_user / yq_task / yq_channel}（名称回填）。
 * Doris 侧的舆情与结论一律不在这里碰。</p>
 *
 * <p><b>@DS("master") 必须显式标注：</b>动态数据源是线程级上下文，
 * 从 {@code @DS("doris")} 的 DAO 返回后不会自动切回主库；
 * 少了这一行，这里的 SQL 会被路由到 Doris
 * （现象：本地跑得通，接上真 Doris 就报表不存在）。</p>
 *
 * <p><b>为什么用 JdbcTemplate 而不是复用各模块 Mapper：</b>
 * 名称回填要读 yq_task / yq_channel / sys_user，
 * 若 import 它们各自的 Entity 与 Mapper，本模块就与
 * gen-yuqing.mjs（这些表的归属方）耦合：对方改字段名，本模块跟着编译失败，
 * 而编译错误出现在「研判」文件里、根因却在别处。
 * 用 JdbcTemplate 只读所需列，耦合面缩到「列名」这一层。</p>
 *
 * <p><b>安全：</b>所有 SQL 均使用 {@code ?} 预编译占位符；IN 子句的占位符
 * 个数由集合大小生成、值全部走绑定，不存在字符串拼接注入。
 * 名称回填只取非敏感列（名称、昵称），不带出手机号、邮箱。</p>
 *
 * @author ruoyi
 */
@Repository
@RequiredArgsConstructor
@DS("master")
public class AnalysisMetaDao {

    /** 标签来源-模型自动（字典 yq_tag_source） */
    public static final String TAG_SOURCE_MODEL = "model";

    /** 标签来源-人工（字典 yq_tag_source） */
    public static final String TAG_SOURCE_MANUAL = "manual";

    /** 案例类型-人工修正（字典 yq_case_type） */
    public static final String CASE_TYPE_CORRECTION = "correction";

    /** 样本状态-待标注（字典 yq_sample_status，与 PRD 验收标准 9 的用词一致） */
    public static final String SAMPLE_PENDING = "pending";

    private final JdbcTemplate jdbc;

    /* ==================================================== 名称回填 */

    public Map<Long, String> taskNames(Collection<Long> ids) {
        return nameMap("select task_id as k, task_name as v from yq_task where task_id in (%s)", ids);
    }

    public Map<Long, String> channelNames(Collection<Long> ids) {
        return nameMap("select channel_id as k, channel_name as v from yq_channel where channel_id in (%s)", ids);
    }

    public Map<Long, String> tagNames(Collection<Long> ids) {
        return nameMap("select tag_id as k, tag_name as v from yq_tag where tag_id in (%s)", ids);
    }

    /**
     * 批量取用户昵称（验收标准 8：展示修正人）。
     *
     * <p>只取 user_id / nick_name，不触碰手机号、邮箱等字段。
     * 展示「张三修正了结论」用昵称足矣，用账号名反而更敏感。</p>
     */
    public Map<Long, String> userNames(Collection<Long> ids) {
        return nameMap("select user_id as k, nick_name as v from sys_user where user_id in (%s)", ids);
    }

    /**
     * 任务下的监测关键词（验收标准 3：变体表述识别需要「原词」作为基准）。
     *
     * <p>变体识别的本质是「原文里没出现原词，但出现了它的变形」，
     * 因此必须拿到任务配置的原词集合，而不是凭空猜。
     * 关联关系在 {@code yq_task_keyword}（任务与关键词是多对多）。</p>
     *
     * <p>只取启用状态（{@code status = '0'}）且未删除的关键词 ——
     * 已停用的词不该再参与「是否命中」的判定，否则会得出
     * 「命中了三个月前已下线的词」这类无法解释的结论。</p>
     */
    public List<String> keywordsOfTask(Long taskId) {
        if (taskId == null) {
            return new ArrayList<>();
        }
        return jdbc.queryForList(
            "select k.keyword_text from yq_keyword k "
                + "join yq_task_keyword tk on tk.keyword_id = k.keyword_id "
                + "where tk.task_id = ? and k.status = '0' and k.del_flag = '0' "
                + "order by k.keyword_id",
            String.class, taskId);
    }

    /* ==================================================== 标签定义 */

    /** 按名称查标签ID（标签名到ID的映射是自动打标签的前提） */
    public Long tagIdByName(String tagName) {
        if (tagName == null || tagName.isBlank()) {
            return null;
        }
        List<Long> ids = jdbc.queryForList(
            "select tag_id from yq_tag where tag_name = ? and del_flag = '0' limit 1",
            Long.class, tagName.trim());
        return ids.isEmpty() ? null : ids.get(0);
    }

    /**
     * 确保标签存在并返回其ID（幂等）。
     *
     * <p>{@code yq_tag} 上有 {@code UNIQUE KEY uk_yq_tag_name (tag_name)}，
     * 因此并发下两个线程同时建同名标签时，后到的 insert 会撞唯一键。
     * 这里用「先查 -> 查不到则插 -> 撞键则回查」的三步法，
     * 而不是把异常吞掉了事：吞掉异常会导致 tag_id 拿不到，
     * 标签静默丢失（现象：模型给了 5 个标签，库里只落了 3 个）。</p>
     *
     * <p>{@code parent_id = 0} 表示顶级标签；模型的输出是平铺关键词，
     * 不该由程序臆造层级结构，后续人工在标签管理里整理即可。</p>
     */
    public Long ensureTag(String tagName, Long operatorId) {
        if (tagName == null || tagName.isBlank()) {
            return null;
        }
        String name = tagName.trim();
        Long exist = tagIdByName(name);
        if (exist != null) {
            return exist;
        }
        try {
            jdbc.update("insert into yq_tag (tag_id, tag_name, parent_id, order_num, status, del_flag, "
                    + "create_by, create_time) values (?, ?, 0, 0, '0', '0', ?, now())",
                IdWorker.getId(), name, operatorId);
        } catch (DuplicateKeyException e) {
            /* 并发建同名标签：回查拿对方建好的ID，不算失败 */
            return tagIdByName(name);
        }
        return tagIdByName(name);
    }

    /* ==================================================== 模型版本 */

    /**
     * 当前生效的模型版本ID（验收标准 11：结论可追溯）。
     *
     * <p>没有配置任何版本时返回 null —— 此时研判仍可进行，
     * 只是 {@code model_version} 列记基础模型名（如 {@code deepseek-chat}），
     * 不编造一个不存在的版本ID去关联（编造会让「效果比对」失去意义）。</p>
     */
    public Long activeModelVersionId() {
        List<Long> ids = jdbc.queryForList(
            "select model_version_id from yq_model_version where is_active = '1' "
                + "order by train_time desc, model_version_id desc limit 1",
            Long.class);
        return ids.isEmpty() ? null : ids.get(0);
    }

    public String modelVersionName(Long id) {
        if (id == null) {
            return null;
        }
        List<String> names = jdbc.queryForList(
            "select version_name from yq_model_version where model_version_id = ? limit 1",
            String.class, id);
        return names.isEmpty() ? null : names.get(0);
    }

    /** 模型版本列表（PC 端「模型版本」弹窗用，按训练时间倒序） */
    public List<Map<String, Object>> modelVersions(int limit) {
        return jdbc.queryForList(
            "select model_version_id, version_name, model_type, provider, sample_count, "
                + "train_time, eval_accuracy, is_active, rollback_from, remark "
                + "from yq_model_version order by train_time desc, model_version_id desc limit "
                + Math.max(limit, 0));
    }

    /**
     * 回滚到指定版本（验收标准 11 的「效果可比对」落地）：
     * 把目标版本置为启用、其余版本置为停用，并在目标行上记录来源版本与原因。
     *
     * <p>两次 update 必须在同一事务里（由调用方 Service 声明事务）——
     * DAO 层不自己开事务，否则嵌套调用时事务边界会变得不可预测。
     * 这里刻意<b>不</b>加 {@code @Transactional}。</p>
     *
     * <p>{@code rollback_from} 只在目标行上写：它是「这一版是从哪一版退回来的」，
     * 属于被启用版本的属性。</p>
     */
    public int activateModelVersion(Long targetId, Long fromId, String remark) {
        if (targetId == null) {
            return 0;
        }
        jdbc.update("update yq_model_version set is_active = '0' where is_active = '1' "
            + "and model_version_id <> ?", targetId);
        return jdbc.update("update yq_model_version set is_active = '1', rollback_from = ?, remark = ? "
            + "where model_version_id = ?", fromId, remark, targetId);
    }

    /* ==================================================== 训练样本（验收标准 9） */

    /** 来源舆情是否已建过案例（幂等判定的第一步） */
    public Long knowledgeIdByOpinion(Long opinionId) {
        if (opinionId == null) {
            return null;
        }
        List<Long> ids = jdbc.queryForList(
            "select knowledge_id from yq_knowledge where opinion_id = ? and del_flag = '0' "
                + "order by knowledge_id desc limit 1",
            Long.class, opinionId);
        return ids.isEmpty() ? null : ids.get(0);
    }

    /** 该案例下是否已有待标注样本（幂等判定的第二步） */
    public Long pendingSampleId(Long knowledgeId) {
        if (knowledgeId == null) {
            return null;
        }
        List<Long> ids = jdbc.queryForList(
            "select sample_id from yq_train_sample where knowledge_id = ? and sample_status = ? "
                + "order by sample_id desc limit 1",
            Long.class, knowledgeId, SAMPLE_PENDING);
        return ids.isEmpty() ? null : ids.get(0);
    }

    /**
     * 建案例快照（人工修正后把「原文 + 修正后结论」固化为案例）。
     *
     * <p>{@code case_title} 是 NOT NULL 列，必须给值 —— 取舆情标题，
     * 超长按列宽截断（此处按 300 截，与 DDL 的 VARCHAR(300) 对齐）。
     * 若标题为空则回落一个可识别的占位，而不是让 insert 抛异常：
     * 采样失败不该连带把人工修正也回滚掉（用户的核心诉求是修正结论）。</p>
     */
    public int insertKnowledge(Long knowledgeId, Long opinionId, String caseType, String caseTitle,
                               String originData, String opinionUrl, String analyzeResult,
                               String levelTags, String manualCorrection, Long operatorId) {
        String title = caseTitle == null || caseTitle.isBlank() ? "(无标题舆情)" : caseTitle.trim();
        if (title.length() > 300) {
            title = title.substring(0, 300);
        }
        return jdbc.update("insert into yq_knowledge (knowledge_id, opinion_id, case_type, case_title, "
                + "origin_data, opinion_url, analyze_result, level_tags, manual_correction, "
                + "status, del_flag, create_by, create_time) "
                + "values (?, ?, ?, ?, ?, ?, ?, ?, ?, '0', '0', ?, now())",
            knowledgeId, opinionId, caseType, title, originData, opinionUrl, analyzeResult,
            levelTags, manualCorrection, operatorId);
    }

    /**
     * 登记训练样本。
     *
     * <p><b>样本状态为何是 {@code pending}：</b>PRD 验收标准 9 的原话是
     * 「自动登记为<b>待标注</b>训练样本」，因此按字典 {@code yq_sample_status}
     * 的 {@code pending}（待标注）落库，与需求用词保持一致。
     * 需要说明的是：人工修正本身已经提供了标注内容（{@code label_content}），
     * 这里的 pending 更准确的语义是「待纳入训练集」；
     * {@code labeled_by / labeled_time} 仍填修正人与修正时刻 ——
     * 「这条标签是谁、什么时候给的」这个信息不能丢，将来做效果比对要用。</p>
     */
    public int insertTrainSample(Long sampleId, Long knowledgeId, Long modelVersionId,
                                 String labelContent, Long labeledBy) {
        return jdbc.update("insert into yq_train_sample (sample_id, knowledge_id, model_version_id, "
                + "sample_status, label_content, labeled_by, labeled_time) "
                + "values (?, ?, ?, ?, ?, ?, now())",
            sampleId, knowledgeId, modelVersionId, SAMPLE_PENDING, labelContent, labeledBy);
    }

    /* ==================================================== 内部 */

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
}
