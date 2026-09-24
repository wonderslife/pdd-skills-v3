/**
 * 任务渠道关联 查询
 */
export interface YqTaskChannelQuery extends PageQuery {
  /** 任务ID */
  taskId?: string;
  /** 渠道ID */
  channelId?: string;
  /** 任务级频率覆盖（秒） */
  overrideInterval?: number;
}

/**
 * 任务渠道关联 表单
 */
export interface YqTaskChannelForm {
  /** 主键 */
  id?: string;
  /** 任务ID */
  taskId?: string;
  /** 渠道ID */
  channelId?: string;
  /** 任务级频率覆盖（秒） */
  overrideInterval?: number;
  /** 渠道名称 */
  channelName?: string;
}

/**
 * 任务渠道关联 视图
 */
export interface YqTaskChannelVO {
  /** 主键 */
  id?: string;
  /** 任务ID */
  taskId?: string;
  /** 渠道ID */
  channelId?: string;
  /** 任务级频率覆盖（秒） */
  overrideInterval?: number;
  /** 创建时间 */
  createTime?: string;
  /** 渠道名称 */
  channelName?: any;
}
