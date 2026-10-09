package org.dromara.yuqing.wecom.controller;

import cn.dev33.satoken.annotation.SaIgnore;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.domain.R;
import org.dromara.common.core.exception.ServiceException;
import org.dromara.common.satoken.utils.LoginHelper;
import org.dromara.system.domain.vo.SysClientVo;
import org.dromara.web.domain.vo.LoginVo;
import org.dromara.yuqing.wecom.WecomLoginException;
import org.dromara.yuqing.wecom.WecomLoginService;
import org.dromara.yuqing.wecom.domain.WecomAuthVo;
import org.dromara.yuqing.wecom.domain.WecomCommandBo;
import org.dromara.yuqing.wecom.domain.WecomHomeVo;
import org.dromara.yuqing.wecom.domain.WecomSupplementBo;
import org.dromara.yuqing.wecom.service.IYqWecomExtService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 企业微信 H5 端控制器（F-012）
 *
 * <p><b>端点归属：</b>本控制器承载 F-012 的「有业务逻辑」端点，
 * 与生成器产出的通用 CRUD 控制器（{@code /yuqing/wecomCommand}）互不重叠。</p>
 *
 * <p><b>鉴权策略：</b></p>
 * <ul>
 *   <li>{@code /auth} 与 {@code /appInfo} 必须 {@code @SaIgnore}（此时用户还没有 token）；</li>
 *   <li>其余端点一律要求已登录，写操作按权限码校验。</li>
 * </ul>
 *
 * @author ruoyi
 */
@Slf4j
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/yuqing/wecom")
public class YqWecomAuthController {

    private final WecomLoginService loginService;
    private final IYqWecomExtService extService;

    /**
     * 企业微信网页授权免登（验收标准 1）。
     *
     * <p>H5 {@code auth.vue} 在 onLoad 拿到 code 后调用；失败时前端自动降级到账号密码登录，
     * 因此这里失败要返回明确的用户可读原因，而不是抛 500。</p>
     *
     * @param code    企微授权 code
     * @param clientId 客户端 ID（H5 端传 {@code 428a8310cd442757ae699df5d894f051}）
     */
    @SaIgnore
    @GetMapping("/auth")
    public R<WecomAuthVo> auth(@RequestParam(required = false) String code,
                               @RequestParam(required = false) String clientId) {
        WecomAuthVo vo = new WecomAuthVo();
        try {
            SysClientVo client = extService.resolveClient(clientId);
            if (client == null) {
                return fail(vo, "客户端配置不存在：" + clientId);
            }
            LoginVo loginVo = loginService.loginByCode(code, client);
            vo.setAccessToken(loginVo.getAccessToken());
            vo.setExpireIn(loginVo.getExpireIn());
            vo.setClientId(loginVo.getClientId());
            vo.setSuccess(true);
            vo.setMessage("免登成功");
            return R.ok(vo);
        } catch (WecomLoginException e) {
            // 业务性失败：用户可读原因，前端据此降级
            log.info("[企微] 免登未成功（业务原因）: {}", e.getMessage());
            return fail(vo, e.getMessage());
        } catch (Exception e) {
            log.warn("[企微] 免登异常", e);
            return fail(vo, "企业微信免登暂时不可用，请使用账号密码登录");
        }
    }

    /**
     * 免登入口预检（验收标准 1）：返回是否已配置凭据与授权链接，
     * 供 H5 首屏判断「该走免登还是直接走账号密码登录」。
     */
    @SaIgnore
    @GetMapping("/appInfo")
    public R<Map<String, Object>> appInfo() {
        Map<String, Object> m = new LinkedHashMap<>();
        String link = extService.buildAuthLink(null);
        m.put("configured", link != null);
        m.put("authLink", link);
        m.put("message", link == null
            ? "企业微信免登未配置，请使用账号密码登录"
            : "企业微信免登已配置");
        return R.ok(m);
    }

    /**
     * H5 首页聚合数据（验收标准 2）
     */
    @GetMapping("/home")
    public R<WecomHomeVo> home() {
        return R.ok(extService.home());
    }

    /**
     * 补充事件信息（验收标准 4）
     */
    @PostMapping("/supplement")
    public R<Long> supplement(@Validated @RequestBody WecomSupplementBo bo) {
        return R.ok(extService.supplement(bo));
    }

    /**
     * 自然语言指令（验收标准 6 / 12）
     */
    @PostMapping("/command")
    public R<Map<String, Object>> command(@Validated @RequestBody WecomCommandBo bo) {
        Long userId = LoginHelper.getUserId();
        if (userId == null) {
            throw new ServiceException("未登录，无法下达指令");
        }
        return R.ok(extService.handleCommand(bo));
    }

    /**
     * 触发报告生成（验收标准 7）
     *
     * @param reportType 报告类型：daily / monthly / flash / special
     */
    @PostMapping("/report/trigger")
    public R<Map<String, Object>> triggerReport(@RequestParam(defaultValue = "daily") String reportType) {
        return R.ok(extService.triggerReport(reportType));
    }

    /**
     * 构造免登授权链接（供 PC 端生成入口分享）
     */
    @GetMapping("/authLink")
    public R<String> authLink(@RequestParam(required = false) String state) {
        return R.ok(extService.buildAuthLink(state));
    }

    private static R<WecomAuthVo> fail(WecomAuthVo vo, String message) {
        vo.setSuccess(false);
        vo.setMessage(message);
        return R.ok(vo);
    }
}
