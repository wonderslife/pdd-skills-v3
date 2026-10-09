package org.dromara.yuqing.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.R;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.web.core.BaseController;
import org.dromara.yuqing.ledger.domain.ClusterView;
import org.dromara.yuqing.ledger.service.IYqLedgerService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 事件聚合视图控制器（F-016 验收标准 4）
 *
 * <p>验收标准 4 要求「按聚合事件查看关联的全部舆情，并在时间轴上展示传播脉络」。
 * 这是一个**视角**而非新资源 —— 聚合事件本身由 F-006 的聚类链路产出，
 * 台账只负责按事件把关联舆情与时间轴组装出来。因此本控制器不提供
 * 事件的新增/修改/删除，只有两个只读端点。</p>
 *
 * <p><b>权限复用 {@code yuqing:opinion:*}：</b>菜单体系里没有
 * {@code yuqing:cluster:*} —— 事件聚合是台账（{@code yuqing:opinion}）的
 * 一个视图，独立建菜单会增加运维配置负担（多一个菜单 + 多一套角色授权），
 * 收益却为零。若将来事件聚合要独立授权，再加菜单与权限码即可，
 * 届时把这里的两枚权限码换掉即可，不影响调用方。</p>
 *
 * @author ruoyi
 */
@Validated
@RestController
@RequiredArgsConstructor
@RequestMapping("/yuqing/cluster")
public class YqClusterController extends BaseController {

    private final IYqLedgerService ledgerService;

    /**
     * 事件聚合视图：事件概要 + 传播时间轴 + 关联舆情分页（验收标准 4）
     *
     * @param clusterId 聚合事件ID
     * @param nodeLimit 时间轴节点上限，空则用配置值（防热点事件万级节点卡死前端）
     */
    @SaCheckPermission("yuqing:opinion:query")
    @GetMapping("/{clusterId}")
    public R<ClusterView> detail(
        @PathVariable Long clusterId,
        @RequestParam(required = false) Integer nodeLimit,
        PageQuery pageQuery) {
        return R.ok(ledgerService.cluster(clusterId, nodeLimit, pageQuery));
    }
}
