#!/usr/bin/env node
/**
 * 若依代码生成器 - RuoYi-Vue-Plus v6.0.0 适配版
 * 从 specs/spec.md 解析功能点，生成 CRUD 五件套 + 建表 SQL + 前端
 *
 * 用法: node gen-ruoyi.mjs [spec路径] [输出目录]
 *   默认: node gen-ruoyi.mjs ./specs/spec.md ./ruoyi-code
 *   示例（v6 工程）:
 *     node gen-ruoyi.mjs ./specs/spec.md "D:/APPPROJECTS/RuoYi-Vue-Plus-v6.0.0/ruoyi-admin/src/main/java"
 *
 * v6 规范: org.dromara 包 | Sa-Token @SaCheckPermission | Lombok | R/PageResult/PageQuery
 *         | BaseMapperPlus | LocalDateTime | jakarta.validation | ExcelBuilder
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = process.cwd();

const SPEC = process.argv[2] ? path.resolve(projectRoot, process.argv[2])
  : path.join(projectRoot, 'specs', 'spec.md');
const OUT = process.argv[3] ? path.resolve(projectRoot, process.argv[3])
  : path.join(projectRoot, 'ruoyi-code');

const PACKAGE = 'org.dromara.bdrm';

/* ---------- 工具函数 ---------- */

/** 中文名 -> 英文模块名 */
function toModuleName(feature) {
  const slugMap = {
    'agent-register': 'bdrm-agent',
    'heartbeat-task': 'bdrm-heartbeat',
    'task-ack-result': 'bdrm-task',
    'report-metrics': 'bdrm-report',
    'db-schema': 'bdrm-schema',
    'health-job': 'bdrm-healthjob',
    'config-manage': 'bdrm-config',
    'sse-push': 'bdrm-sse',
    'task-dispatch': 'bdrm-dispatch',
    'admin-ui': 'bdrm-page'
  };
  if (feature && feature.slug && slugMap[feature.slug]) return slugMap[feature.slug];
  const title = typeof feature === 'string' ? feature : (feature && feature.title) || '';
  const map = {
    '预售商品管理': 'presale-goods',
    '定金支付': 'presale-deposit',
    '尾款支付': 'presale-tail-pay',
    '预售订单管理': 'presale-order',
    '商品管理': 'goods',
    '订单管理': 'order',
    '直播间管理': 'live-room',
    '优惠券营销': 'coupon'
  };
  if (map[title]) return map[title];
  return title.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/-+/g, '-');
}

/** 英文模块名 -> 实体类名 */
function toClassName(moduleName) {
  return moduleName.split('-').filter(Boolean)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

/** camelCase -> snake_case */
function snakeCase(name) {
  return name.replace(/([A-Z])/g, '_$1').toLowerCase();
}

/** 字段名 -> getter 名 */
function toGetter(fieldName) {
  return 'get' + fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
}

/** 解析 spec.md 的功能点 */
function parseSpec() {
  const content = fs.readFileSync(SPEC, 'utf-8');
  const lines = content.split('\n');
  const features = [];
  let current = null;
  let inApiTable = false;

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+?)\s*\|\s*([\w-]+)\s*$/);
    if (h2) {
      if (current) features.push(current);
      current = { title: h2[1].trim(), slug: h2[2], apis: [], criteria: [] };
      inApiTable = false;
      continue;
    }
    if (!current) continue;

    if (/^####\s*接口定义/i.test(line)) { inApiTable = true; continue; }
    if (/^####\s*验收标准/i.test(line)) { inApiTable = false; continue; }
    if (inApiTable) {
      const row = line.match(/^\|\s*(\w+)\s*\|\s*([^|]+)\|\s*([^|]*)\|/);
      if (row && row[1] !== '方法') {
        current.apis.push({ method: row[1].trim().toUpperCase(), path: row[2].trim(), desc: row[3].trim() });
      }
    }
    if (/^-\s+(.+)$/.test(line) && !inApiTable && !line.startsWith('|')) {
      current.criteria.push(line.replace(/^-\s+/, '').trim());
    }
  }
  if (current) features.push(current);
  return features;
}

/* ---------- 业务字段定义（按 PRD 数据字典） ---------- */

