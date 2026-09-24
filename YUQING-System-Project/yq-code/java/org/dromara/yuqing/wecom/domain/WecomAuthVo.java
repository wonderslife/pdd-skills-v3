package org.dromara.yuqing.wecom.domain;

import lombok.Data;

/**
 * 企微免登返回体（F-012 验收标准 1）
 *
 * <p>字段名与 H5 {@code auth.vue} 的取值逻辑对齐：页面兼容取
 * {@code access_token / accessToken / token}，这里统一返回 {@code accessToken} 并额外给 snake 别名，
 * 避免前端因命名差异拿不到 token。</p>
 *
 * @author ruoyi
 */
@Data
public class WecomAuthVo {

    /** Sa-Token 令牌 */
    private String accessToken;

    /** 令牌有效期（秒） */
    private Long expireIn;

    /** 客户端 ID */
    private String clientId;

    /** 若依用户 ID */
    private Long userId;

    /** 登录名 */
    private String userName;

    /** 昵称（展示用） */
    private String nickName;

    /** 企业微信成员 ID */
    private String wecomUserId;

    /** 是否免登成功 */
    private boolean success;

    /** 失败原因（success=false 时给前端展示） */
    private String message;
}
