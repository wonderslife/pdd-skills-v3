import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/** 单条待导入关键词 */
export interface KeywordImportItem {
  /** 关键词文本 */
  keywordText: string;
  /** 类型：combo / negative / fuzzy */
  keywordType: string;
  /** 分类：core / related / block */
  keywordCategory: string;
  /** 组合表达式原文（仅 combo） */
  comboExpression?: string;
  /** 备注 */
  remark?: string;
  /** 原文行号 */
  lineNo?: number;
  /** 组合表达式组数 */
  groupCount?: number;
  /** 组合表达式总词数 */
  wordCount?: number;
  /** 检索词组（真正发起检索的词） */
  searchTerms?: string[];
  /** 是否来自表达式内联排除 */
  inlineExclude?: boolean;
  /** 是否因重复被跳过 */
  duplicate?: boolean;
}

/** 导入解析 / 入库结果 */
export interface KeywordImportResult {
  items: KeywordImportItem[];
  errors: string[];
  warnings: string[];
  duplicates: string[];
  totalLines: number;
  comboCount: number;
  negativeCount: number;
  plainCount: number;
  duplicateCount: number;
  inlineExcludeCount: number;
  searchTermCount: number;
  insertedKeywords: number;
  reusedKeywords: number;
  boundRelations: number;
  skippedRelations: number;
  groupId?: number;
  committed: boolean;
}

/** 导入请求 */
export interface KeywordImportForm {
  /** 词表原文 */
  text: string;
  /** 绑定监测任务ID，可为空 */
  taskId?: number | null;
  /** 关键词分组ID，可为空 */
  groupId?: number | null;
  /** 分组名称（groupId 为空时生效） */
  groupName?: string | null;
  /** 任务级匹配策略：strict / loose / off */
  matchStrategy?: string | null;
}

/**
 * 解析预览（不入库）
 */
export const parseKeywordImport = (data: KeywordImportForm): AxiosPromise<KeywordImportResult> => {
  return request({
    url: '/yuqing/keyword/import/parse',
    method: 'post',
    data
  });
};

/**
 * 解析并入库
 */
export const commitKeywordImport = (data: KeywordImportForm): AxiosPromise<KeywordImportResult> => {
  return request({
    url: '/yuqing/keyword/import/commit',
    method: 'post',
    data
  });
};

/**
 * 组合表达式语法校验（F-002 验收标准 3）
 * 返回带列位置的错误说明；空数组表示合法。
 */
export const validateKeywordExpression = (expression: string): AxiosPromise<string[]> => {
  return request({
    url: '/yuqing/collect/keyword/validate',
    method: 'get',
    params: { expression }
  });
};