const FIELD_MAP = {
  'presale-goods': [
    { name: 'title', javaType: 'String', sqlType: 'VARCHAR(100)', comment: '商品标题', excel: true },
    { name: 'price', javaType: 'BigDecimal', sqlType: 'DECIMAL(10,2)', comment: '售价', excel: true },
    { name: 'depositAmount', javaType: 'BigDecimal', sqlType: 'DECIMAL(10,2)', comment: '定金金额', excel: true },
    { name: 'tailAmount', javaType: 'BigDecimal', sqlType: 'DECIMAL(10,2)', comment: '尾款金额', excel: true },
    { name: 'presaleEndTime', javaType: 'LocalDateTime', sqlType: 'DATETIME', comment: '预售截止时间', excel: true },
    { name: 'limitQuantity', javaType: 'Integer', sqlType: 'INT', comment: '限购数量', excel: true },
    { name: 'stock', javaType: 'Integer', sqlType: 'INT', comment: '库存', excel: true }
  ],
  'presale-deposit': [
    { name: 'orderNo', javaType: 'String', sqlType: 'VARCHAR(32)', comment: '订单号', excel: true },
    { name: 'goodsId', javaType: 'Long', sqlType: 'BIGINT', comment: '商品ID' },
    { name: 'buyerId', javaType: 'Long', sqlType: 'BIGINT', comment: '买家ID' },
    { name: 'depositAmount', javaType: 'BigDecimal', sqlType: 'DECIMAL(10,2)', comment: '定金金额', excel: true },
    { name: 'payTime', javaType: 'LocalDateTime', sqlType: 'DATETIME', comment: '支付时间', excel: true }
  ],
  'presale-tail-pay': [
    { name: 'orderNo', javaType: 'String', sqlType: 'VARCHAR(32)', comment: '订单号', excel: true },
    { name: 'goodsId', javaType: 'Long', sqlType: 'BIGINT', comment: '商品ID' },
    { name: 'buyerId', javaType: 'Long', sqlType: 'BIGINT', comment: '买家ID' },
    { name: 'tailAmount', javaType: 'BigDecimal', sqlType: 'DECIMAL(10,2)', comment: '尾款金额', excel: true },
    { name: 'payTime', javaType: 'LocalDateTime', sqlType: 'DATETIME', comment: '支付时间', excel: true }
  ],
  'presale-order': [
    { name: 'orderNo', javaType: 'String', sqlType: 'VARCHAR(32)', comment: '订单号', excel: true },
    { name: 'goodsId', javaType: 'Long', sqlType: 'BIGINT', comment: '商品ID' },
    { name: 'goodsTitle', javaType: 'String', sqlType: 'VARCHAR(100)', comment: '商品标题', excel: true },
    { name: 'buyerId', javaType: 'Long', sqlType: 'BIGINT', comment: '买家ID' },
    { name: 'depositAmount', javaType: 'BigDecimal', sqlType: 'DECIMAL(10,2)', comment: '定金金额', excel: true },
    { name: 'tailAmount', javaType: 'BigDecimal', sqlType: 'DECIMAL(10,2)', comment: '尾款金额', excel: true },
    { name: 'totalAmount', javaType: 'BigDecimal', sqlType: 'DECIMAL(10,2)', comment: '总金额', excel: true },
    { name: 'shippingNo', javaType: 'String', sqlType: 'VARCHAR(64)', comment: '物流单号' },
    { name: 'payTime', javaType: 'LocalDateTime', sqlType: 'DATETIME', comment: '支付时间', excel: true }
  ]
};

/* ---------- Java 代码生成（RuoYi-Vue-Plus v6 规范） ---------- */

function genDomain(entityName, moduleName, feature) {
  const fields = FIELD_MAP[moduleName] || [];
  const needBigDecimal = fields.some(f => f.javaType === 'BigDecimal');
  const fieldDecls = fields.map(f => {
    const excelAnno = f.excel ? `    @ExcelProperty(value = "${f.comment}")\n` : '';
    return `${excelAnno}    /** ${f.comment} */\n    private ${f.javaType} ${f.name};`;
  }).join('\n\n');

  return `package ${PACKAGE}.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.common.mybatis.core.domain.BaseEntity;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
${needBigDecimal ? 'import java.math.BigDecimal;\n' : ''}import java.time.LocalDateTime;
import java.io.Serial;

/**
 * ${feature.title}对象 ${moduleName}
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("${moduleName.replace(/-/g, '_')}")
@ExcelIgnoreUnannotated
public class ${entityName} extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 主键 */
    @TableId
    private Long id;

${fieldDecls}

    /** 状态（0正常 1停用 / 业务状态机） */
    private String status;
}
`;
}

