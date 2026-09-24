package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.exception.ServiceException;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.yuqing.collect.keyword.KeywordImportItem;
import org.dromara.yuqing.collect.keyword.KeywordImportParser;
import org.dromara.yuqing.collect.keyword.KeywordImportResult;
import org.dromara.yuqing.domain.YqKeyword;
import org.dromara.yuqing.domain.YqKeywordGroup;
import org.dromara.yuqing.domain.YqTaskKeyword;
import org.dromara.yuqing.mapper.YqKeywordGroupMapper;
import org.dromara.yuqing.mapper.YqKeywordMapper;
import org.dromara.yuqing.mapper.YqTaskKeywordMapper;
import org.dromara.yuqing.mapper.YqTaskMapper;
import org.dromara.yuqing.service.IYqKeywordImportService;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * 关键词词表导入 Service业务层处理。
 *
 * <p><b>幂等</b>：按 {@code keyword_text} 查找已有记录，命中则复用（不重复插入）；
 * 任务关联按 {@code (task_id, keyword_id)} 去重。因此同一份词表重复导入
 * 只会「补齐」不会「翻倍」。</p>
 *
 * <p><b>安全</b>：全部走 LambdaQueryWrapper，无字符串拼 SQL；
 * 入参长度与条目数双重上限，避免一次请求把库打爆。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class YqKeywordImportServiceImpl implements IYqKeywordImportService {

    /** 未指定分组时使用的默认分组名 */
    private static final String DEFAULT_GROUP_NAME = "词表导入";

    /** 单次导入文本上限（字符）：一份万行词表远小于此值 */
    private static final int MAX_TEXT_LENGTH = 512 * 1024;

    private final YqKeywordMapper keywordMapper;
    private final YqKeywordGroupMapper keywordGroupMapper;
    private final YqTaskKeywordMapper taskKeywordMapper;
    private final YqTaskMapper taskMapper;

    @Override
    public KeywordImportResult preview(String text) {
        ensureLength(text);
        return KeywordImportParser.parse(text);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public KeywordImportResult commit(String text, Long taskId, Long groupId,
                                      String groupName, String matchStrategy) {
        ensureLength(text);
        KeywordImportResult result = KeywordImportParser.parse(text);
        if (!result.isOk()) {
            return result;
        }
        if (taskId != null && taskMapper.selectById(taskId) == null) {
            result.getErrors().add("监测任务不存在：" + taskId);
            return result;
        }
        Long resolvedGroupId = resolveGroup(groupId, groupName);
        result.setGroupId(resolvedGroupId);
        result.setCommitted(true);

        List<Long> touchedKeywordIds = new ArrayList<>();
        for (KeywordImportItem item : result.getItems()) {
            YqKeyword existing = findKeyword(item.getKeywordText());
            Long keywordId;
            if (existing == null) {
                YqKeyword entity = new YqKeyword();
                entity.setGroupId(resolvedGroupId);
                entity.setKeywordText(item.getKeywordText());
                entity.setKeywordType(item.getKeywordType());
                entity.setKeywordCategory(item.getKeywordCategory());
                entity.setComboExpression(item.getComboExpression());
                entity.setRefCount(0);
                entity.setStatus("0");
                entity.setRemark(item.getRemark());
                keywordMapper.insert(entity);
                keywordId = entity.getKeywordId();
                result.setInsertedKeywords(result.getInsertedKeywords() + 1);
            } else {
                keywordId = existing.getKeywordId();
                result.setReusedKeywords(result.getReusedKeywords() + 1);
                /* 早期数据可能只填了文本、没填表达式 —— 补齐，否则组合语义在采集侧仍然丢失 */
                if (StringUtils.isNotBlank(item.getComboExpression())
                    && StringUtils.isBlank(existing.getComboExpression())) {
                    YqKeyword patch = new YqKeyword();
                    patch.setKeywordId(keywordId);
                    patch.setComboExpression(item.getComboExpression());
                    keywordMapper.updateById(patch);
                }
            }
            touchedKeywordIds.add(keywordId);
            if (taskId != null) {
                bindTask(result, taskId, keywordId, matchStrategy);
            }
        }
        if (taskId != null && !touchedKeywordIds.isEmpty()) {
            refreshRefCount(touchedKeywordIds);
        }
        log.info("[词表导入] taskId={} groupId={} {}", taskId, resolvedGroupId, result.summary());
        return result;
    }

    /* ---------------------------------------------------------------- 内部 */

    private void ensureLength(String text) {
        if (text != null && text.length() > MAX_TEXT_LENGTH) {
            throw new ServiceException("词表内容 " + text.length()
                + " 字符，超过单次导入上限 " + MAX_TEXT_LENGTH + "，请拆分后再导入");
        }
    }

    private YqKeyword findKeyword(String keywordText) {
        LambdaQueryWrapper<YqKeyword> lqw = new LambdaQueryWrapper<>();
        lqw.eq(YqKeyword::getKeywordText, keywordText).last("limit 1");
        List<YqKeyword> list = keywordMapper.selectList(lqw);
        return list.isEmpty() ? null : list.get(0);
    }

    private void bindTask(KeywordImportResult result, Long taskId, Long keywordId, String matchStrategy) {
        LambdaQueryWrapper<YqTaskKeyword> lqw = new LambdaQueryWrapper<>();
        lqw.eq(YqTaskKeyword::getTaskId, taskId).eq(YqTaskKeyword::getKeywordId, keywordId);
        if (taskKeywordMapper.selectCount(lqw) > 0) {
            result.setSkippedRelations(result.getSkippedRelations() + 1);
            return;
        }
        YqTaskKeyword rel = new YqTaskKeyword();
        rel.setTaskId(taskId);
        rel.setKeywordId(keywordId);
        rel.setMatchStrategy(matchStrategy);
        taskKeywordMapper.insert(rel);
        result.setBoundRelations(result.getBoundRelations() + 1);
    }

    /** 引用次数 = 关联任务数，逐词重算，避免累加漂移 */
    private void refreshRefCount(List<Long> keywordIds) {
        for (Long keywordId : keywordIds) {
            LambdaQueryWrapper<YqTaskKeyword> lqw = new LambdaQueryWrapper<>();
            lqw.eq(YqTaskKeyword::getKeywordId, keywordId);
            long count = taskKeywordMapper.selectCount(lqw);
            YqKeyword patch = new YqKeyword();
            patch.setKeywordId(keywordId);
            patch.setRefCount((int) count);
            keywordMapper.updateById(patch);
        }
    }

    /**
     * 解析落库分组：传 ID 则校验存在；否则按名称查找，找不到就新建。
     */
    private Long resolveGroup(Long groupId, String groupName) {
        if (groupId != null) {
            if (keywordGroupMapper.selectById(groupId) == null) {
                throw new ServiceException("关键词分组不存在：" + groupId);
            }
            return groupId;
        }
        String name = StringUtils.isBlank(groupName) ? DEFAULT_GROUP_NAME : groupName.trim();
        LambdaQueryWrapper<YqKeywordGroup> lqw = new LambdaQueryWrapper<>();
        lqw.eq(YqKeywordGroup::getGroupName, name);
        List<YqKeywordGroup> exists = keywordGroupMapper.selectList(lqw);
        if (!exists.isEmpty()) {
            return exists.get(0).getGroupId();
        }
        YqKeywordGroup group = new YqKeywordGroup();
        group.setGroupName(name);
        try {
            keywordGroupMapper.insert(group);
        } catch (DuplicateKeyException e) {
            /* uk_yq_kwgroup_name 只含 group_name：同名但已被逻辑删除时会撞唯一键 */
            List<YqKeywordGroup> again = keywordGroupMapper.selectList(lqw);
            if (!again.isEmpty()) {
                return again.get(0).getGroupId();
            }
            throw new ServiceException("关键词分组「" + name
                + "」已存在同名记录（可能已被删除），请换一个分组名或先恢复该分组", e);
        }
        return group.getGroupId();
    }
}
