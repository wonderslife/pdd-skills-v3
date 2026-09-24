package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqTaskKeyword;
import org.dromara.yuqing.mapper.YqTaskKeywordMapper;
import org.dromara.yuqing.service.IYqTaskKeywordService;
import org.springframework.stereotype.Service;
import org.dromara.yuqing.domain.YqKeyword;
import org.dromara.yuqing.mapper.YqKeywordMapper;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 任务关键词关联 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class YqTaskKeywordServiceImpl implements IYqTaskKeywordService {

    private final YqTaskKeywordMapper baseMapper;
    private final YqKeywordMapper keywordMapper;

    @Override
    public PageResult<YqTaskKeyword> queryPageList(YqTaskKeyword bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqTaskKeyword> lqw = buildQueryWrapper(bo);
        Page<YqTaskKeyword> page = baseMapper.selectPage(pageQuery.build(), lqw);
        List<YqTaskKeyword> records = page.getRecords();
        fillRefNames(records);
        return PageResult.build(records, page.getTotal());
    }

    @Override
    public List<YqTaskKeyword> queryList(YqTaskKeyword bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqTaskKeyword queryById(Long id) {
        YqTaskKeyword e = baseMapper.selectById(id);
        if (e != null) {
            fillRefNames(List.of(e));
        }
        return e;
    }

    @Override
    public Boolean insertByBo(YqTaskKeyword bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(YqTaskKeyword bo) {
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
    private void fillRefNames(List<YqTaskKeyword> list) {
        if (list == null || list.isEmpty()) {
            return;
        }
        Set<Long> keywordIdSet = list.stream().map(YqTaskKeyword::getKeywordId).filter(Objects::nonNull).collect(Collectors.toSet());
        if (!keywordIdSet.isEmpty()) {
            Map<Long, String> keywordIdNameMap = keywordMapper.selectByIds(keywordIdSet).stream()
                .collect(Collectors.toMap(YqKeyword::getKeywordId, YqKeyword::getKeywordText, (a, b) -> a));
            list.forEach(e -> e.setKeywordText(keywordIdNameMap.get(e.getKeywordId())));
        }
    }

    /**
     * 构造查询条件
     */
    private LambdaQueryWrapper<YqTaskKeyword> buildQueryWrapper(YqTaskKeyword bo) {
        LambdaQueryWrapper<YqTaskKeyword> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getMatchStrategy()), YqTaskKeyword::getMatchStrategy, bo.getMatchStrategy());
        lqw.eq(ObjectUtil.isNotNull(bo.getTaskId()), YqTaskKeyword::getTaskId, bo.getTaskId());
        lqw.eq(ObjectUtil.isNotNull(bo.getKeywordId()), YqTaskKeyword::getKeywordId, bo.getKeywordId());
        lqw.orderByDesc(YqTaskKeyword::getId);
        return lqw;
    }
}