function genMapper(entityName, moduleName) {
  return `package ${PACKAGE}.mapper;

import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import ${PACKAGE}.domain.${entityName};

/**
 * ${moduleName} Mapper接口
 *
 * @author ruoyi
 */
public interface ${entityName}Mapper extends BaseMapperPlus<${entityName}, ${entityName}> {
}
`;
}

function genService(entityName, moduleName) {
  const varName = moduleName.replace(/-/g, '');
  return `package ${PACKAGE}.service;

import org.dromara.common.core.domain.PageResult;
import org.dromara.common.mybatis.core.page.PageQuery;
import ${PACKAGE}.domain.${entityName};

import java.util.Collection;
import java.util.List;

/**
 * ${moduleName} Service接口
 *
 * @author ruoyi
 */
public interface I${entityName}Service {

    /**
     * 分页查询${moduleName}列表
     */
    PageResult<${entityName}> queryPageList(${entityName} bo, PageQuery pageQuery);

    /**
     * 查询${moduleName}列表（不分页）
     */
    List<${entityName}> queryList(${entityName} bo);

    /**
     * 查询${moduleName}详情
     */
    ${entityName} queryById(Long id);

    /**
     * 新增${moduleName}
     */
    Boolean insertByBo(${entityName} bo);

    /**
     * 修改${moduleName}
     */
    Boolean updateByBo(${entityName} bo);

    /**
     * 批量删除${moduleName}
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
`;
}

function genServiceImpl(entityName, moduleName) {
  const varName = moduleName.replace(/-/g, '');
  const fields = FIELD_MAP[moduleName] || [];
  const stringFields = fields.filter(f => f.javaType === 'String').slice(0, 3);
  const eqClauses = stringFields.map((f, i) =>
    `        lqw.eq(StringUtils.isNotBlank(bo.${toGetter(f.name)}()), ${entityName}::${toGetter(f.name)}, bo.${toGetter(f.name)}());`
  ).join('\n');

  return `package ${PACKAGE}.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.common.mybatis.core.page.PageQuery;
import ${PACKAGE}.domain.${entityName};
import ${PACKAGE}.mapper.${entityName}Mapper;
import ${PACKAGE}.service.I${entityName}Service;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;

/**
 * ${moduleName} Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class ${entityName}ServiceImpl implements I${entityName}Service {

    private final ${entityName}Mapper baseMapper;

    @Override
    public PageResult<${entityName}> queryPageList(${entityName} bo, PageQuery pageQuery) {
        LambdaQueryWrapper<${entityName}> lqw = new LambdaQueryWrapper<>();
${eqClauses || '        // TODO: 按业务字段补充查询条件'}
        Page<${entityName}> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<${entityName}> queryList(${entityName} bo) {
        LambdaQueryWrapper<${entityName}> lqw = new LambdaQueryWrapper<>();
${eqClauses || '        // TODO: 按业务字段补充查询条件'}
        return baseMapper.selectList(lqw);
    }

    @Override
    public ${entityName} queryById(Long id) {
        return baseMapper.selectById(id);
    }

    @Override
    public Boolean insertByBo(${entityName} bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(${entityName} bo) {
        return baseMapper.updateById(bo) > 0;
    }

    @Override
    public Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid) {
        if (Boolean.TRUE.equals(isValid)) {
            // TODO: 删除前业务校验（如订单有关联记录时禁止删除）
        }
        return baseMapper.deleteByIds(ids) > 0;
    }
}
`;
}

