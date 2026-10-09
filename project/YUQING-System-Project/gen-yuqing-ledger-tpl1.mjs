/**
 * F-016 台账 · 模板 1：配置属性 + 领域传输对象
 *
 * 产物（rel 为包内相对路径，由 gen-yuqing-ledger.mjs 补 java/org/dromara/yuqing/ 前缀）：
 *   ledger/config/YqLedgerProperties.java
 *   ledger/domain/LedgerQuery.java
 *   ledger/domain/LedgerRow.java
 *   ledger/domain/LedgerDetail.java
 *   ledger/domain/LedgerAnalysisView.java
 *   ledger/domain/LedgerAlertView.java
 *   ledger/domain/LedgerPushView.java
 *   ledger/domain/SearchHit.java
 *   ledger/domain/ClusterView.java
 *   ledger/domain/TimelineNode.java
 *
 * 转义约定（本项目三层转义铁律）：
 *   - 模板串内不得出现裸反引号（gen-yuqing-ledger.mjs 会硬拦截）；
 *   - Java 产物一律用文本块或字符串拼接，不用 \n / \t 转义序列。
 */
export const LEDGER_TPL1 = [

  /* ============================================================ 配置 */
  {
    rel: 'ledger/config/YqLedgerProperties.java',
    content: `package org.dromara.yuqing.ledger.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 舆情台账配置（F-016）
 *
 * <p>前缀 {@code yuqing.ledger}。所有上限默认保守，且都可在 yml 覆盖。</p>
 *
 * <p><b>为什么导出上限要可配：</b>验收标准 5 要求「导出条数与字段范围可配置」，
 * 验收标准 6 要求「超过上限转异步」。上限既决定了同步导出的内存峰值
 * （一次性把 N 行装配进内存 + 序列化 xlsx），也决定了响应时长是否符合
 * PRD §7.1「台账查询 &lt; 500ms」的口径 —— 导出不走这条口径，
 * 但同样不该让用户对着转圈等到超时。</p>
 *
 * @author ruoyi
 */
@Data
@Component
@ConfigurationProperties(prefix = "yuqing.ledger")
public class YqLedgerProperties {

    /** 台账查询单页最大条数（防住 pageSize=999999 这类拖库请求） */
    private int maxPageSize = 200;

    /** 同步导出条数上限；超过则转异步（验收标准 6） */
    private int syncExportLimit = 5000;

    /** 单次导出条数硬上限（同步 + 异步都受此约束，防内存溢出） */
    private int maxExportRows = 200000;

    /** 全文检索返回命中条数上限 */
    private int searchHitLimit = 200;

    /** 每条命中最多多展示几个高亮片段 */
    private int searchFragmentLimit = 3;

    /** 每个高亮片段的上下文半径（命中词左右各取多少字符） */
    private int searchFragmentRadius = 40;

    /** 异步导出的 SnailJob 作业ID；为空则退化为进程内线程池执行 */
    private Long exportJobId;

    /** 异步导出线程池并发度（仅在未配置 exportJobId 时生效） */
    private int exportPoolSize = 2;

    /**
     * 具备「全量数据可见」的角色键列表（数据权限 ③A 的例外口子）。
     *
     * <p>PRD §7.3 规定舆情主管的台账可见范围为「✅ 全部」，
     * 但没规定角色 key 叫什么 —— 各环境的角色键是运维自定的。
     * 硬编码任一 key 都会在客户环境静默失效（表现为「主管只能看到自己的任务」，
     * 且没有任何报错），因此做成配置。</p>
     *
     * <p><b>默认空列表 = 只有超级管理员看全量</b>，这是最保守的默认值：
     * 漏配的后果是「少看」而不是「多看」。生产部署时按实际角色键配置，
     * 例如 {@code yuqing.ledger.all-data-role-keys: yuqing_manager}。</p>
     */
    private java.util.List<String> allDataRoleKeys = new java.util.ArrayList<>();

    /** 是否启用导出审计落库（验收标准 10；生产必须为 true） */
    private boolean exportAuditEnabled = true;

    /**
     * 异步导出完成后是否向用户推送下载链接（验收标准 6）。
     *
     * <p>默认关闭：异步导出至少要有一个可用的推送通道（F-012 企微推送）
     * 才有意义，而推送通道是否就绪是部署期才知道的事。默认关 = 漏配表现为
     * 「没收到推送、需要自己回台账导出记录里取」，而不是启动报错。</p>
     */
    private boolean exportPushEnabled = false;

    /**
     * 异步导出完成通知的接收人用户ID列表。
     *
     * <p>为空则推给「导出发起人本人」——这是最不容易搞错的默认：
     * 谁点的导出，结果就推给谁，天然不会把别人的筛选结果推错人。</p>
     */
    private java.util.List<Long> exportPushUserIds = new java.util.ArrayList<>();

    /**
     * 推送免打扰起始时间（HH:mm，含）。
     *
     * <p>大夜里的导出完成通知没有价值。为空则不做免打扰判断，
     * 只含起始不含结束视为整天免打扰 —— 后者几乎肯定是配置写漏了，
     * 但宁可少推也不要误推。</p>
     */
    private String pushQuietStart;

    /** 推送免打扰结束时间（HH:mm，不含） */
    private String pushQuietEnd;

    /**
     * 事件聚合时间轴最多返回的节点数。
     *
     * <p>一个热点事件可能有上万条关联舆情，全量塞进时间轴前端会卡死。
     * 上限内的节点按时间升序，超出部分只在计数里体现。</p>
     */
    private int timelineNodeLimit = 200;
}
`,
  },

  /* ============================================================ 查询条件 */
  {
    rel: 'ledger/domain/LedgerQuery.java',
    content: `package org.dromara.yuqing.ledger.domain;

import lombok.Data;

import java.util.List;

/**
 * 台账多维检索条件（F-016 验收标准 1）
 *
 * <p>验收标准 1 点名了 11 个维度：时间范围、任务、渠道、舆情属性、风险等级、
 * 舆情分级、标签、关键词、采集来源、清洗状态、研判状态。本类逐项对应，
 * 另加 clusterId（验收标准 4 的聚合事件视角）与发布时间范围
 * （列表要展示发布时间，按发布时间筛是研判员的真实习惯）。</p>
 *
 * <p><b>为什么不直接复用 YqOpinion 实体当查询对象：</b>实体字段是一对一列映射，
 * 而检索条件里有标签集合、关键词、时间区间这些「不对应单列」的项；
 * 混进实体会让 buildQueryWrapper 无法区分「字段为空」与「条件未启用」。</p>
 *
 * <p><b>安全：</b>本类只承载查询条件，不承载任何身份信息。
 * 数据可见范围一律由 {@code LedgerScopeResolver} 从 Sa-Token 上下文推导，
 * 前端无法通过构造本对象越权（详见 LedgerScopeResolver 的类注释）。</p>
 *
 * @author ruoyi
 */
@Data
public class LedgerQuery {

    /* ---------------- 时间维度 ---------------- */

    /** 采集时间起（含），格式 yyyy-MM-dd HH:mm:ss 或 yyyy-MM-dd */
    private String collectBeginTime;

    /** 采集时间止（含） */
    private String collectEndTime;

    /** 发布时间起（含） */
    private String publishBeginTime;

    /** 发布时间止（含） */
    private String publishEndTime;

    /* ---------------- 归属维度 ---------------- */

    /** 所属任务ID */
    private Long taskId;

    /** 来源渠道ID */
    private Long channelId;

    /** 事件聚合ID（验收标准 4） */
    private Long clusterId;

    /* ---------------- 属性维度 ---------------- */

    /** 舆情属性（字典 yq_senti_attr） */
    private String sentiAttr;

    /** 风险等级（字典 yq_risk_level） */
    private String riskLevel;

    /** 舆情分级（字典 yq_opinion_level） */
    private String opinionLevel;

    /** 传播量级（字典 yq_spread_level） */
    private String spreadLevel;

    /* ---------------- 流程维度 ---------------- */

    /** 采集来源（字典 yq_collect_source：auto / manual_import） */
    private String collectSource;

    /** 清洗状态（字典 yq_clean_status：raw / cleaned / rejected） */
    private String cleanStatus;

    /** 研判状态（字典 yq_analyze_status：pending / processing / completed / failed） */
    private String analyzeStatus;

    /* ---------------- 集合与文本维度 ---------------- */

    /** 标签ID集合（多选，命中任意一个即匹配） */
    private List<Long> tagIds;

    /**
     * 关键词。
     *
     * <p>非全文检索模式下按标题模糊匹配；全文检索模式下走正文命中的
     * {@code /yuqing/opinion/search} 端点（验收标准 7）。</p>
     */
    private String keyword;

    /** 关键词作用范围：title / content / both，默认 both */
    private String keywordScope;

    /** 是否只看已预警（0否 1是），空表示不限 */
    private String alertFlag;

    /* ---------------- 排序 ---------------- */

    /** 排序字段：collectTime / publishTime / heatScore，默认 collectTime */
    private String orderBy;

    /** 是否降序，默认 true */
    private Boolean orderDesc;

    /**
     * 关键词作用范围归一化（空值回落 both）。
     *
     * <p>放在领域对象上而不是 Controller 里，是为了让离线自测能直接断言，
     * 也避免多个调用方各自实现一套默认值规则。</p>
     */
    public String normalizedKeywordScope() {
        if (keywordScope == null || keywordScope.isBlank()) {
            return "both";
        }
        String v = keywordScope.trim().toLowerCase();
        if ("title".equals(v) || "content".equals(v)) {
            return v;
        }
        return "both";
    }
}
`,
  },

  /* ============================================================ 列表行 */
  {
    rel: 'ledger/domain/LedgerRow.java',
    content: `package org.dromara.yuqing.ledger.domain;

import lombok.Data;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 台账列表行（F-016 验收标准 2、5）
 *
 * <p>验收标准 2 要求列表展示：标题、来源渠道、发布时间、发布作者、舆情属性、
 * 风险等级、热度、采集时间、研判状态。PRD §4.3 的列定义在此基础上补了
 * 舆情分级、采集来源与操作列所需的主键/链接，本类一并承载。</p>
 *
 * <p><b>为什么单独定义行对象而不直接返回 YqOpinion：</b>
 * 台账要展示 taskName / channelName / clusterTitle 三个跨表字段，
 * 而 YqOpinion 上这三个是 {@code @TableField(exist=false)} 的派生字段；
 * 直接复用会让「能写回数据库」的错觉扩散到只读接口上。</p>
 *
 * <p><b>本类同时充当 Excel 导出载体（验收标准 5）：</b>
 * 带 {@code @ExcelProperty} 的字段就是「可导出字段白名单」，
 * 前端传入的 columns 只能取白名单内的子集（见 LedgerColumnCatalog），
 * 再由 {@code ExcelBuilder.includeFields(...)} 裁剪列 —— 因此不存在
 * 「用户自选任意字段把不该导的列导出去」的越权面。</p>
 *
 * <p><b>注意 annotation 必须用 Fesod 版</b>（{@code org.apache.fesod.sheet.*}），
 * 不是旧的 EasyExcel 包名 —— v6 已切到 Fesod，混用会导致导出静默无表头。</p>
 *
 * @author ruoyi
 */
@Data
@ExcelIgnoreUnannotated
public class LedgerRow implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 舆情ID（导出列名「编号」） */
    @ExcelProperty(value = "编号")
    private Long opinionId;

    /** 舆情标题 */
    @ExcelProperty(value = "舆情标题")
    private String title;

    /** 来源渠道 */
    @ExcelProperty(value = "来源渠道")
    private String channelName;

    /** 所属任务 */
    @ExcelProperty(value = "所属任务")
    private String taskName;

    /** 发布时间 */
    @ExcelProperty(value = "发布时间")
    private LocalDateTime publishTime;

    /** 发布作者/主体 */
    @ExcelProperty(value = "发布作者")
    private String author;

    /** 舆情属性 */
    @ExcelProperty(value = "舆情属性")
    private String sentiAttr;

    /** 风险等级 */
    @ExcelProperty(value = "风险等级")
    private String riskLevel;

    /** 舆情分级 */
    @ExcelProperty(value = "舆情分级")
    private String opinionLevel;

    /** 综合热度分值 */
    @ExcelProperty(value = "热度")
    private Integer heatScore;

    /** 采集来源（auto / manual_import） */
    @ExcelProperty(value = "采集来源")
    private String collectSource;

    /** 采集时间 */
    @ExcelProperty(value = "采集时间")
    private LocalDateTime collectTime;

    /** 研判状态 */
    @ExcelProperty(value = "研判状态")
    private String analyzeStatus;

    /** 清洗状态 */
    @ExcelProperty(value = "清洗状态")
    private String cleanStatus;

    /** 发布地域 */
    @ExcelProperty(value = "发布地域")
    private String region;

    /** 事件聚合标题 */
    @ExcelProperty(value = "关联事件")
    private String clusterTitle;

    /** 原文链接 */
    @ExcelProperty(value = "原文链接")
    private String opinionUrl;

    /* ---------------- 以下为不导出字段（无 @ExcelProperty） ---------------- */

    /** 是否已预警（0否 1是） */
    private String alertFlag;

    /** 是否已推送（0否 1是） */
    private String pushFlag;

    /** 事件聚合ID */
    private Long clusterId;

    /**
     * 命中片段（仅全文检索场景填充，验收标准 7）。
     *
     * <p>非检索场景为 null，前端据此决定是否展示高亮行。
     * 刻意不导出：片段里的 {@code <em>} 标记在 Excel 里只会变成乱码。</p>
     */
    private List<String> fragments;
}
`,
  },

  /* ============================================================ 详情 */
  {
    rel: 'ledger/domain/LedgerDetail.java',
    content: `package org.dromara.yuqing.ledger.domain;

import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 舆情详情（F-016 验收标准 3）
 *
 * <p>验收标准 3 要求详情展示：原文内容、互动数据、完整溯源字段（含原始链接）、
 * 研判结论、预警记录与推送记录。本类是这六块的聚合根。</p>
 *
 * <p><b>跨库来源说明（PRD §6.3）：</b></p>
 * <ul>
 *   <li>Doris / 镜像库：opinion 主体、analysis 研判结论、tags 标签、metric 互动快照</li>
 *   <li>MySQL（master）：task / channel / tag 的名称回填，以及 alert 预警记录、
 *       pushRecord 推送记录</li>
 * </ul>
 * <p>由 {@code YqLedgerDetailAssembler} 先取 Doris 明细，再批量回查 MySQL 补配置字段；
 * 全链路禁止跨库 JOIN、禁止分布式事务。</p>
 *
 * @author ruoyi
 */
@Data
public class LedgerDetail implements Serializable {

    private static final long serialVersionUID = 1L;

    /* ---------------- 原文块 ---------------- */

    /** 舆情ID */
    private Long opinionId;

    /** 标题 */
    private String title;

    /** 原文内容 */
    private String content;

    /** 原文链接（溯源用，前端必须 target=_blank rel=noopener） */
    private String opinionUrl;

    /** 链接 SHA-256（去重指纹，溯源佐证） */
    private String urlHash;

    /** 发布作者/主体 */
    private String author;

    /** 发布时间 */
    private LocalDateTime publishTime;

    /** 发布地域 */
    private String region;

    /** 设备信息 */
    private String deviceInfo;

    /** 话题标签（原文里的 #话题#，非系统标签） */
    private String topicTags;

    /* ---------------- 互动数据块 ---------------- */

    /** 点赞量 */
    private Long likeCount;

    /** 评论量 */
    private Long commentCount;

    /** 转发量 */
    private Long shareCount;

    /** 阅读量 */
    private Long readCount;

    /** 综合热度分值 */
    private Integer heatScore;

    /** 互动数据快照（按日期，最多返回最近 N 条，用于看趋势） */
    private List<MetricPoint> metricTrend;

    /* ---------------- 溯源与归属块 ---------------- */

    /** 所属任务ID */
    private Long taskId;

    /** 所属任务名称 */
    private String taskName;

    /** 来源渠道ID */
    private Long channelId;

    /** 来源渠道名称 */
    private String channelName;

    /** 采集来源（auto / manual_import） */
    private String collectSource;

    /** 采集时间 */
    private LocalDateTime collectTime;

    /** 采集批次号 */
    private String batchNo;

    /** 重复渠道ID（F-006 跨渠道去重时回填） */
    private String dupChannelIds;

    /** 清洗状态 */
    private String cleanStatus;

    /** 降噪剔除原因 */
    private String noiseReason;

    /** 净化时间 */
    private LocalDateTime cleanTime;

    /* ---------------- 研判块 ---------------- */

    /** 研判状态 */
    private String analyzeStatus;

    /** 是否已预警 */
    private String alertFlag;

    /** 是否已推送 */
    private String pushFlag;

    /** 舆情属性（列表口径，来自 yq_opinion） */
    private String sentiAttr;

    /** 风险等级（列表口径） */
    private String riskLevel;

    /** 舆情分级（列表口径） */
    private String opinionLevel;

    /** 传播量级 */
    private String spreadLevel;

    /** 系统标签名集合 */
    private List<String> tagNames;

    /** 最新一次研判结论（可能为空：pending / failed） */
    private LedgerAnalysisView analysis;

    /** 研判历史（多版本，时间倒序） */
    private List<LedgerAnalysisView> analysisHistory;

    /* ---------------- 预警 / 推送块 ---------------- */

    /** 关联预警记录（按触发时间倒序） */
    private List<LedgerAlertView> alerts;

    /** 关联推送记录（按发送时间倒序） */
    private List<LedgerPushView> pushes;

    /* ---------------- 事件聚合块 ---------------- */

    /** 事件聚合ID */
    private Long clusterId;

    /** 事件聚合标题 */
    private String clusterTitle;

    /**
     * 互动数据点（详情页的互动趋势）。
     *
     * <p>独立小对象而不是复用 YqOpinionMetric，是为了只暴露详情页需要的四个量，
     * 避免把 metric 表的主键与采集时间一起推到前端。</p>
     */
    @Data
    public static class MetricPoint implements Serializable {

        private static final long serialVersionUID = 1L;

        /** 快照日期 */
        private java.time.LocalDate snapshotDate;

        /** 点赞量 */
        private Long likeCount;

        /** 评论量 */
        private Long commentCount;

        /** 转发量 */
        private Long shareCount;

        /** 阅读量 */
        private Long readCount;

        /** 热度分值 */
        private Integer heatScore;
    }
}
`,
  },

  /* ============================================================ 研判结论 */
  {
    rel: 'ledger/domain/LedgerAnalysisView.java',
    content: `package org.dromara.yuqing.ledger.domain;

import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 研判结论视图（F-016 验收标准 3 的「研判结论」块）
 *
 * <p>对应 yq_opinion_analysis 一行。刻意与实体分离：实体含 opinion_id 等
 * 内部关联键，前端不需要；且修正研判（F-007 的 correct 端点）只改其中几列，
 * 用视图对象可以明确「哪些列可被人工修改」。</p>
 *
 * @author ruoyi
 */
@Data
public class LedgerAnalysisView implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 研判结果ID */
    private Long analysisId;

    /** 主题识别结果 */
    private String topic;

    /** 核心内容提炼 */
    private String summary;

    /** 情感倾向判定 */
    private String sentiAttr;

    /** 风险属性判定 */
    private String riskAttr;

    /** 风险等级 */
    private String riskLevel;

    /** 舆情分级 */
    private String opinionLevel;

    /** 模型输出标签（逗号分隔） */
    private String tags;

    /** 隐性/变体命中依据 */
    private String matchEvidence;

    /** 处置建议 */
    private String suggestion;

    /** 置信度（%） */
    private BigDecimal confidence;

    /** 模型版本 */
    private String modelVersion;

    /** 提示词版本 */
    private String promptVersion;

    /** 研判版本号 */
    private Integer analyzeVersion;

    /** 是否人工修正（0否 1是） */
    private String correctedFlag;

    /** 修正人用户ID */
    private Long correctedBy;

    /** 修正时间 */
    private LocalDateTime correctedTime;

    /** 研判时间 */
    private LocalDateTime analyzeTime;

    /** 失败原因 */
    private String failReason;
}
`,
  },

  /* ============================================================ 预警记录 */
  {
    rel: 'ledger/domain/LedgerAlertView.java',
    content: `package org.dromara.yuqing.ledger.domain;

import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 详情页的预警记录行（F-016 验收标准 3）
 *
 * <p>数据来自 yq_alert（MySQL，非 Doris）。详情页只读展示，
 * 处置动作仍在 F-010 的预警模块完成 —— 台账不重复提供处置入口，
 * 避免两处都能改状态导致口径打架。</p>
 *
 * @author ruoyi
 */
@Data
public class LedgerAlertView implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 预警ID */
    private Long alertId;

    /** 预警标题 */
    private String alertTitle;

    /** 触发场景 */
    private String triggerScene;

    /** 预警级别 */
    private String alertLevel;

    /** 触发值描述 */
    private String triggerValue;

    /** 触发时间 */
    private LocalDateTime triggerTime;

    /** 处置状态 */
    private String status;

    /** 处置说明 */
    private String processRemark;

    /** 处置人用户ID */
    private Long processBy;

    /** 处置人姓名 */
    private String processByName;

    /** 处置时间 */
    private LocalDateTime processTime;

    /** 推送结果 */
    private String pushResult;

    /** 触发规则名称 */
    private String ruleName;
}
`,
  },

  /* ============================================================ 推送记录 */
  {
    rel: 'ledger/domain/LedgerPushView.java',
    content: `package org.dromara.yuqing.ledger.domain;

import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 详情页的推送记录行（F-016 验收标准 3）
 *
 * <p>数据来自 yq_push_record（MySQL）。{@code contentSnapshot} 是推送出去的内容快照，
 * 台账只回摘要长度，不回全文 —— 快照里可能含大段正文，
 * 详情页展示不下，且它属于推送审计证据，不参与台账阅读。</p>
 *
 * @author ruoyi
 */
@Data
public class LedgerPushView implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 记录ID */
    private Long recordId;

    /** 推送规则名称 */
    private String ruleName;

    /** 推送场景 */
    private String pushScene;

    /** 推送级别 */
    private String pushLevel;

    /** 发送状态 */
    private String sendStatus;

    /** 实际接收人（逗号分隔的用户ID） */
    private String targetIds;

    /** 已重试次数 */
    private Integer retryCount;

    /** 失败原因 */
    private String failReason;

    /** 发送时间 */
    private LocalDateTime sendTime;

    /** 推送内容摘要（截断后的快照，避免把全文推给前端） */
    private String contentDigest;
}
`,
  },

  /* ============================================================ 检索命中 */
  {
    rel: 'ledger/domain/SearchHit.java',
    content: `package org.dromara.yuqing.ledger.domain;

import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 全文检索命中（F-016 验收标准 7）
 *
 * <p>验收标准 7 要求「支持按标题与正文关键词检索，并高亮命中片段」。
 * 本对象承载命中定位信息：
 * {@code hitField} 说明命中在标题还是正文，{@code fragments} 是可以直接
 * 渲染的高亮片段。</p>
 *
 * <p><b>片段是已转义的 HTML：</b>由 {@code LedgerHighlighter} 先做实体转义、
 * 再包裹 {@code <em class="yq-hit">} 标记。前端必须用 v-html 渲染，
 * 而 v-html 是 XSS 的经典入口 —— 因此转义必须在服务端完成且不可绕过。
 * 直接回原文让前端自己高亮是被禁止的做法。</p>
 *
 * @author ruoyi
 */
@Data
public class SearchHit implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 舆情ID */
    private Long opinionId;

    /** 标题（原文，未转义 —— 前端用文本插值渲染） */
    private String title;

    /** 来源渠道 */
    private String channelName;

    /** 发布时间 */
    private LocalDateTime publishTime;

    /** 舆情属性 */
    private String sentiAttr;

    /** 风险等级 */
    private String riskLevel;

    /** 命中字段：title / content / both */
    private String hitField;

    /** 命中次数 */
    private Integer hitCount;

    /** 高亮片段（已转义的安全 HTML，可直接 v-html） */
    private List<String> fragments;

    /** 相关度分值（命中次数加权，仅用于展示排序依据） */
    private Integer score;

    /** 原文链接 */
    private String opinionUrl;
}
`,
  },

  /* ============================================================ 事件聚合 */
  {
    rel: 'ledger/domain/TimelineNode.java',
    content: `package org.dromara.yuqing.ledger.domain;

import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 事件传播时间轴节点（F-016 验收标准 4）
 *
 * <p>验收标准 4 要求「按聚合事件查看关联的全部舆情，并在时间轴上展示传播脉络」。
 * 一个节点 = 一条关联舆情在该事件中的一次发声。</p>
 *
 * <p><b>{@code stage} 由后端判定而不是前端：</b>首发/扩散/峰值/回落的划分
 * 依赖整条时间轴的统计特征（首条、末条、热量最高点），
 * 后端算一次比让每个前端各算一遍更一致。</p>
 *
 * @author ruoyi
 */
@Data
public class TimelineNode implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 舆情ID */
    private Long opinionId;

    /** 发言时间（无发布时间时回落到采集时间） */
    private LocalDateTime time;

    /** 该时间是发布时间还是采集时间（PUBLISH / COLLECT），前端标注口径用 */
    private String timeBasis;

    /** 标题 */
    private String title;

    /** 来源渠道 */
    private String channelName;

    /** 发布作者 */
    private String author;

    /** 舆情属性 */
    private String sentiAttr;

    /** 风险等级 */
    private String riskLevel;

    /** 热度分值 */
    private Integer heatScore;

    /** 原文链接 */
    private String opinionUrl;

    /** 传播阶段：first（首发）/ spread（扩散）/ peak（峰值）/ fall（回落） */
    private String stage;

    /** 相对首发的时间偏移（分钟），便于前端画等距轴 */
    private Long offsetMinutes;
}
`,
  },

  {
    rel: 'ledger/domain/ClusterView.java',
    content: `package org.dromara.yuqing.ledger.domain;

import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 事件聚合视图（F-016 验收标准 4）
 *
 * <p>含事件概要 + 传播时间轴 + 关联舆情清单。时间轴是验收标准 4 的核心交付，
 * 关联清单是它的下钻明细（前端点击节点跳到对应舆情详情）。</p>
 *
 * @author ruoyi
 */
@Data
public class ClusterView implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 聚合ID */
    private Long clusterId;

    /** 事件标题 */
    private String clusterTitle;

    /** 事件主题 */
    private String clusterTopic;

    /** 关联舆情条数 */
    private Integer opinionCount;

    /** 首次出现时间 */
    private LocalDateTime firstTime;

    /** 最近出现时间 */
    private LocalDateTime lastTime;

    /** 峰值热度 */
    private Integer peakHeat;

    /** 事件风险等级 */
    private String riskLevel;

    /** 各阶段条数统计：first / spread / peak / fall */
    private java.util.Map<String, Integer> stageCount;

    /** 传播时间轴（按时间升序，受 timelineNodeLimit 限制） */
    private List<TimelineNode> timeline;

    /** 关联舆情清单（按时间倒序，分页） */
    private List<LedgerRow> opinions;

    /** 时间轴是否被截断（true 时前端提示「仅展示前 N 个节点」） */
    private Boolean timelineTruncated;
}
`,
  },
];
