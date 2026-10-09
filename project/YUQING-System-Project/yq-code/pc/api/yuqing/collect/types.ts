/**
 * F-004 采集调度 · 运维接口类型
 */

export interface CollectOverview {
  engineEnabled: boolean;
  sinkMode: string;
  dedupMode: string;
  totalFetched: number;
  todayFetched: number;
  todayInserted: number;
  todayDup: number;
  todayFailed: number;
  todayBatches: number;
  enabledTasks: number;
  enabledChannels: number;
  adapterCount: number;
  taskStates: TaskRunState[];
  unhealthyUnits: string[];
  serverTime: string;
}

export interface TaskRunState {
  taskId: string | number;
  taskName: string;
  lastScheduleTime: string;
  lastResultStatus: string;
  consecutiveAbnormal: number;
  abnormal: boolean;
}

export interface CollectUnit {
  taskId: string | number;
  taskName: string;
  channelId: string | number;
  channelName: string;
  adapterCode: string;
  collectStrategy: string;
  intervalSeconds: number;
  batchNo: string;
  watermark: string;
  keywords: string[];
  concurrencyLimit: number;
  requestIntervalMs: number;
  skipReason: string;
}

export interface CollectResult {
  batchNo: string;
  taskId: string | number;
  taskName: string;
  channelId: string | number;
  channelName: string;
  strategy: string;
  fetchedCount: number;
  insertedCount: number;
  dupCount: number;
  rejectedCount: number;
  failedCount: number;
  costMs: number;
  resultStatus: string;
  failReason: string;
  collectTime: string;
}

export interface DispatchSummary {
  batchNo: string;
  engineEnabled: boolean;
  taskCount: number;
  unitCount: number;
  skippedCount: number;
  successCount: number;
  partialCount: number;
  failedCount: number;
  costMs: number;
  message: string;
  details: CollectResult[];
}