function genController(entityName, moduleName, feature) {
  const varName = moduleName.replace(/-/g, '');
  const permPrefix = moduleName.replace(/-/g, ':');
  const basePath = '/' + moduleName.replace(/-/g, '/');

  return `package ${PACKAGE}.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.domain.R;
import org.dromara.common.excel.utils.ExcelBuilder;
import org.dromara.common.log.annotation.Log;
import org.dromara.common.log.enums.BusinessType;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.web.core.BaseController;
import ${PACKAGE}.domain.${entityName};
import ${PACKAGE}.service.I${entityName}Service;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * ${feature.title}Controller
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("${basePath}")
public class ${entityName}Controller extends BaseController {

    private final I${entityName}Service ${varName}Service;

    /**
     * 分页查询${feature.title}列表
     */
    @SaCheckPermission("${permPrefix}:list")
    @GetMapping("/list")
    public R<PageResult<${entityName}>> list(${entityName} bo, PageQuery pageQuery) {
        return R.ok(${varName}Service.queryPageList(bo, pageQuery));
    }

    /**
     * 导出${feature.title}列表
     */
    @SaCheckPermission("${permPrefix}:export")
    @Log(title = "${feature.title}", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(${entityName} bo, HttpServletResponse response) {
        List<${entityName}> list = ${varName}Service.queryList(bo);
        ExcelBuilder.of(list, ${entityName}.class).sheetName("${feature.title}").toResponse(response);
    }

    /**
     * 获取${feature.title}详细信息
     */
    @SaCheckPermission("${permPrefix}:query")
    @GetMapping("/{id}")
    public R<${entityName}> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long id) {
        return R.ok(${varName}Service.queryById(id));
    }

    /**
     * 新增${feature.title}
     */
    @SaCheckPermission("${permPrefix}:add")
    @Log(title = "${feature.title}", businessType = BusinessType.INSERT)
    @PostMapping()
    public R<Void> add(@Validated @RequestBody ${entityName} bo) {
        return toAjax(${varName}Service.insertByBo(bo));
    }

    /**
     * 修改${feature.title}
     */
    @SaCheckPermission("${permPrefix}:edit")
    @Log(title = "${feature.title}", businessType = BusinessType.UPDATE)
    @PutMapping()
    public R<Void> edit(@Validated @RequestBody ${entityName} bo) {
        return toAjax(${varName}Service.updateByBo(bo));
    }

    /**
     * 删除${feature.title}
     */
    @SaCheckPermission("${permPrefix}:remove")
    @Log(title = "${feature.title}", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ids}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空") @PathVariable Long[] ids) {
        return toAjax(${varName}Service.deleteWithValidByIds(List.of(ids), true));
    }
}
`;
}

function genSql(tableName, moduleName, feature) {
  const fields = FIELD_MAP[moduleName] || [];
  const fieldCols = fields.map(f => {
    const notNull = f.name === 'orderNo' || f.name === 'title' ? ' NOT NULL' : '';
    return `  ${snakeCase(f.name)}        ${f.sqlType}${notNull} COMMENT '${f.comment}'`;
  }).join(',\n');

  return `-- ${feature.title}建表语句（RuoYi-Vue-Plus v6，BaseEntity 审计字段）
DROP TABLE IF EXISTS ${tableName};
CREATE TABLE ${tableName} (
  id            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
${fieldCols},
  status        VARCHAR(20)  DEFAULT '0' COMMENT '状态（订单类: pending_tail/paid/shipped/closed/refunded；通用: 0正常 1停用）',
  create_dept   BIGINT       DEFAULT NULL COMMENT '创建部门',
  create_by     BIGINT       DEFAULT NULL COMMENT '创建人',
  create_time   DATETIME     DEFAULT NULL COMMENT '创建时间',
  update_by     BIGINT       DEFAULT NULL COMMENT '更新人',
  update_time   DATETIME     DEFAULT NULL COMMENT '更新时间',
  remark        VARCHAR(500) DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (id)
) ENGINE=InnoDB AUTO_INCREMENT=1 COMMENT='${feature.title}';
`;
}

/* ---------- 前端 Vue 生成（RuoYi-Vue-Plus v6 前端规范：TS + AxiosPromise） ---------- */

/** 根据字段生成 el-form-item 控件 */
/** 按 FIELD_MAP 生成表格业务列（修复 Bug I: 列表页缺业务字段列，之前只有编号/创建时间） */
function genTableColumns(moduleName) {
  const fields = FIELD_MAP[moduleName] || [];
  return fields.map(f => {
    const label = f.comment;
    const prop = f.name;
    const width = (f.javaType === 'LocalDateTime' || f.javaType === 'BigDecimal') ? ' width="120"' : '';
    return `      <el-table-column label="${label}" align="center" prop="${prop}"${width} />`;
  }).join('\n');
}

