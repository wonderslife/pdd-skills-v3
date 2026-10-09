package org.dromara.yuqing.collect.keyword;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

/**
 * 词表导入 —— 解析 / 入库结果。
 *
 * <p>{@link #errors} 非空即整体不可入库：宁可让操作人改词表，
 * 也不要把半成品写进库导致「采不到东西而且不报错」。</p>
 *
 * @author ruoyi
 */
@Data
public class KeywordImportResult implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 解析出的条目（不含被跳过的重复项） */
    private List<KeywordImportItem> items = new ArrayList<>();

    /** 致命问题：非空表示整体拒绝 */
    private List<String> errors = new ArrayList<>();

    /** 提醒：不阻断入库 */
    private List<String> warnings = new ArrayList<>();

    /** 被跳过的重复词 */
    private List<String> duplicates = new ArrayList<>();

    /** 原文总行数 */
    private int totalLines;

    /** 组合表达式条数 */
    private int comboCount;

    /** 排除词条数 */
    private int negativeCount;

    /** 普通词条数 */
    private int plainCount;

    /** 重复跳过条数 */
    private int duplicateCount;

    /** 其中来自表达式内联 -(…) 的排除词条数 */
    private int inlineExcludeCount;

    /** 预计检索请求次数（各组合表达式检索词组词数之和） */
    private int searchTermCount;

    /** 新写入 yq_keyword 条数（commit 后才有值） */
    private int insertedKeywords;

    /** 复用已有 yq_keyword 条数 */
    private int reusedKeywords;

    /** 新建 yq_task_keyword 关联条数 */
    private int boundRelations;

    /** 已存在的任务关联（跳过）条数 */
    private int skippedRelations;

    /** 实际落库使用的分组ID */
    private Long groupId;

    /** 是否真正执行了写库 */
    private boolean committed;

    /**
     * @return true 表示无致命错误，可入库
     */
    public boolean isOk() {
        return errors.isEmpty();
    }

    /**
     * @return 组合表达式条目
     */
    public List<KeywordImportItem> combos() {
        return filterByType(KeywordImportParser.TYPE_COMBO);
    }

    /**
     * @return 排除词条目
     */
    public List<KeywordImportItem> negatives() {
        return filterByType(KeywordImportParser.TYPE_NEGATIVE);
    }

    /**
     * @return 普通词条目
     */
    public List<KeywordImportItem> plains() {
        return filterByType(KeywordImportParser.TYPE_PLAIN);
    }

    private List<KeywordImportItem> filterByType(String type) {
        List<KeywordImportItem> list = new ArrayList<>();
        for (KeywordImportItem item : items) {
            if (type.equals(item.getKeywordType())) {
                list.add(item);
            }
        }
        return list;
    }

    /**
     * 一句话摘要，直接回显给操作人。
     *
     * @return 摘要文本
     */
    public String summary() {
        StringBuilder sb = new StringBuilder();
        sb.append("共 ").append(items.size()).append(" 条")
          .append("（组合 ").append(comboCount)
          .append(" / 排除 ").append(negativeCount)
          .append(" / 普通 ").append(plainCount).append("）");
        if (duplicateCount > 0) {
            sb.append("；跳过重复 ").append(duplicateCount).append(" 条");
        }
        if (searchTermCount > 0) {
            sb.append("；预计检索请求 ").append(searchTermCount).append(" 次");
        }
        if (committed) {
            sb.append("。入库：新增关键词 ").append(insertedKeywords)
              .append(" 条、复用 ").append(reusedKeywords)
              .append(" 条、新建任务关联 ").append(boundRelations).append(" 条");
        }
        return sb.toString();
    }

    @Override
    public String toString() {
        return summary();
    }
}
