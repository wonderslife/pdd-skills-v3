package org.dromara.yuqing.analytics.jdbc;

import lombok.Data;
import org.dromara.yuqing.analytics.OpinionSlice;

import java.util.ArrayList;
import java.util.List;

/**
 * 明细读取结果（含截断标记）
 *
 * @author ruoyi
 */
@Data
public class SliceLoad {

    /** 明细切片 */
    private List<OpinionSlice> slices = new ArrayList<>();

    /** 是否因命中上限被截断 */
    private boolean truncated;

    public int size() {
        return slices.size();
    }
}
