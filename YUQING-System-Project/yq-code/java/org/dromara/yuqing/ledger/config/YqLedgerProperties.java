package org.dromara.yuqing.ledger.config;

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
