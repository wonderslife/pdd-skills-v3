package org.dromara.yuqing.collect.model;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * 反爬判定结果。
 *
 * @author ruoyi
 */
@Data
public class BlockSignal implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 信号类型 */
    private BlockType type = BlockType.NONE;

    /** 判定依据（写进采集日志 fail_reason，便于运维定位） */
    private String detail;

    /** HTTP 状态码 */
    private int statusCode;

    private BlockSignal() {
    }

    /**
     * 未被拦截。
     *
     * @return 放行信号
     */
    public static BlockSignal ok() {
        return new BlockSignal();
    }

    /**
     * 命中拦截。
     *
     * @param type   信号类型
     * @param detail 判定依据
     * @return 拦截信号
     */
    public static BlockSignal blocked(BlockType type, String detail) {
        BlockSignal s = new BlockSignal();
        s.type = type;
        s.detail = detail;
        return s;
    }

    /**
     * 是否被拦截。
     *
     * @return true = 需要进入对抗策略
     */
    public boolean isBlocked() {
        return type != BlockType.NONE;
    }
}
