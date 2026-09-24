package org.dromara.yuqing.analysis.variant;

import lombok.Data;

import java.io.Serializable;

/**
 * 一处变体表述命中（F-007 验收标准 3）
 *
 * <p>「命中依据」要能被人工复核，因此必须可解释：说明<b>原词是什么、
 * 原文里以什么形态出现、属于哪一类变体</b>。只给一个「疑似变体」的
 * 布尔值是没法复核的。</p>
 *
 * @author ruoyi
 */
@Data
public class VariantRule implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 任务关键词（本应被检索到的原词）；为 null 表示缩写提示 */
    private String keyword;

    /** 原文中实际出现的形态 */
    private String form;

    /**
     * 变体类别：
     * separator 插入分隔符 / fullwidth 全半角 / case 大小写 /
     * spaced 字符间插空白 / numeric 数字字母混写 / abbr 疑似缩写
     */
    private String category;

    /** 在原文中的近似位置（找不到为 -1） */
    private int position = -1;

    public VariantRule() {
    }

    public VariantRule(String keyword, String form, String category, int position) {
        this.keyword = keyword;
        this.form = form;
        this.category = category;
        this.position = position;
    }
}
