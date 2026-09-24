package org.dromara.yuqing.analytics;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * 一次聚合的产出
 *
 * <p>三张表一起装在一个对象里返回，是为了让 Service 层能在一处做
 * 「写 Doris 失败就整批标 failed」的判断，而不是三个方法各自抛异常。</p>
 *
 * @author ruoyi
 */
@Data
public class AggregateOutcome {

    /** 读取到的明细条数 */
    private int sourceCount;

    /** 是否因命中读取上限被截断 */
    private boolean truncated;

    /** 覆盖的统计日起止 */
    private java.time.LocalDate beginDate;

    /** 覆盖的统计日截止 */
    private java.time.LocalDate endDate;

    /** 日聚合行 */
    private List<DailyRow> daily = new ArrayList<>();

    /** 维度分布行（含趋势行） */
    private List<DimRow> dim = new ArrayList<>();

    /** 热点排行行 */
    private List<HotRow> hot = new ArrayList<>();

    /** 非致命提示（前端原样展示，用于解释「为什么数字看起来不对」） */
    private List<String> notices = new ArrayList<>();

    /** 追加一条提示（自动去重） */
    public void notice(String msg) {
        if (msg != null && !msg.isBlank() && !notices.contains(msg)) {
            notices.add(msg);
        }
    }

    /** 合并后的提示文本，落库到 yq_stats_batch.notice */
    public String noticeText() {
        return notices.isEmpty() ? null : String.join("；", notices);
    }
}
