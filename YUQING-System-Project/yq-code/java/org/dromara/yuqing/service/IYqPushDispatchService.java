package org.dromara.yuqing.service;

import org.dromara.yuqing.alert.AlertCandidate;
import org.dromara.yuqing.push.PushStats;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * 推送调度服务（F-011）
 *
 * @author ruoyi
 */
public interface IYqPushDispatchService {

    /**
     * 把指定预警推送到配置对象（场景由预警级别映射）
     *
     * @param alertIds 预警 ID
     */
    PushStats pushAlerts(Collection<Long> alertIds);

    /**
     * 通用批量推送（摘要式采集概况 / 报告文件）
     *
     * @param scene     推送场景
     * @param taskName  任务名（摘要标题用）
     * @param total     采集总数
     * @param negative  负面条数
     * @param neutral   中性条数
     * @param deduped   去重后条数
     * @param negatives 负面明细
     * @param reportId  报告 ID（report_ready 场景）
     * @param fileName  报告文件名
     * @param fileBytes 报告内容
     */
    PushStats pushBatch(String scene, String taskName, int total, int negative, int neutral, int deduped,
                        List<AlertCandidate> negatives, Long reportId, String fileName, byte[] fileBytes);

    /**
     * 重发一条失败记录（F-011 验收标准 8）
     *
     * @param recordId 推送记录 ID
     */
    PushStats retry(Long recordId);

    /**
     * 刷出免打扰顺延的定时批量（F-011 验收标准 1 / 3）
     *
     * @return 本次实际发送条数
     */
    int flushScheduled();

    /** 按时间与对象统计推送量与成功率（F-011 验收标准 9） */
    Map<String, Object> statistics(LocalDate from, LocalDate to);
}
