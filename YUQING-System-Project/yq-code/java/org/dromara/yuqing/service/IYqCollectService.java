package org.dromara.yuqing.service;

import org.dromara.yuqing.collect.model.CollectOverview;
import org.dromara.yuqing.collect.model.CollectResult;
import org.dromara.yuqing.collect.model.CollectUnit;
import org.dromara.yuqing.collect.model.DispatchSummary;
import org.dromara.yuqing.collect.model.RawOpinion;
import org.dromara.yuqing.domain.YqTask;

import java.util.List;

/**
 * 全网自动采集与调度 Service 接口（F-004）。
 *
 * <p>对应 PRD §6.2 内部接口：{@code YqCollectService.dispatch}（按任务与渠道下发采集批次）、
 * {@code YqCollectService.saveRaw}（原始数据落库 + 链接去重）。</p>
 *
 * <p>本功能点对外无 REST 接口（见 dev-specs/F-004-collect.md）；采集日志查询与导出归 F-018 运营监控。</p>
 *
 * @author ruoyi
 */
public interface IYqCollectService {

    /**
     * 按任务与渠道下发采集批次（调度器入口，SnailJob 定时调用）。
     *
     * @return 调度汇总
     */
    DispatchSummary dispatch();

    /**
     * 只下发指定任务的采集批次。
     *
     * @param taskId 任务ID
     * @return 调度汇总
     */
    DispatchSummary dispatchTask(Long taskId);

    /**
     * 立即执行单个采集单元。
     *
     * @param taskId    任务ID
     * @param channelId 渠道ID
     * @return 批次结果
     */
    CollectResult collectOnce(Long taskId, Long channelId);

    /**
     * 原始数据落库 + 链接去重（供链接导入、文件导入等非爬虫入口复用）。
     *
     * @param unit    采集单元
     * @param rawList 原始舆情
     * @return 批次结果
     */
    CollectResult saveRaw(CollectUnit unit, List<RawOpinion> rawList);

    /**
     * 采集运行概览（验收标准 8）。
     *
     * @return 概览
     */
    CollectOverview overview();

    /**
     * 预览某任务可下发的采集单元（不执行），含跳过原因。
     *
     * @param taskId 任务ID，为空时预览全部启用任务
     * @return 采集单元列表
     */
    List<CollectUnit> planUnits(Long taskId);

    /**
     * 校验任务的采集频率是否满足渠道限流下限（验收标准 2）。
     *
     * @param task 任务
     * @return 问题列表
     */
    List<String> validateSchedule(YqTask task);

    /**
     * 校验关键词组合表达式语法（F-002 验收标准 3：提供语法校验并给出错误位置）。
     *
     * @param expression 表达式，如 {@code (辽宁|沈阳)+(药监局|药品监管)}
     * @return 问题列表（每条自带列位置）；空列表表示合法
     */
    List<String> validateKeywordExpression(String expression);
}