function genFormItems(moduleName) {
  const fields = FIELD_MAP[moduleName] || [];
  return fields.map(f => {
    const label = f.comment;
    const prop = f.name;
    if (f.javaType === 'LocalDateTime') {
      return `      <el-form-item label="${label}" prop="${prop}">
        <el-date-picker v-model="form.${prop}" type="datetime" placeholder="请选择${label}" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" />
      </el-form-item>`;
    }
    if (f.javaType === 'BigDecimal') {
      return `      <el-form-item label="${label}" prop="${prop}">
        <el-input-number v-model="form.${prop}" :precision="2" :min="0" :max="9999999999" placeholder="请输入${label}" style="width: 100%" />
      </el-form-item>`;
    }
    if (f.javaType === 'Integer') {
      return `      <el-form-item label="${label}" prop="${prop}">
        <el-input-number v-model="form.${prop}" :min="0" :max="999999999" placeholder="请输入${label}" style="width: 100%" />
      </el-form-item>`;
    }
    if (f.javaType === 'Long') {
      // 修复: Long 雪花 ID(19位) 超出 JS 安全整数，el-input-number 会精度丢失，改用 el-input
      return `      <el-form-item label="${label}" prop="${prop}">
        <el-input v-model="form.${prop}" placeholder="请输入${label}" />
      </el-form-item>`;
    }
    // String
    return `      <el-form-item label="${label}" prop="${prop}">
        <el-input v-model="form.${prop}" placeholder="请输入${label}" />
      </el-form-item>`;
  }).join('\n');
}

/** 必填字段校验规则（title/orderNo 等） */
function genFormRules(moduleName) {
  const fields = FIELD_MAP[moduleName] || [];
  // 只对"用户必须填写"的字段设必填；orderNo 等由后端生成的字段不设必填
  const required = fields.filter(f => f.name === 'title');
  return required.map(f =>
    `  ${f.name}: [{ required: true, message: '${f.comment}不能为空', trigger: 'blur' }],`
  ).join('\n');
}

function genApiIndex(entityName, moduleName) {
  const basePath = '/' + moduleName.replace(/-/g, '/');
  const lower = moduleName.replace(/-/g, '');
  const Capital = entityName;
  return `import type { ${Capital}Form, ${Capital}Query, ${Capital}VO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询${Capital}列表
 * @param query
 * @returns
 */
export const list${Capital} = (query?: ${Capital}Query): AxiosPromise<PageResult<${Capital}VO>> => {
  return request({
    url: '${basePath}/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询${Capital}详细
 * @param id
 */
export const get${Capital} = (id: string | number): AxiosPromise<${Capital}VO> => {
  return request({
    url: '${basePath}/' + id,
    method: 'get'
  });
};

/**
 * 新增${Capital}
 * @param data
 */
export const add${Capital} = (data: ${Capital}Form): AxiosPromise => {
  return request({
    url: '${basePath}',
    method: 'post',
    data
  });
};

/**
 * 修改${Capital}
 * @param data
 */
export const update${Capital} = (data: ${Capital}Form): AxiosPromise => {
  return request({
    url: '${basePath}',
    method: 'put',
    data
  });
};

/**
 * 删除${Capital}
 * @param ids
 */
export const del${Capital} = (ids: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '${basePath}/' + ids,
    method: 'delete'
  });
};
`;
}

function genApiTypes(entityName, moduleName) {
  const fields = FIELD_MAP[moduleName] || [];
  const voProps = fields.map(f => {
    const tsType = { String: 'string', Long: 'number', Integer: 'number', BigDecimal: 'number', LocalDateTime: 'string' }[f.javaType] || 'string';
    return `  /** ${f.comment} */
  ${f.name}?: ${tsType};`;
  }).join('\n');

  /* ⚠ PageQuery 是 src/types/global.d.ts 里的全局环境接口，不能再从 '@/api/types' 引入（TS2305） */
  return `/**
 * ${entityName} 查询
 */
export interface ${entityName}Query extends PageQuery {
${voProps}
}

/**
 * ${entityName} 表单
 */
export interface ${entityName}Form {
  /** 主键 */
  id?: number;
${voProps}
}

/**
 * ${entityName} 视图
 */
export interface ${entityName}VO {
  /** 主键 */
  id?: number;
${voProps}
}
`;
}

