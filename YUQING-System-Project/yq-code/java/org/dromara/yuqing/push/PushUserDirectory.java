package org.dromara.yuqing.push;

import java.util.Set;

/**
 * 推送目标人目录
 *
 * <p>抽成接口的原因有二：一是按角色/部门/人员三种口径的解析策略不同，
 * 二是离线自测需要注入内存实现（无 Spring 上下文、无数据库）。</p>
 *
 * @author ruoyi
 */
public interface PushUserDirectory {

    /** 按角色解析出用户 ID 集合 */
    Set<Long> byRole(Long roleId);

    /** 按部门解析出用户 ID 集合 */
    Set<Long> byDept(Long deptId);

    /** 直接解析逗号分隔的用户 ID 串，非法片段静默丢弃 */
    Set<Long> byExplicit(String csvIds);

    /**
     * 把系统用户 ID 映射为企业微信成员 ID
     *
     * @return 企微成员 ID；无法映射返回 null
     */
    String wecomUserId(Long userId);
}
