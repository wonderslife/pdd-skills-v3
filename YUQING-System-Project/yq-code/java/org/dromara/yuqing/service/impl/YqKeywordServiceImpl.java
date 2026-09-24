package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqKeyword;
import org.dromara.yuqing.mapper.YqKeywordMapper;
import org.dromara.yuqing.service.IYqKeywordService;
import org.springframework.stereotype.Service;
import org.dromara.yuqing.domain.YqKeywordGroup;
import org.dromara.yuqing.mapper.YqKeywordGroupMapper;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 关键词 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class YqKeywordServiceImpl implements IYqKeywordService {

    private final YqKeywordMapper baseMapper;
    private final YqKeywordGroupMapper keywordGroupMapper;

    @Override
    public PageResult<YqKeyword> queryPageList(YqKeyword bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqKeyword> lqw = buildQueryWrapper(bo);
        Page<YqKeyword> page = baseMapper.selectPage(pageQuery.build(), lqw);
        List<YqKeyword> records = page.getRecords();
        fillRefNames(records);
        return PageResult.build(records, page.getTotal());
    }

    @Override
    public List<YqKeyword> queryList(YqKeyword bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqKeyword queryById(Long keywordId) {
        YqKeyword e = baseMapper.selectById(keywordId);
        if (e != null) {
            fillRefNames(List.of(e));
        }
        return e;
    }

    @Override
    public Boolean insertByBo(YqKeyword bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(YqKeyword bo) {
        return baseMapper.updateById(bo) > 0;
    }

    @Override
    public Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid) {
        if (Boolean.TRUE.equals(isValid)) {
            // TODO: 删除前业务校验（存在关联数据时应拒绝删除）
        }
        return baseMapper.deleteByIds(ids) > 0;
    }
    /**
     * 回填关联名称（列表只返回 ID 会导致前端「所属XX」列空白）
     */
    private void fillRefNames(List<YqKeyword> list) {
        if (list == null || list.isEmpty()) {
            return;
        }
        Set<Long> groupIdSet = list.stream().map(YqKeyword::getGroupId).filter(Objects::nonNull).collect(Collectors.toSet());
        if (!groupIdSet.isEmpty()) {
            Map<Long, String> groupIdNameMap = keywordGroupMapper.selectByIds(groupIdSet).stream()
                .collect(Collectors.toMap(YqKeywordGroup::getGroupId, YqKeywordGroup::getGroupName, (a, b) -> a));
            list.forEach(e -> e.setGroupName(groupIdNameMap.get(e.getGroupId())));
        }
    }

    /**
     * 构造查询条件
     */
    private LambdaQueryWrapper<YqKeyword> buildQueryWrapper(YqKeyword bo) {
        LambdaQueryWrapper<YqKeyword> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getKeywordText()), YqKeyword::getKeywordText, bo.getKeywordText());
        lqw.like(StringUtils.isNotBlank(bo.getComboExpression()), YqKeyword::getComboExpression, bo.getComboExpression());
        lqw.eq(ObjectUtil.isNotNull(bo.getGroupId()), YqKeyword::getGroupId, bo.getGroupId());
        lqw.eq(ObjectUtil.isNotNull(bo.getKeywordType()), YqKeyword::getKeywordType, bo.getKeywordType());
        lqw.eq(ObjectUtil.isNotNull(bo.getKeywordCategory()), YqKeyword::getKeywordCategory, bo.getKeywordCategory());
        lqw.eq(ObjectUtil.isNotNull(bo.getRefCount()), YqKeyword::getRefCount, bo.getRefCount());
        lqw.orderByDesc(YqKeyword::getKeywordId);
        return lqw;
    }
}
