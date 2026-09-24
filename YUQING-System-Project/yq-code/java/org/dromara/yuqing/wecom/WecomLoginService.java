package org.dromara.yuqing.wecom;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.constant.SystemConstants;
import org.dromara.common.satoken.utils.LoginHelper;
import org.dromara.system.domain.vo.SysUserVo;
import org.dromara.system.mapper.SysUserMapper;
import org.dromara.yuqing.wecom.config.YqWecomProperties;
import org.dromara.web.domain.vo.LoginVo;
import org.dromara.web.service.IAuthStrategy;
import org.dromara.web.service.SysLoginService;
import org.dromara.system.domain.vo.SysClientVo;
import org.springframework.stereotype.Service;

import cn.dev33.satoken.stp.StpUtil;
import cn.dev33.satoken.stp.parameter.SaLoginParameter;

import java.io.IOException;

/**
 * 企业微信网页授权免登服务（F-012 验收标准 1）
 *
 * <p><b>流程：</b>code → 企微换成员身份 → 映射若依用户 → 构造 LoginUser → 签发 token。</p>
 *
 * <p><b>关键设计（与若依登录体系对齐）：</b>
 * 本服务仿 {@code PasswordAuthStrategy} 的写法：拿 {@link SysClientVo} 的 clientKey/deviceType
 * 填充 LoginUser，并用 {@link IAuthStrategy#buildLoginParameter} 构造登录参数 ——
 * 这样签发的 token 与账号密码登录签发的 token 结构完全一致，
 * H5 端 {@code App-Token} 的后续请求才能通过 {@code @SaCheckPermission} 鉴权。</p>
 *
 * <p><b>安全：</b></p>
 * <ul>
 *   <li>只信任企微服务端返回的 UserId，不信任前端传入的任何用户标识；</li>
 *   <li>映射不到若依用户时明确抛错，<b>不自动创建账号</b>；</li>
 *   <li>校验用户状态（停用 / 已删除一律拒绝）。</li>
 * </ul>
 *
 * @author ruoyi
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WecomLoginService {

    private final YqWecomProperties props;
    private final WecomApiClient apiClient;
    private final WecomBindResolver bindResolver;
    private final SysLoginService loginService;
    private final SysUserMapper userMapper;

    /**
     * 用企业微信授权 code 完成免登并返回登录凭证。
     *
     * @param code   企微网页授权 code
     * @param client 当前客户端配置（H5 应用端 clientId 对应的配置）
     * @return 登录结果（accessToken / expireIn / clientId）
     * @throws IOException 企微接口调用失败
     * @throws WecomLoginException 免登不可用或用户映射失败（业务异常，含用户可读原因）
     */
    public LoginVo loginByCode(String code, SysClientVo client) throws IOException {
        if (!props.isEnabled()) {
            throw new WecomLoginException("企业微信免登未启用，请使用账号密码登录");
        }
        if (!apiClient.configured()) {
            throw new WecomLoginException("企业微信免登凭据未配置，请联系管理员或使用账号密码登录");
        }
        if (code == null || code.isBlank()) {
            throw new WecomLoginException("缺少企业微信授权 code");
        }

        // 1. 换成员身份（只信企微服务端结果）
        WecomMemberInfo member = apiClient.getUserInfoByCode(code);
        if (!member.isEnterpriseMember()) {
            throw new WecomLoginException("当前企业微信账号不是本企业成员，无法免登");
        }
        String wecomUserId = member.userId();

        // 2. 映射若依用户
        Long userId = bindResolver.resolve(wecomUserId);
        if (userId == null) {
            log.warn("[企微] 免登失败：成员 {} 未映射到任何若依用户", wecomUserId);
            throw new WecomLoginException("该企业微信成员未绑定系统账号，请联系管理员在后台完成绑定");
        }

        // 3. 校验用户状态
        SysUserVo user = userMapper.selectVoById(userId);
        if (user == null) {
            throw new WecomLoginException("绑定关系已失效，请重新绑定");
        }
        if (SystemConstants.DISABLE.equals(user.getStatus())) {
            log.warn("[企微] 免登被拒：用户 {} 已停用", userId);
            throw new WecomLoginException("账号已停用，请联系管理员");
        }

        // 4. 构造登录用户（口径与账号密码登录一致）
        var loginUser = loginService.buildLoginUser(user);
        loginUser.setClientKey(client.getClientKey());
        loginUser.setDeviceType(client.getDeviceType());
        SaLoginParameter model = IAuthStrategy.buildLoginParameter(client);

        // 5. 签发 token
        LoginHelper.login(loginUser, model);

        // 6. 留痕绑定（失败不阻塞主流程）
        bindResolver.recordBinding(userId, wecomUserId);

        LoginVo vo = new LoginVo();
        vo.setAccessToken(StpUtil.getTokenValue());
        vo.setExpireIn(StpUtil.getTokenTimeout());
        vo.setClientId(client.getClientId());
        log.info("[企微] 免登成功 userId={} wecomUserId={}", userId, wecomUserId);
        return vo;
    }
}
