package org.dromara.yuqing.wecom;

/**
 * 企业微信成员信息（F-012 验收标准 1）
 *
 * <p>免登换取到的成员身份载体，不落库，仅作为服务层返回值。</p>
 *
 * @param userId   企业微信成员 ID（UserId，企微通讯录内唯一）
 * @param openId   非企业成员访问时的 OpenId（外部联系人场景）
 * @param userTicket 使用 snsapi_privateinfo 授权时返回，可用于换取手机号/邮箱
 * @param deviceId 设备 ID（企业微信返回，一般不用）
 *
 * @author ruoyi
 */
public record WecomMemberInfo(String userId, String openId, String userTicket, String deviceId) {

    /** 是否为可信的企业内部成员（拿到 UserId 才算） */
    public boolean isEnterpriseMember() {
        return userId != null && !userId.isBlank();
    }
}
