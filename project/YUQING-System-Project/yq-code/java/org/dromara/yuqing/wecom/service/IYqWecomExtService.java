package org.dromara.yuqing.wecom.service;

import org.dromara.system.domain.vo.SysClientVo;
import org.dromara.yuqing.wecom.command.ParsedCommand;
import org.dromara.yuqing.wecom.domain.WecomCommandBo;
import org.dromara.yuqing.wecom.domain.WecomHomeVo;
import org.dromara.yuqing.wecom.domain.WecomSupplementBo;

import java.util.Map;

/**
 * 企业微信 H5 端扩展服务（F-012）
 *
 * <p>与生成器产出的通用 CRUD 服务区分开：本接口只承载「有业务逻辑」的端点，
 * 全部由手写实现（{@code YqWecomExtServiceImpl}）。</p>
 *
 * @author ruoyi
 */
public interface IYqWecomExtService {

    /**
     * 首页聚合数据（验收标准 2）
     */
    WecomHomeVo home();

    /**
     * 补充事件信息，纳入舆情库同源管理（验收标准 4）
     *
     * @return 补充记录 ID
     */
    Long supplement(WecomSupplementBo bo);

    /**
     * 解析并（可选）执行自然语言指令（验收标准 6）
     *
     * @param bo 指令请求体
     * @return 包含 parsed / execStatus / result 的结果视图
     */
    Map<String, Object> handleCommand(WecomCommandBo bo);

    /**
     * 解析指令但不执行（供 PC 端预览 / 自测使用）
     */
    ParsedCommand parseOnly(String text);

    /**
     * 构造免登授权链接（验收标准 1，供 PC 端生成二维码 / 分享入口）
     */
    String buildAuthLink(String state);

    /**
     * 触发报告生成（验收标准 7；F-014 未落地前返回未启用说明）
     */
    Map<String, Object> triggerReport(String reportType);

    /**
     * 客户端配置解析（H5 端 clientId 对应的 SysClientVo）
     */
    SysClientVo resolveClient(String clientId);
}
