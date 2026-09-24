package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqKnowledge;
import org.dromara.yuqing.mapper.YqKnowledgeMapper;
import org.dromara.yuqing.service.IYqKnowledgeService;
import org.springframework.stereotype.Service;
import java.util.Collection;
import java.util.List;

/**
 * 知识库案例 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class YqKnowledgeServiceImpl implements IYqKnowledgeService {

    private final YqKnowledgeMapper baseMapper;

    @Override
    public PageResult<YqKnowledge> queryPageList(YqKnowledge bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqKnowledge> lqw = buildQueryWrapper(bo);
        Page<YqKnowledge> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<YqKnowledge> queryList(YqKnowledge bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqKnowledge queryById(Long knowledgeId) {
        return baseMapper.selectById(knowledgeId);
    }

    @Override
    public Boolean insertByBo(YqKnowledge bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(YqKnowledge bo) {
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
     * 构造查询条件
     */
    private LambdaQueryWrapper<YqKnowledge> buildQueryWrapper(YqKnowledge bo) {
        LambdaQueryWrapper<YqKnowledge> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getCaseTitle()), YqKnowledge::getCaseTitle, bo.getCaseTitle());
        lqw.like(StringUtils.isNotBlank(bo.getLevelTags()), YqKnowledge::getLevelTags, bo.getLevelTags());
        lqw.like(StringUtils.isNotBlank(bo.getSceneCategory()), YqKnowledge::getSceneCategory, bo.getSceneCategory());
        lqw.eq(ObjectUtil.isNotNull(bo.getOpinionId()), YqKnowledge::getOpinionId, bo.getOpinionId());
        lqw.eq(ObjectUtil.isNotNull(bo.getCaseType()), YqKnowledge::getCaseType, bo.getCaseType());
        lqw.eq(ObjectUtil.isNotNull(bo.getStatus()), YqKnowledge::getStatus, bo.getStatus());
        lqw.orderByDesc(YqKnowledge::getKnowledgeId);
        return lqw;
    }
}
