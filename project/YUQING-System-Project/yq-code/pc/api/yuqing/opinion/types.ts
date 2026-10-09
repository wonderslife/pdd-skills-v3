/**
 * 舆情明细 查询
 */
export interface YqOpinionQuery extends PageQuery {
  /** 分区列=采集日期 */
  collectDate?: string;
  /** 所属任务ID */
  taskId?: string;
  /** 来源渠道ID */
  channelId?: string;
  /** 舆情标题 */
  title?: string;
  /** 原文内容 */
  content?: string;
  /** 原文链接 */
  opinionUrl?: string;
  /** 链接 SHA-256（唯一去重主键载体） */
  urlHash?: string;
  /** 发布时间 */
  publishTime?: string;
  /** 发布作者/主体 */
  author?: string;
  /** 点赞量 */
  likeCount?: string;
  /** 评论量 */
  commentCount?: string;
  /** 转发量 */
  shareCount?: string;
  /** 阅读量 */
  readCount?: string;
  /** 发布地域 */
  region?: string;
  /** 设备信息 */
  deviceInfo?: string;
  /** 话题标签（逗号分隔） */
  topicTags?: string;
  /** 综合热度分值 */
  heatScore?: number;
  /** 舆情属性 */
  sentiAttr?: string;
  /** 舆情分级 */
  opinionLevel?: string;
  /** 风险等级 */
  riskLevel?: string;
  /** 传播量级 */
  spreadLevel?: string;
  /** 事件聚合ID */
  clusterId?: string;
  /** 采集来源 */
  collectSource?: string;
  /** 采集时间 */
  collectTime?: string;
  /** 采集批次号 */
  batchNo?: string;
  /** 清洗状态 */
  cleanStatus?: string;
  /** 降噪剔除原因 */
  noiseReason?: string;
  /** 重复渠道ID（逗号分隔） */
  dupChannelIds?: string;
  /** 净化时间 */
  cleanTime?: string;
  /** 研判状态 */
  analyzeStatus?: string;
  /** 是否已预警（0否 1是） */
  alertFlag?: string;
  /** 是否已推送（0否 1是） */
  pushFlag?: string;
}

/**
 * 舆情明细 表单
 */
export interface YqOpinionForm {
  /** 主键 */
  opinionId?: string;
  /** 分区列=采集日期 */
  collectDate?: string;
  /** 所属任务ID */
  taskId?: string;
  /** 来源渠道ID */
  channelId?: string;
  /** 舆情标题 */
  title?: string;
  /** 原文内容 */
  content?: string;
  /** 原文链接 */
  opinionUrl?: string;
  /** 链接 SHA-256（唯一去重主键载体） */
  urlHash?: string;
  /** 发布时间 */
  publishTime?: string;
  /** 发布作者/主体 */
  author?: string;
  /** 点赞量 */
  likeCount?: string;
  /** 评论量 */
  commentCount?: string;
  /** 转发量 */
  shareCount?: string;
  /** 阅读量 */
  readCount?: string;
  /** 发布地域 */
  region?: string;
  /** 设备信息 */
  deviceInfo?: string;
  /** 话题标签（逗号分隔） */
  topicTags?: string;
  /** 综合热度分值 */
  heatScore?: number;
  /** 舆情属性 */
  sentiAttr?: string;
  /** 舆情分级 */
  opinionLevel?: string;
  /** 风险等级 */
  riskLevel?: string;
  /** 传播量级 */
  spreadLevel?: string;
  /** 事件聚合ID */
  clusterId?: string;
  /** 采集来源 */
  collectSource?: string;
  /** 采集时间 */
  collectTime?: string;
  /** 采集批次号 */
  batchNo?: string;
  /** 清洗状态 */
  cleanStatus?: string;
  /** 降噪剔除原因 */
  noiseReason?: string;
  /** 重复渠道ID（逗号分隔） */
  dupChannelIds?: string;
  /** 净化时间 */
  cleanTime?: string;
  /** 研判状态 */
  analyzeStatus?: string;
  /** 是否已预警（0否 1是） */
  alertFlag?: string;
  /** 是否已推送（0否 1是） */
  pushFlag?: string;
  /** 任务名称 */
  taskName?: string;
  /** 渠道名称 */
  channelName?: string;
  /** 事件标题 */
  clusterTitle?: string;
}

/**
 * 舆情明细 视图
 */
export interface YqOpinionVO {
  /** 主键 */
  opinionId?: string;
  /** 分区列=采集日期 */
  collectDate?: string;
  /** 所属任务ID */
  taskId?: string;
  /** 来源渠道ID */
  channelId?: string;
  /** 舆情标题 */
  title?: string;
  /** 原文内容 */
  content?: string;
  /** 原文链接 */
  opinionUrl?: string;
  /** 链接 SHA-256（唯一去重主键载体） */
  urlHash?: string;
  /** 发布时间 */
  publishTime?: string;
  /** 发布作者/主体 */
  author?: string;
  /** 点赞量 */
  likeCount?: string;
  /** 评论量 */
  commentCount?: string;
  /** 转发量 */
  shareCount?: string;
  /** 阅读量 */
  readCount?: string;
  /** 发布地域 */
  region?: string;
  /** 设备信息 */
  deviceInfo?: string;
  /** 话题标签（逗号分隔） */
  topicTags?: string;
  /** 综合热度分值 */
  heatScore?: number;
  /** 舆情属性 */
  sentiAttr?: string;
  /** 舆情分级 */
  opinionLevel?: string;
  /** 风险等级 */
  riskLevel?: string;
  /** 传播量级 */
  spreadLevel?: string;
  /** 事件聚合ID */
  clusterId?: string;
  /** 采集来源 */
  collectSource?: string;
  /** 采集时间 */
  collectTime?: string;
  /** 采集批次号 */
  batchNo?: string;
  /** 清洗状态 */
  cleanStatus?: string;
  /** 降噪剔除原因 */
  noiseReason?: string;
  /** 重复渠道ID（逗号分隔） */
  dupChannelIds?: string;
  /** 净化时间 */
  cleanTime?: string;
  /** 研判状态 */
  analyzeStatus?: string;
  /** 是否已预警（0否 1是） */
  alertFlag?: string;
  /** 是否已推送（0否 1是） */
  pushFlag?: string;
  /** 创建时间 */
  createTime?: string;
  /** 任务名称 */
  taskName?: any;
  /** 渠道名称 */
  channelName?: any;
  /** 事件标题 */
  clusterTitle?: any;
}
