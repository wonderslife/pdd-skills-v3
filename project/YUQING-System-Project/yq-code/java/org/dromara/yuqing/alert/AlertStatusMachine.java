package org.dromara.yuqing.alert;

import org.dromara.common.core.exception.ServiceException;
import org.dromara.yuqing.domain.YqAlert;

import java.util.Set;

/**
 * 预警处置状态机（F-010 验收标准 5 / 6）
 *
 * <p>状态：{@code pending}（未处置）→ {@code processing}（处置中）→ {@code handled}（已处置）/ {@code ignored}（已忽略）。</p>
 *
 * <p>硬约束：标记「已处置」必须填写处置说明，未填写直接拒绝提交（验收标准 6）。</p>
 *
 * @author ruoyi
 */
public final class AlertStatusMachine {

    public static final String PENDING = "pending";
    public static final String PROCESSING = "processing";
    public static final String HANDLED = "handled";
    public static final String IGNORED = "ignored";

    private static final Set<String> ALL = Set.of(PENDING, PROCESSING, HANDLED, IGNORED);

    private AlertStatusMachine() {
    }

    /** 是否为合法状态 */
    public static boolean isValid(String status) {
        return status != null && ALL.contains(status);
    }

    /**
     * 状态流转是否允许
     *
     * <p>已终结（handled / ignored）不允许再改，避免处置结论被悄悄推翻后无法追溯。</p>
     */
    public static boolean canTransit(String from, String to) {
        if (!isValid(from) || !isValid(to)) {
            return false;
        }
        if (HANDLED.equals(from) || IGNORED.equals(from)) {
            return false;
        }
        if (PENDING.equals(from)) {
            return PROCESSING.equals(to) || HANDLED.equals(to) || IGNORED.equals(to);
        }
        // processing
        return HANDLED.equals(to) || IGNORED.equals(to);
    }

    /**
     * 校验一次处置提交
     *
     * @param alert    待更新记录（status 已由调用方置为新状态）
     * @param operator 操作人，用于异常消息定位
     * @throws ServiceException 状态非法 / 流转不允许 / 已处置但缺处置说明
     */
    public static void validate(YqAlert alert, String operator) {
        if (alert == null) {
            throw new ServiceException("预警记录不存在");
        }
        String to = alert.getStatus();
        if (!isValid(to)) {
            throw new ServiceException("处置状态非法: " + to);
        }
        if (HANDLED.equals(to)) {
            String remark = alert.getProcessRemark();
            if (remark == null || remark.trim().isEmpty()) {
                throw new ServiceException("标记为「已处置」时必须填写处置说明");
            }
            if (remark.trim().length() < 5) {
                throw new ServiceException("处置说明过短，请不少于 5 个字符描述具体处置动作");
            }
        }
        if (IGNORED.equals(to)) {
            String remark = alert.getProcessRemark();
            if (remark == null || remark.trim().isEmpty()) {
                throw new ServiceException("标记为「已忽略」时必须填写忽略理由");
            }
        }
    }
}
