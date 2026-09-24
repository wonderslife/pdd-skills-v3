package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqPushTemplate;
import org.dromara.yuqing.mapper.YqPushTemplateMapper;
import org.dromara.yuqing.service.IYqPushTemplateService;
import org.springframework.stereotype.Service;
import java.util.Collection;
import java.util.List;

/**
 * 推送模板 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class YqPushTemplateServiceImpl implements IYqPushTemplateService {

    private final YqPushTemplateMapper baseMapper;

    @Override
    public PageResult<YqPushTemplate> queryPageList(YqPushTemplate bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqPushTemplate> lqw = buildQueryWrapper(bo);
        Page<YqPushTemplate> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<YqPushTemplate> queryList(YqPushTemplate bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqPushTemplate queryById(Long templateId) {
        return baseMapper.selectById(templateId);
    }

    @Override
    public Boolean insertByBo(YqPushTemplate bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(YqPushTemplate bo) {
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
    private LambdaQueryWrapper<YqPushTemplate> buildQueryWrapper(YqPushTemplate bo) {
        LambdaQueryWrapper<YqPushTemplate> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getTemplateName()), YqPushTemplate::getTemplateName, bo.getTemplateName());
        lqw.like(StringUtils.isNotBlank(bo.getFieldList()), YqPushTemplate::getFieldList, bo.getFieldList());
        lqw.eq(ObjectUtil.isNotNull(bo.getContentType()), YqPushTemplate::getContentType, bo.getContentType());
        lqw.eq(ObjectUtil.isNotNull(bo.getStatus()), YqPushTemplate::getStatus, bo.getStatus());
        lqw.orderByDesc(YqPushTemplate::getTemplateId);
        return lqw;
    }
}
