/**
 * 统计趋势（按日/周/月）
 */
export interface StatsTrendVO {
  /** 时间标签：日 yyyy-MM-dd / 周 yyyy-ww / 月 yyyy-MM */
  dateLabel?: string;
  /** 巡检次数 */
  inspectCount?: number;
  /** 异常次数 */
  abnormalCount?: number;
  /** 逾期数 */
  overdueCount?: number;
  /** 异常率（%） */
  abnormalRate?: number;
}

/**
 * 点位维度排名
 */
export interface StatsPointRankVO {
  /** 点位ID */
  pointId?: string | number;
  /** 点位名称 */
  pointName?: string;
  /** 机房ID */
  roomId?: string | number;
  /** 机房名称 */
  roomName?: string;
  /** 巡检次数 */
  inspectCount?: number;
  /** 异常次数 */
  abnormalCount?: number;
  /** 异常率（%） */
  abnormalRate?: number;
}

/**
 * 统计查询参数
 */
export interface StatsQuery {
  /** 粒度 day/week/month */
  granularity?: string;
  /** 开始日期 yyyy-MM-dd */
  beginDate?: string;
  /** 结束日期 yyyy-MM-dd */
  endDate?: string;
  /** 机房ID */
  roomId?: string | number;
  /** 排名条数 */
  limit?: number;
}
