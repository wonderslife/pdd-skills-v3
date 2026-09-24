package org.dromara.yuqing.service;

import org.dromara.yuqing.collect.keyword.KeywordImportResult;

/**
 * 关键词词表导入 Service接口。
 *
 * <p>对应 F-002「关键词管理」的批量录入能力：把业务同事手写的词表文本
 * 一次转成 {@code yq_keyword} + {@code yq_task_keyword} 记录。</p>
 *
 * @author ruoyi
 */
public interface IYqKeywordImportService {

    /**
     * 解析预览（不写库）。
     *
     * @param text 词表原文
     * @return 解析结果
     */
    KeywordImportResult preview(String text);

    /**
     * 解析并入库（事务）。
     *
     * @param text          词表原文
     * @param taskId        绑定任务ID，可为空
     * @param groupId       关键词分组ID，可为空
     * @param groupName     分组名称，groupId 为空时生效
     * @param matchStrategy 任务级匹配策略，可为空
     * @return 结果（含入库统计）
     */
    KeywordImportResult commit(String text, Long taskId, Long groupId, String groupName, String matchStrategy);
}