function genVueIndex(entityName, moduleName, feature) {
  const varName = moduleName.replace(/-/g, '');
  const permPrefix = moduleName.replace(/-/g, ':');
  return `<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" v-hasPermi="['${permPrefix}:add']" @click="handleAdd">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" v-hasPermi="['${permPrefix}:remove']" @click="handleDelete()">删除</el-button>
      </el-col>
    </el-row>

    <el-table v-loading="loading" :data="${varName}List" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="编号" align="center" prop="id" />
${genTableColumns(moduleName)}
      <el-table-column label="创建时间" align="center" prop="createTime" width="180" />
      <el-table-column label="操作" align="center" class-name="operation-col">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" v-hasPermi="['${permPrefix}:edit']" @click="handleUpdate(scope.row)">修改</el-button>
          <el-button link type="danger" icon="Delete" v-hasPermi="['${permPrefix}:remove']" @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <el-dialog :title="title" v-model="open" width="900px" append-to-body>
      <${entityName}Form ref="${varName}FormRef" :edit-data="form" @submit="handleSubmit" />
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="${varName}FormRef?.submit()">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="${entityName}" lang="ts">
import { ref, reactive, toRefs } from 'vue';
import { to } from 'await-to-js';
import modal from '@/plugins/modal';
import type { ${entityName}Form as ${entityName}FormType, ${entityName}Query, ${entityName}VO } from '@/api/bdrm/${moduleName.replace(/-/g, '')}/types';
import { list${entityName}, get${entityName}, del${entityName}, add${entityName}, update${entityName} } from '@/api/bdrm/${moduleName.replace(/-/g, '')}/index';
import ${entityName}Form from './form.vue';

const ${varName}List = ref([])
const open = ref(false)
const loading = ref(true)
const showSearch = ref(true)
const ids = ref([])
const multiple = ref(true)
const total = ref(0)
const title = ref('')
const ${varName}FormRef = ref()
const queryRef = ref()

const data = reactive({
  form: {} as ${entityName}FormType,
  queryParams: {
    pageNum: 1,
    pageSize: 10
  } as ${entityName}Query
})

const { queryParams, form } = toRefs(data)

/** 查询${entityName}列表 */
async function getList() {
  loading.value = true
  const res = await list${entityName}(queryParams.value)
  ${varName}List.value = res.data?.rows ?? []
  total.value = res.data?.total ?? 0
  loading.value = false
}

function cancel() {
  open.value = false
  reset()
}

/** 重置操作表单 */
function reset() {
  form.value = {
    id: null
  }
}

function handleQuery() {
  queryParams.value.pageNum = 1
  getList()
}

/** 重置查询条件 */
function resetQuery() {
  queryParams.value = { pageNum: 1, pageSize: 10 } as ${entityName}Query
  queryRef.value?.resetFields()
  handleQuery()
}

function handleSelectionChange(selection) {
  ids.value = selection.map(item => item.id)
  multiple.value = !selection.length
}

function handleAdd() {
  reset()
  open.value = true
  title.value = '添加${entityName}'
}

async function handleUpdate(row: ${entityName}VO) {
  reset()
  const _id = row.id ?? ids.value[0]
  const { data } = await get${entityName}(_id)
  form.value = data
  open.value = true
  title.value = '修改${entityName}'
}

/** 子组件校验通过后回调 */
async function handleSubmit(data: ${entityName}FormType) {
  if (data.id != null) {
    await update${entityName}(data)
    modal.msgSuccess('修改成功')
  } else {
    await add${entityName}(data)
    modal.msgSuccess('新增成功')
  }
  open.value = false
  getList()
}

async function handleDelete(row?: ${entityName}VO) {
  const _ids = row?.id ?? ids.value
  const [err] = await to(modal.confirm('是否确认删除${entityName}编号为"' + _ids + '"的数据项？') as any)
  if (err) return
  await del${entityName}(_ids)
  getList()
  modal.msgSuccess('删除成功')
}

getList()
</script>
`;
}

