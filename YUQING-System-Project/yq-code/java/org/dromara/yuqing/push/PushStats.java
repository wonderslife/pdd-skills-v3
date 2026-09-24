package org.dromara.yuqing.push;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * 推送执行统计（F-011 验收标准 9）
 *
 * @author ruoyi
 */
@Data
public class PushStats {

    /** 处理的推送请求数 */
    private int attempted;

    /** 发送成功 */
    private int sent;

    /** 发送失败（含凭据缺失、目标无法映射） */
    private int failed;

    /** 免打扰顺延 */
    private int deferred;

    /** 跳过（开关关闭 / 无匹配规则） */
    private int skipped;

    /** 落库的推送记录 ID */
    private List<Long> recordIds = new ArrayList<>();

    /** 逐条结果摘要 */
    private List<String> details = new ArrayList<>();

    public void add(PushOutcome o) {
        attempted++;
        if (PushOutcome.SENT.equals(o.getKind())) {
            if (o.isSuccess()) {
                sent++;
            } else {
                failed++;
            }
        } else if (PushOutcome.DEFERRED.equals(o.getKind())) {
            deferred++;
        } else {
            skipped++;
        }
    }
}
