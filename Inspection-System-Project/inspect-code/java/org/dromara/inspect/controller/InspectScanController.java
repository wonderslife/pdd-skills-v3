package org.dromara.inspect.controller;

import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.R;
import org.dromara.common.web.core.BaseController;
import org.dromara.inspect.domain.bo.ScanResolveBo;
import org.dromara.inspect.domain.vo.ScanPointVo;
import org.dromara.inspect.service.IInspectPointExtService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 扫码解析 Controller（PRD 模块 7）
 * <p>
 * H5 专用入口。PRD 6.3 未为其配置权限码，但 Sa-Token 全局登录拦截仍然生效
 * （未登录会 401）。真正的业务校验在 resolveScan 内部完成：
 * 1) 解密/匹配点位；2) 点位状态（停用/维护中拒绝）；3) 归属机房校验；
 * 4) 本周期是否已巡检（已巡检返回 inspectedInCycle=true，前端禁止重复提交）。
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/inspect/scan")
public class InspectScanController extends BaseController {

    private final IInspectPointExtService pointExtService;

    /**
     * 二维码内容 -> 点位详情（含巡检项清单）
     */
    @PostMapping("/resolve")
    public R<ScanPointVo> resolve(@Validated @RequestBody ScanResolveBo bo) {
        return R.ok(pointExtService.resolveScan(bo.getContent()));
    }

}
