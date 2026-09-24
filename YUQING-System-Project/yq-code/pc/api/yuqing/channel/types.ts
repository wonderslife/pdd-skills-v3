/**
 * 采集渠道 查询
 */
export interface YqChannelQuery extends PageQuery {
  /** 渠道名称 */
  channelName?: string;
  /** 渠道类别 */
  channelCategory?: string;
  /** 域名或平台标识 */
  channelDomain?: string;
  /** 站点适配器标识（YAML 配置键） */
  adapterClass?: string;
  /** 绑定采集器ID */
  collectorId?: string;
  /** 渠道级频率覆盖（秒） */
  intervalOverride?: number;
  /** 请求间隔（毫秒） */
  requestInterval?: number;
  /** 并发上限 */
  concurrencyLimit?: number;
  /** 代理池分组ID */
  proxyGroupId?: string;
  /** UA 池ID */
  uaPoolId?: string;
  /** 失败率告警阈值（%） */
  failRateThreshold?: number;
  /** 最近采集时间 */
  lastCollectTime?: string;
  /** 状态（0正常 1停用） */
  status?: string;
  /** 备注 */
  remark?: string;
}

/**
 * 采集渠道 表单
 */
export interface YqChannelForm {
  /** 主键 */
  channelId?: string;
  /** 渠道名称 */
  channelName?: string;
  /** 渠道类别 */
  channelCategory?: string;
  /** 域名或平台标识 */
  channelDomain?: string;
  /** 站点适配器标识（YAML 配置键） */
  adapterClass?: string;
  /** 绑定采集器ID */
  collectorId?: string;
  /** 渠道级频率覆盖（秒） */
  intervalOverride?: number;
  /** 请求间隔（毫秒） */
  requestInterval?: number;
  /** 并发上限 */
  concurrencyLimit?: number;
  /** 代理池分组ID */
  proxyGroupId?: string;
  /** UA 池ID */
  uaPoolId?: string;
  /** 失败率告警阈值（%） */
  failRateThreshold?: number;
  /** 最近采集时间 */
  lastCollectTime?: string;
  /** 状态（0正常 1停用） */
  status?: string;
  /** 备注 */
  remark?: string;

}

/**
 * 采集渠道 视图
 */
export interface YqChannelVO {
  /** 主键 */
  channelId?: string;
  /** 渠道名称 */
  channelName?: string;
  /** 渠道类别 */
  channelCategory?: string;
  /** 域名或平台标识 */
  channelDomain?: string;
  /** 站点适配器标识（YAML 配置键） */
  adapterClass?: string;
  /** 绑定采集器ID */
  collectorId?: string;
  /** 渠道级频率覆盖（秒） */
  intervalOverride?: number;
  /** 请求间隔（毫秒） */
  requestInterval?: number;
  /** 并发上限 */
  concurrencyLimit?: number;
  /** 代理池分组ID */
  proxyGroupId?: string;
  /** UA 池ID */
  uaPoolId?: string;
  /** 失败率告警阈值（%） */
  failRateThreshold?: number;
  /** 最近采集时间 */
  lastCollectTime?: string;
  /** 状态（0正常 1停用） */
  status?: string;
  /** 备注 */
  remark?: string;
  /** 创建时间 */
  createTime?: string;

}