function genVueForm(entityName, moduleName, feature) {
  const varName = moduleName.replace(/-/g, '');
  return `<template>
  <el-form ref="${varName}Ref" :model="form" :rules="rules" label-width="90px">
${genFormItems(moduleName)}
  </el-form>
</template>

<script setup name="${entityName}Form" lang="ts">
import { ref, watch } from 'vue';
import type { ${entityName}Form } from '@/api/bdrm/${moduleName.replace(/-/g, '')}/types';

const props = defineProps<{
  // 父组件传入的编辑数据
  editData?: ${entityName}Form | null;
}>();

const emit = defineEmits<{ submit: [data: ${entityName}Form] }>();

const ${varName}Ref = ref()
const form = ref<${entityName}Form>({ id: undefined })

const rules = {
${genFormRules(moduleName)}
}

watch(
  () => props.editData,
  (val) => {
    if (val) {
      form.value = { ...val }
    }
  },
  { immediate: true }
)

/** 提交表单 */
function submit() {
  ${varName}Ref.value?.validate((valid: boolean) => {
    if (valid) {
      emit('submit', form.value)
    }
  })
}

defineExpose({ submit, form })
</script>
`;
}

/* ---------- 主流程 ---------- */

function main() {
  if (!fs.existsSync(SPEC)) {
    console.error(`✗ 规格文件不存在: ${SPEC}\n  用法: node gen-ruoyi.mjs [spec路径] [输出目录]`);
    process.exit(1);
  }

  const features = parseSpec();
  if (features.length === 0) {
    console.error('✗ 未解析到功能点（检查 spec.md 是否含 ## 功能点标题）');
    process.exit(1);
  }

  console.log(`\n🔨 若依代码生成器（RuoYi-Vue-Plus v6 适配）\n  规格: ${SPEC}\n  输出: ${OUT}\n`);

  const JAVA_BASE = path.join(OUT, PACKAGE.replace(/\./g, '/'));
  const SQL_DIR = path.join(OUT, 'sql');
  const UI_OUT = process.argv[4] ? path.resolve(projectRoot, process.argv[4]) : null;

  for (const feature of features) {
    const moduleName = toModuleName(feature);
    const entityName = toClassName(moduleName);
    const tableName = moduleName.replace(/-/g, '_');

    const files = {
      [`${JAVA_BASE}/domain/${entityName}.java`]: genDomain(entityName, moduleName, feature),
      [`${JAVA_BASE}/mapper/${entityName}Mapper.java`]: genMapper(entityName, moduleName),
      [`${JAVA_BASE}/service/I${entityName}Service.java`]: genService(entityName, moduleName),
      [`${JAVA_BASE}/service/impl/${entityName}ServiceImpl.java`]: genServiceImpl(entityName, moduleName),
      [`${JAVA_BASE}/controller/${entityName}Controller.java`]: genController(entityName, moduleName, feature),
      [`${SQL_DIR}/${tableName}.sql`]: genSql(tableName, moduleName, feature)
    };

    // 前端输出（可选第 4 参数指定前端工程 src 目录）
    if (UI_OUT) {
      files[`${UI_OUT}/api/bdrm/${moduleName.replace(/-/g, '')}/index.ts`] = genApiIndex(entityName, moduleName);
      files[`${UI_OUT}/api/bdrm/${moduleName.replace(/-/g, '')}/types.ts`] = genApiTypes(entityName, moduleName);
      files[`${UI_OUT}/views/bdrm/${moduleName.replace(/-/g, '')}/index.vue`] = genVueIndex(entityName, moduleName, feature);
      files[`${UI_OUT}/views/bdrm/${moduleName.replace(/-/g, '')}/form.vue`] = genVueForm(entityName, moduleName, feature);
    }

    for (const [filePath, content] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, 'utf-8');
    }

    console.log(`  ✓ ${entityName}（${feature.title}）`);
  }

  console.log(`\n✅ 生成完成，共 ${features.length} 个功能点`);
  console.log(`   Java: ${OUT}/${PACKAGE.replace(/\./g, '/')}/`);
  console.log(`   SQL:  ${OUT}/sql/`);
  if (UI_OUT) console.log(`   前端: ${UI_OUT}/api/bdrm/ + ${UI_OUT}/views/bdrm/`);
  console.log('\n⚠ v6 规范说明: @SaCheckPermission 权限 / R+PageResult / BaseMapperPlus / Lombok');
  console.log('   实体使用 LocalDateTime，基类 BaseEntity 含 createBy/createTime 等审计字段');
  console.log('   用法: node gen-ruoyi.mjs <spec> <后端java目录> [前端src目录]');
  console.log('   业务逻辑（幂等/库存/状态机）需按验收标准在 ServiceImpl 中补充');
}

main();
