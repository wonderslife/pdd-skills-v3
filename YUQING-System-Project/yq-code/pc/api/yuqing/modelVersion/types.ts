/**
 * 模型版本 查询
 */
export interface YqModelVersionQuery extends PageQuery {
  /** 版本名称 */
  versionName?: string;
  /** 类型 */
  modelType?: string;
  /** 提供方 */
  provider?: string;
  /** 训练样本量 */
  sampleCount?: number;
  /** 训练时间 */
  trainTime?: string;
  /** 评测准确率（%） */
  evalAccuracy?: number;
  /** 是否启用（0否 1是） */
  isActive?: string;
  /** 从哪个版本回滚而来 */
  rollbackFrom?: string;
  /** 备注/回滚原因 */
  remark?: string;
}

/**
 * 模型版本 表单
 */
export interface YqModelVersionForm {
  /** 主键 */
  modelVersionId?: string;
  /** 版本名称 */
  versionName?: string;
  /** 类型 */
  modelType?: string;
  /** 提供方 */
  provider?: string;
  /** 训练样本量 */
  sampleCount?: number;
  /** 训练时间 */
  trainTime?: string;
  /** 评测准确率（%） */
  evalAccuracy?: number;
  /** 是否启用（0否 1是） */
  isActive?: string;
  /** 从哪个版本回滚而来 */
  rollbackFrom?: string;
  /** 备注/回滚原因 */
  remark?: string;

}

/**
 * 模型版本 视图
 */
export interface YqModelVersionVO {
  /** 主键 */
  modelVersionId?: string;
  /** 版本名称 */
  versionName?: string;
  /** 类型 */
  modelType?: string;
  /** 提供方 */
  provider?: string;
  /** 训练样本量 */
  sampleCount?: number;
  /** 训练时间 */
  trainTime?: string;
  /** 评测准确率（%） */
  evalAccuracy?: number;
  /** 是否启用（0否 1是） */
  isActive?: string;
  /** 从哪个版本回滚而来 */
  rollbackFrom?: string;
  /** 备注/回滚原因 */
  remark?: string;
  /** 创建时间 */
  createTime?: string;

}
