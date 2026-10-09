package org.dromara.yuqing.collect.keyword;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

/**
 * 词表导入 —— 单条待入库关键词。
 *
 * @author ruoyi
 */
@Data
public class KeywordImportItem implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 关键词文本（落 yq_keyword.keyword_text，VARCHAR(100)） */
    private String keywordText;

    /** 关键词类型：combo / negative / fuzzy */
    private String keywordType;

    /** 关键词分类：core / related / block */
    private String keywordCategory;

    /** 组合表达式原文（仅 combo 有值） */
    private String comboExpression;

    /** 备注（来源段落 + 结构摘要，落 yq_keyword.remark） */
    private String remark;

    /** 原文行号（1 基，便于操作人回定位） */
    private int lineNo;

    /** 组合表达式 —— 组数 */
    private int groupCount;

    /** 组合表达式 —— 总词数（含内联排除词） */
    private int wordCount;

    /** 组合表达式 —— 检索词组（真正发起检索的词，其余组只在本地校验） */
    private List<String> searchTerms = new ArrayList<>();

    /** 是否来自组合表达式内的 -(a|b) 内联排除段 */
    private boolean inlineExclude;

    /** 是否因重复被跳过（预览阶段标记，入库阶段不会出现） */
    private boolean duplicate;
}
