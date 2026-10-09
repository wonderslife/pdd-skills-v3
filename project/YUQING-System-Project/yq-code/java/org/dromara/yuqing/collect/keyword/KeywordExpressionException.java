package org.dromara.yuqing.collect.keyword;

import java.io.Serial;

/**
 * 关键词组合表达式语法异常。
 *
 * <p>携带出错列位置（1 基），便于关键词库录入界面直接定位
 * （F-002 验收标准 3：提供语法校验并给出错误位置）。</p>
 *
 * @author ruoyi
 */
public class KeywordExpressionException extends RuntimeException {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 出错列号（1 基）；0 表示整体性错误，无具体列 */
    private final int column;

    public KeywordExpressionException(int column, String message) {
        super(column > 0 ? "第 " + column + " 列：" + message : message);
        this.column = column;
    }

    public int getColumn() {
        return column;
    }
}
