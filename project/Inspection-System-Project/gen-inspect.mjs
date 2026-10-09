#!/usr/bin/env node
/**
 * 机房巡检系统代码生成器 —— RuoYi-Vue-Plus v6.0.0 适配版
 *
 * 数据来源（权威）：
 *   - PRD 5.2 数据字典  -> TABLES（表/字段/类型/注释）
 *   - PRD 6.3 API 约定  -> 各模块端点与权限标识
 *   - PRD 7.2 菜单规范  -> sys_menu 22 列
 *
 * 用法:
 *   node gen-inspect.mjs <spec路径> <输出目录>
 *   默认: node gen-inspect.mjs ./specs/spec.md ./inspect-code
 *
 * 输出结构:
 *   <OUT>/java/org/dromara/inspect/{domain,mapper,service,service/impl,controller}/
 *   <OUT>/sql/{insp_schema.sql,insp_menu.sql,insp_dict.sql}
 *   <OUT>/pc/{api/inspect/**,views/inspect/**}
 *   <OUT>/h5/api/inspect/**
 *
 * v6 规范: org.dromara 包 | Sa-Token @SaCheckPermission | Lombok | R/PageResult/PageQuery
 *         | BaseMapperPlus | LocalDateTime | jakarta.validation | Fesod Excel
 */
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd();
const SPEC = process.argv[2]
  ? path.resolve(PROJECT_ROOT, process.argv[2])
  : path.join(PROJECT_ROOT, 'specs', 'spec.md');
const OUT = process.argv[3]
  ? path.resolve(PROJECT_ROOT, process.argv[3])
  : path.join(PROJECT_ROOT, 'inspect-code');

const PACKAGE = 'org.dromara.inspect';
const JAVA_BASE = path.join(OUT, 'java', PACKAGE.replace(/\./g, '/'));

/* ============================================================
 * 1. 表定义 —— 严格照 PRD 5.2 数据字典
 *    type: 见 PRD 5.4 类型映射约定
 *    ctrl: 是否由生成器产出通用 CRUD Controller（复杂模块留给手写）
 * ============================================================ */
const S = (name, column, comment, extra = {}) => ({ name, column, javaType: 'String', sqlType: 'VARCHAR(255)', comment, ...extra });
const L = (name, column, comment, extra = {}) => ({ name, column, javaType: 'Long', sqlType: 'BIGINT', comment, ...extra });
const I = (name, column, comment, extra = {}) => ({ name, column, javaType: 'Integer', sqlType: 'INT', comment, ...extra });
const D = (name, column, comment, extra = {}) => ({ name, column, javaType: 'LocalDateTime', sqlType: 'DATETIME', comment, ...extra });
const DT = (name, column, comment, extra = {}) => ({ name, column, javaType: 'LocalDate', sqlType: 'DATE', comment, ...extra });
const N = (name, column, comment, extra = {}) => ({ name, column, javaType: 'BigDecimal', sqlType: 'DECIMAL(5,2)', comment, ...extra });
const C1 = (name, column, comment, extra = {}) => ({ name, column, javaType: 'String', sqlType: 'CHAR(1)', comment, ...extra });

const TABLES = [
  {
    key: 'room', entity: 'InspectRoom', table: 'insp_room', title: '机房',
    pk: 'roomId', pkColumn: 'room_id', perm: 'inspect:room', basePath: '/inspect/room',
    ctrl: true, pcPage: true, logicDelete: 'delFlag',
    fields: [
      S('roomName', 'room_name', '机房名称', { sqlType: 'VARCHAR(50)', required: true, excel: true }),
      S('roomCode', 'room_code', '机房编码', { sqlType: 'VARCHAR(30)', required: true, excel: true }),
      S('address', 'address', '机房地址', { sqlType: 'VARCHAR(200)', required: true, excel: true }),
      S('managerName', 'manager_name', '负责人姓名', { sqlType: 'VARCHAR(50)', required: true, excel: true }),
      S('managerPhone', 'manager_phone', '负责人电话', { sqlType: 'VARCHAR(11)', required: true, excel: true }),
      C1('status', 'status', '状态', { dict: 'sys_normal_disable', default: '0' }),
      S('remark', 'remark', '备注', { sqlType: 'VARCHAR(500)' }),
      C1('delFlag', 'del_flag', '删除标志（0存在 2删除）', { hidden: true, default: '0' }),
    ],
  },
  {
    key: 'area', entity: 'InspectArea', table: 'insp_area', title: '区域',
    pk: 'areaId', pkColumn: 'area_id', perm: 'inspect:area', basePath: '/inspect/area',
    ctrl: true, pcPage: true, logicDelete: 'delFlag',
    fields: [
      L('roomId', 'room_id', '所属机房ID', { required: true, foreign: 'room', refName: 'roomName' }),
      L('parentId', 'parent_id', '父区域ID（顶级为0）', { foreign: 'area', refName: 'parentName', refZeroLabel: '顶级' }),
      S('areaName', 'area_name', '区域名称', { sqlType: 'VARCHAR(50)', required: true, excel: true }),
      I('orderNum', 'order_num', '显示顺序', { sqlType: 'INT' }),
      C1('status', 'status', '状态', { dict: 'sys_normal_disable', default: '0' }),
      S('remark', 'remark', '备注', { sqlType: 'VARCHAR(500)' }),
      C1('delFlag', 'del_flag', '删除标志（0存在 2删除）', { hidden: true, default: '0' }),
    ],
    virtual: [
      S('roomName', null, '机房名称', { virtual: true }),
      S('parentName', null, '父区域名称', { virtual: true }),
    ],
  },
  {
    key: 'point', entity: 'InspectPoint', table: 'insp_point', title: '点位',
    pk: 'pointId', pkColumn: 'point_id', perm: 'inspect:point', basePath: '/inspect/point',
    ctrl: false, logicDelete: 'delFlag', h5Handwritten: true, // 端点复杂（二维码/导入），Controller 手写；H5 API 含 myInspectPointList 手写
    fields: [
      L('roomId', 'room_id', '所属机房ID', { required: true, foreign: 'room', refName: 'roomName' }),
      L('areaId', 'area_id', '所属区域ID', { foreign: 'area', refName: 'areaName' }),
      S('pointName', 'point_name', '点位名称', { sqlType: 'VARCHAR(100)', required: true, excel: true }),
      S('pointCode', 'point_code', '点位编码', { sqlType: 'VARCHAR(50)', required: true, excel: true }),
      S('location', 'location', '位置描述', { sqlType: 'VARCHAR(200)', excel: true }),
      S('cycleType', 'cycle_type', '巡检周期类型', { sqlType: 'VARCHAR(20)', required: true, dict: 'sys_inspect_cycle', excel: true }),
      I('cycleValue', 'cycle_value', '自定义间隔天数', { sqlType: 'INT' }),
      C1('gpsEnabled', 'gps_enabled', 'GPS校验（0关 1开）'),
      D('lastInspectTime', 'last_inspect_time', '上次巡检时间', { excel: true }),
      S('status', 'status', '点位状态', { sqlType: 'VARCHAR(20)', dict: 'sys_point_status', default: 'active', excel: true }),
      S('remark', 'remark', '备注', { sqlType: 'VARCHAR(500)' }),
      C1('delFlag', 'del_flag', '删除标志（0存在 2删除）', { hidden: true, default: '0' }),
    ],
    virtual: [
      S('roomName', null, '机房名称', { virtual: true }),
      S('areaName', null, '区域名称', { virtual: true }),
      { name: 'itemList', javaType: 'List<InspectPointItem>', comment: '巡检项清单', virtual: true },
    ],
  },
  {
    key: 'pointItem', entity: 'InspectPointItem', table: 'insp_point_item', title: '点位巡检项',
    pk: 'itemId', pkColumn: 'item_id', perm: 'inspect:point', basePath: '/inspect/pointItem',
    ctrl: false, pcPage: false, logicDelete: 'delFlag', // 由点位子表格维护
    fields: [
      L('pointId', 'point_id', '所属点位ID', { required: true, foreign: 'point' }),
      S('itemName', 'item_name', '巡检项名称', { sqlType: 'VARCHAR(100)', required: true, excel: true }),
      S('itemType', 'item_type', '巡检项类型', { sqlType: 'VARCHAR(20)', required: true, dict: 'sys_item_type' }),
      S('standard', 'standard', '判定标准', { sqlType: 'VARCHAR(200)', excel: true }),
      C1('required', 'required', '是否必填（0否 1是）', { default: '1' }),
      I('orderNum', 'order_num', '显示顺序', { sqlType: 'INT' }),
      L('templateId', 'template_id', '来源模板ID'),
      S('remark', 'remark', '备注', { sqlType: 'VARCHAR(500)' }),
      C1('delFlag', 'del_flag', '删除标志（0存在 2删除）', { hidden: true, default: '0' }),
    ],
    virtual: [],
  },
  {
    key: 'itemTemplate', entity: 'InspectItemTemplate', table: 'insp_item_template', title: '巡检项模板',
    pk: 'templateId', pkColumn: 'template_id', perm: 'inspect:itemTemplate', basePath: '/inspect/itemTemplate',
    ctrl: true, pcPage: true, logicDelete: 'delFlag',
    // 主子表：模板必须能录入「巡检项明细」，否则点位管理「从模板导入」永远是空清单
    detail: { key: 'itemTemplateDetail', foreignField: 'templateId', listField: 'detailList' },
    fields: [
      S('templateName', 'template_name', '模板名称', { sqlType: 'VARCHAR(50)', required: true, excel: true }),
      S('description', 'description', '模板说明', { sqlType: 'VARCHAR(200)', excel: true }),
      S('remark', 'remark', '备注', { sqlType: 'VARCHAR(500)' }),
      C1('delFlag', 'del_flag', '删除标志（0存在 2删除）', { hidden: true, default: '0' }),
    ],
    virtual: [{ name: 'detailList', javaType: 'List<InspectItemTemplateDetail>', comment: '模板明细', virtual: true }],
  },
  {
    key: 'itemTemplateDetail', entity: 'InspectItemTemplateDetail', table: 'insp_item_template_detail', title: '模板明细',
    pk: 'detailId', pkColumn: 'detail_id', perm: 'inspect:itemTemplate', basePath: '/inspect/itemTemplateDetail',
    ctrl: false, pcPage: false, logicDelete: null, // 由模板子表格维护
    fields: [
      L('templateId', 'template_id', '所属模板ID', { required: true, foreign: 'itemTemplate' }),
      S('itemName', 'item_name', '巡检项名称', { sqlType: 'VARCHAR(100)', required: true, excel: true }),
      S('itemType', 'item_type', '巡检项类型', { sqlType: 'VARCHAR(20)', required: true, dict: 'sys_item_type' }),
      S('standard', 'standard', '判定标准', { sqlType: 'VARCHAR(200)', excel: true }),
      C1('required', 'required', '是否必填（0否 1是）', { default: '1' }),
      I('orderNum', 'order_num', '显示顺序', { sqlType: 'INT' }),
    ],
    virtual: [],
  },
  {
    key: 'record', entity: 'InspectRecord', table: 'insp_record', title: '巡检记录',
    pk: 'recordId', pkColumn: 'record_id', perm: 'inspect:record', basePath: '/inspect/record',
    // queryParams：需要 beginTime/endTime 范围查询，实体需自带 params 容器（v6 BaseEntity 无此字段）
    ctrl: false, logicDelete: 'delFlag', queryParams: true, h5Handwritten: true, svcHandwritten: true, // 含提交/补录/导出，Controller 手写；Service(Ext) 手写并自行回填 pointName/roomName/inspectorName
    fields: [
      L('pointId', 'point_id', '点位ID', { required: true, foreign: 'point' }),
      L('roomId', 'room_id', '机房ID', { required: true, foreign: 'room' }),
      L('inspectorId', 'inspector_id', '巡检员用户ID', { required: true, foreign: 'user' }),
      D('inspectTime', 'inspect_time', '巡检时间', { required: true, excel: true }),
      I('duration', 'duration', '耗时（秒）', { sqlType: 'INT' }),
      S('result', 'result', '巡检结果', { sqlType: 'VARCHAR(20)', required: true, dict: 'sys_inspect_result', excel: true }),
      I('abnormalCount', 'abnormal_count', '异常项数量', { sqlType: 'INT' }),
      S('source', 'source', '数据来源', { sqlType: 'VARCHAR(20)', required: true, dict: 'sys_inspect_source', excel: true }),
      S('remark', 'remark', '整体备注', { sqlType: 'VARCHAR(500)' }),
      S('adminRemark', 'admin_remark', '管理员追加备注', { sqlType: 'VARCHAR(500)' }),
      C1('delFlag', 'del_flag', '删除标志（审计要求：不可删）', { hidden: true, default: '0' }),
    ],
    virtual: [
      S('pointName', null, '点位名称', { virtual: true }),
      S('roomName', null, '机房名称', { virtual: true }),
      S('inspectorName', null, '巡检员名称', { virtual: true }),
      { name: 'itemResults', javaType: 'List<InspectRecordItem>', comment: '巡检项结果', virtual: true },
      { name: 'photos', javaType: 'List<InspectPhoto>', comment: '巡检照片', virtual: true },
    ],
  },
  {
    key: 'recordItem', entity: 'InspectRecordItem', table: 'insp_record_item', title: '巡检项结果',
    pk: 'recordItemId', pkColumn: 'record_item_id', perm: 'inspect:record', basePath: '/inspect/recordItem',
    ctrl: false, pcPage: false, logicDelete: null, // 随记录一起写入，不单独暴露
    fields: [
      L('recordId', 'record_id', '所属记录ID', { required: true, foreign: 'record' }),
      L('itemId', 'item_id', '关联点位巡检项ID', { required: true, foreign: 'pointItem' }),
      S('itemName', 'item_name', '巡检项名称（快照）', { sqlType: 'VARCHAR(100)', required: true, excel: true }),
      S('result', 'result', '判定结果', { sqlType: 'VARCHAR(20)', required: true, dict: 'sys_item_result', excel: true }),
      S('value', 'value', '填写数值', { sqlType: 'VARCHAR(50)', excel: true }),
      S('description', 'description', '异常说明', { sqlType: 'VARCHAR(500)' }),
      I('orderNum', 'order_num', '显示顺序', { sqlType: 'INT' }),
    ],
    virtual: [{ name: 'photos', javaType: 'List<InspectPhoto>', comment: '该项照片', virtual: true }],
  },
  {
    key: 'photo', entity: 'InspectPhoto', table: 'insp_photo', title: '巡检照片',
    pk: 'photoId', pkColumn: 'photo_id', perm: 'inspect:record', basePath: '/inspect/photo',
    ctrl: false, logicDelete: null, h5Handwritten: true, // 上传端点手写；H5 API uploadInspectPhoto 手写
    fields: [
      L('recordId', 'record_id', '所属记录ID', { required: true, foreign: 'record' }),
      L('recordItemId', 'record_item_id', '关联巡检项结果ID', { foreign: 'recordItem' }),
      S('originalUrl', 'original_url', '原图URL（MinIO）', { sqlType: 'VARCHAR(500)', required: true }),
      L('originalSize', 'original_size', '原图字节数'),
      S('compressedUrl', 'compressed_url', '压缩图URL（MinIO）', { sqlType: 'VARCHAR(500)', required: true }),
      L('compressedSize', 'compressed_size', '压缩图字节数'),
      S('fileName', 'file_name', '原始文件名', { sqlType: 'VARCHAR(200)' }),
    ],
    virtual: [],
  },
  {
    key: 'abnormal', entity: 'InspectAbnormal', table: 'insp_abnormal', title: '异常项',
    pk: 'abnormalId', pkColumn: 'abnormal_id', perm: 'inspect:abnormal', basePath: '/inspect/abnormal',
    ctrl: false, logicDelete: null, queryParams: true, svcHandwritten: true, // 含 /process 处理端点；Service(Ext) 手写并自行回填 pointName/roomName/itemName
    fields: [
      L('recordId', 'record_id', '所属记录ID', { required: true, foreign: 'record' }),
      L('recordItemId', 'record_item_id', '关联巡检项结果ID', { required: true, foreign: 'recordItem' }),
      L('pointId', 'point_id', '点位ID', { required: true, foreign: 'point' }),
      L('roomId', 'room_id', '机房ID', { required: true, foreign: 'room' }),
      S('status', 'status', '处理状态', { sqlType: 'VARCHAR(20)', required: true, dict: 'sys_abnormal_status', default: 'pending', excel: true }),
      S('processRemark', 'process_remark', '处理说明', { sqlType: 'VARCHAR(500)', excel: true }),
      L('processBy', 'process_by', '处理人用户ID'),
      D('processTime', 'process_time', '处理时间', { excel: true }),
    ],
    virtual: [
      S('pointName', null, '点位名称', { virtual: true, excel: true }),
      S('roomName', null, '机房名称', { virtual: true, excel: true }),
      S('itemName', null, '巡检项名称', { virtual: true, excel: true }),
      D('inspectTime', null, '巡检时间', { virtual: true, excel: true }),
      S('description', null, '异常说明', { virtual: true, excel: true }),
      { name: 'photoUrls', javaType: 'List<String>', comment: '现场照片URL', virtual: true, excel: false },
    ],
  },
  {
    key: 'statsDaily', entity: 'InspectStatsDaily', table: 'insp_stats_daily', title: '统计预聚合',
    pk: 'statsId', pkColumn: 'stats_id', perm: 'inspect:stats', basePath: '/inspect/statsDaily',
    ctrl: true, pcPage: false, logicDelete: null, audit: false, // 定时任务写入，无独立页面
    fields: [
      DT('statsDate', 'stats_date', '统计日期', { required: true, excel: true }),
      L('roomId', 'room_id', '机房ID', { required: true, foreign: 'room' }),
      L('pointId', 'point_id', '点位ID', { foreign: 'point' }),
      I('inspectCount', 'inspect_count', '巡检次数', { sqlType: 'INT' }),
      I('abnormalCount', 'abnormal_count', '异常次数', { sqlType: 'INT' }),
      I('overdueCount', 'overdue_count', '逾期数', { sqlType: 'INT' }),
      N('abnormalRate', 'abnormal_rate', '异常率(%)'),
    ],
    virtual: [],
  },
];

const BY_KEY = Object.fromEntries(TABLES.map(t => [t.key, t]));

/* ============================================================
 * 2. 工具函数
 * ============================================================ */
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const getter = (n) => 'get' + cap(n);
const toSnake = (n) => n.replace(/([A-Z])/g, '_$1').toLowerCase();
const tsType = (jt) => ({
  String: 'string', Long: 'string', Integer: 'number', BigDecimal: 'number',
  LocalDateTime: 'string', LocalDate: 'string',
}[jt] || 'string');
/** 表名 -> 权限/路径用的短名（insp_room -> room） */
const shortName = (t) => t.table.replace(/^insp_/, '');

/** 只取持久化字段 */
const pFields = (t) => t.fields.filter(f => !f.virtual && !f.hidden);
/** 持久化字段 + 关联（@TableField(exist=false)）字段 */
const allFields = (t) => [...t.fields, ...(t.virtual || [])];

/* ---------- 关联下拉（foreign）----------
 * foreign 指向另一张表的 key；这里声明「用它哪个字段做显示文本」。
 * 未登记的 key（如 'user'）无法生成可用下拉 —— 按普通输入框渲染（见 isForeignSelect）。
 * ⚠️ 只生成 el-select 而不加载选项 = 下拉永远是空的，这是必须避免的旧坑。
 */
const FOREIGN_LABEL = { room: 'roomName', area: 'areaName', point: 'pointName', itemTemplate: 'templateName' };

/** 解析 foreign 目标；返回 null 表示无法生成下拉 */
function foreignTarget(key) {
  const t = TABLES.find(x => x.key === key);
  const label = FOREIGN_LABEL[key];
  if (!t || !label) return null;
  return { key, entity: t.entity, api: `optionselect${t.entity}`, module: t.key, label, value: t.pk };
}
/** 该字段是否应渲染成「有关联数据的下拉框」 */
const isForeignSelect = (f) => !!(f.foreign && foreignTarget(f.foreign));

/* ---------- 主子表（master-detail）----------
 * 主表声明 detail 配置后：
 *   - 后端 ServiceImpl 负责明细的查询 / 覆盖式保存 / 级联删除
 *   - PC 端主表弹窗内嵌一张明细编辑表格
 * 典型：巡检项模板(insp_item_template) -> 模板明细(insp_item_template_detail)
 */
function detailTarget(t) {
  if (!t?.detail) return null;
  const sub = TABLES.find(x => x.key === t.detail.key);
  if (!sub) return null;
  return {
    ...t.detail,
    sub,
    entity: sub.entity,
    title: sub.title,
    /** 明细表格要渲染的持久化字段（去掉外键与主键） */
    fields: pFields(sub).filter(f => f.name !== t.detail.foreignField),
    keyFields: [...new Set(pFields(sub).filter(f => f.dict).map(f => f.dict))],
  };
}

/** 列表/标签展示用的属性名：外键字段优先用后端回填的名称列（roomId -> roomName） */
const fieldProp = (f) => f.refName || f.name;
/** 展示用的中文标签：外键字段去掉多余的 "ID" 后缀（"所属机房ID" -> "所属机房"） */
const fieldLabel = (f) => (f.refName ? f.comment.replace(/ID/, '') : f.comment);

/** 主键并非写在 fields 里，这里合成一个描述对象（照 PRD 5.2 数据字典的“XXID,主键”） */
const pkField = (t) => ({
  name: t.pk,
  column: t.pkColumn,
  javaType: 'Long',
  sqlType: 'BIGINT',
  comment: t.pkComment || `${t.title}ID,主键`,
  required: true,
});

/* ============================================================
 * 3. 实体 Domain
 * ============================================================ */
function genDomain(t) {
  const needBigDecimal = allFields(t).some(f => f.javaType === 'BigDecimal');
  const needDate = allFields(t).some(f => f.javaType === 'LocalDate');
  const hasList = (t.virtual || []).some(v => String(v.javaType).startsWith('List<'));

  const decls = [];
  for (const f of allFields(t)) {
    if (f.name === t.pk) continue;
    const annos = [];
    if (f.virtual) {
      annos.push('    @TableField(exist = false)');
      // 虚拟字段若参与导出（如在导出列表里带出点位/机房名称），同样需要 @ExcelProperty
      if (f.excel) annos.push(`    @ExcelProperty(value = "${f.comment}")`);
    } else if (f.name === t.logicDelete) {
      annos.push('    @TableLogic');
    } else if (f.excel) {
      annos.push(`    @ExcelProperty(value = "${f.comment}")`);
    }
    // Javadoc 必须在注解之前（Java 规范）
    decls.push([`    /** ${f.comment} */`, ...annos, `    private ${f.javaType} ${f.name};`].join('\n'));
  }

  // 请求参数容器：v6 的 BaseEntity 没有 params 字段，需要范围查询（beginTime/endTime）的
  // 实体必须自己声明，写法与 v6 内置 BO（如 SysConfigBo）保持一致。
  if (t.queryParams) {
    decls.push(
      [
        '    /**',
        '     * 扩展请求参数（beginTime / endTime 等），不映射数据库字段',
        '     */',
        '    @TableField(exist = false)',
        '    private Map<String, Object> params = new HashMap<>();',
      ].join('\n'),
    );
  }

  const imports = [
    'import com.baomidou.mybatisplus.annotation.TableId;',
    'import com.baomidou.mybatisplus.annotation.TableName;',
  ];
  if (t.logicDelete) imports.push('import com.baomidou.mybatisplus.annotation.TableLogic;');
  if (allFields(t).some(f => f.virtual) || t.queryParams) imports.push('import com.baomidou.mybatisplus.annotation.TableField;');
  imports.push('import lombok.Data;');
  if (t.audit !== false) imports.push('import lombok.EqualsAndHashCode;');
  if (t.audit !== false) {
    imports.push('import org.dromara.common.mybatis.core.domain.BaseEntity;');
  } else {
    imports.push('import java.io.Serializable;');
  }
  imports.push(
    'import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;',
    'import org.apache.fesod.sheet.annotation.ExcelProperty;',
  );
  if (needBigDecimal) imports.push('import java.math.BigDecimal;');
  imports.push('import java.time.LocalDateTime;');
  if (needDate) imports.push('import java.time.LocalDate;');
  if (t.queryParams) imports.push('import java.util.HashMap;', 'import java.util.Map;');
  if (hasList) imports.push('import java.util.List;');
  imports.push('import java.io.Serial;');

  const pk = pkField(t);
  // 审计表继承 BaseEntity；非审计表（表内没有 create_by/create_dept/update_by/update_time 列）
  // 若继承 BaseEntity，MyBatis-Plus 会拼出这些不存在的列 → Unknown column。
  // 这时也不能写 @EqualsAndHashCode(callSuper = true)：
  //   callSuper 的父类只剩 java.lang.Object，等于没写（IDEA: pointless supercall）。
  // 按 v6 惯例改为 implements Serializable，让 serialVersionUID 有意义。
  const audited = t.audit !== false;
  const extendsClause = audited ? ' extends BaseEntity' : ' implements Serializable';
  const eqAnno = audited ? '@EqualsAndHashCode(callSuper = true)\n' : '';

  return `package ${PACKAGE}.domain;

${imports.join('\n')}

/**
 * ${t.title}对象 ${t.table}
 *
 * @author ruoyi
 */
@Data
${eqAnno}@TableName("${t.table}")
@ExcelIgnoreUnannotated
public class ${t.entity}${extendsClause} {

    @Serial
    private static final long serialVersionUID = 1L;

    /** ${pk.comment} */
    @TableId(value = "${t.pkColumn}")
    private Long ${t.pk};

${decls.join('\n\n')}
}
`;
}

/* ============================================================
 * 4. Mapper
 * ============================================================ */
const genMapper = (t) => `package ${PACKAGE}.mapper;

import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import ${PACKAGE}.domain.${t.entity};

/**
 * ${t.title}Mapper接口
 *
 * @author ruoyi
 */
public interface ${t.entity}Mapper extends BaseMapperPlus<${t.entity}, ${t.entity}> {
}
`;

/* ============================================================
 * 5. Service 接口
 * ============================================================ */
function genService(t) {
  const E = t.entity;
  return `package ${PACKAGE}.service;

import ${PACKAGE}.domain.${E};
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * ${t.title}Service接口
 *
 * @author ruoyi
 */
public interface I${E}Service {

    /**
     * 分页查询${t.title}列表
     */
    PageResult<${E}> queryPageList(${E} bo, PageQuery pageQuery);

    /**
     * 查询${t.title}列表（不分页）
     */
    List<${E}> queryList(${E} bo);

    /**
     * 查询${t.title}详情
     */
    ${E} queryById(Long ${t.pk});

    /**
     * 新增${t.title}
     */
    Boolean insertByBo(${E} bo);

    /**
     * 修改${t.title}
     */
    Boolean updateByBo(${E} bo);

    /**
     * 批量删除${t.title}
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
`;
}

/* ============================================================
 * 6. ServiceImpl
 * ============================================================ */
function genServiceImpl(t) {
  const E = t.entity;
  const varName = 'baseMapper';

  // 查询条件：前 3 个"可筛选"字段（String 模糊 / 其他精确）
  const filterFields = pFields(t)
    .filter(f => tfIsFilterable(f))
    .slice(0, 6);

  const likeClauses = filterFields.filter(f => f.javaType === 'String' && !f.dict)
    .map(f => `        lqw.like(StringUtils.isNotBlank(bo.${getter(f.name)}()), ${E}::${getter(f.name)}, bo.${getter(f.name)}());`);
  const eqClauses = filterFields.filter(f => f.javaType !== 'String' || f.dict)
    .map(f => `        lqw.eq(ObjectUtil.isNotNull(bo.${getter(f.name)}()), ${E}::${getter(f.name)}, bo.${getter(f.name)}());`);
  const orderClause = `        lqw.orderByDesc(${E}::${getter(t.pk)});`;
  const conds = [...likeClauses, ...eqClauses, orderClause].join('\n');

  const needObjectUtil = eqClauses.length > 0;

  const validateBlock = t.logicDelete ? `        // TODO: 删除前业务校验（存在关联数据时拒绝删除）\n` : '';

  // --- 主子表（明细）---
  const dt = detailTarget(t);
  const dtEntity = dt ? dt.entity : '';
  const dtListField = dt ? dt.listField : '';
  const dtMapper = dt ? `${dt.key}Mapper` : '';

  // --- 关联名称回填 ---
  // 实体上的 roomName / areaName / parentName 等是 @TableField(exist=false) 虚拟字段，
  // 列表查询只返回 roomId/areaId，前端「所属机房/所属区域」列就会空白。
  // 这里按 refName 声明，批量查一次被引用表，把名称回填进虚拟字段。
  const refFields = pFields(t).filter(f => f.refName);
  const refTargets = [...new Map(refFields.map(f => [f.foreign, foreignTarget(f.foreign)])).values()];
  // 自关联（如 area.parentId -> area）复用 baseMapper 与已有 import，无需额外注入
  const extTargets = refTargets.filter(x => x.key !== t.key);
  const refImports = extTargets.length
    ? extTargets.flatMap(x => [
      `import ${PACKAGE}.domain.${x.entity};`,
      `import ${PACKAGE}.mapper.${x.entity}Mapper;`,
    ]).join('\n') + '\n'
    : '';
  const refMappers = extTargets.map(x => `\n    private final ${x.entity}Mapper ${x.key}Mapper;`).join('');

  const refFillBlocks = refFields.map(f => {
    const target = foreignTarget(f.foreign);
    const mapper = target.key === t.key ? varName : `${target.key}Mapper`;
    const setName = `set${f.refName.charAt(0).toUpperCase()}${f.refName.slice(1)}`;
    const asserter = f.refZeroLabel
      ? `            list.forEach(e -> {
                Long refId = e.${getter(f.name)}();
                e.${setName}(refId != null && refId == 0L ? "${f.refZeroLabel}" : ${f.name}NameMap.get(refId));
            });`
      : `            list.forEach(e -> e.${setName}(${f.name}NameMap.get(e.${getter(f.name)}())));`;
    return `        Set<Long> ${f.name}Set = list.stream().map(${E}::${getter(f.name)}).filter(Objects::nonNull).collect(Collectors.toSet());
        if (!${f.name}Set.isEmpty()) {
            Map<Long, String> ${f.name}NameMap = ${mapper}.selectByIds(${f.name}Set).stream()
                .collect(Collectors.toMap(${target.entity}::${getter(target.value)}, ${target.entity}::${getter(target.label)}, (a, b) -> a));
${asserter}
        }`;
  }).join('\n');

  const refMethod = refFields.length
    ? `
    /**
     * 回填关联名称（列表/详情只返回 ID 会导致前端「所属XX」列空白）
     */
    private void fillRefNames(List<${E}> list) {
        if (list == null || list.isEmpty()) {
            return;
        }
${refFillBlocks}
    }
`
    : '';

  // --- 主子表：写入/删除 + 明细私有方法 ---
  const insertBody = dt
    ? `        boolean flag = ${varName}.insert(bo) > 0;
        if (flag) {
            saveDetailList(bo);
        }
        return flag;`
    : `        return ${varName}.insert(bo) > 0;`;

  const updateBody = dt
    ? `        boolean flag = ${varName}.updateById(bo) > 0;
        if (flag) {
            // 明细整体覆盖：先清后插，否则前端删掉的行会残留在库里
            ${dtMapper}.delete(new LambdaQueryWrapper<${dtEntity}>()
                .eq(${dtEntity}::${getter(dt.foreignField)}, bo.${getter(t.pk)}()));
            saveDetailList(bo);
        }
        return flag;`
    : `        return ${varName}.updateById(bo) > 0;`;

  const deleteBody = dt
    ? `        boolean flag = ${varName}.deleteByIds(ids) > 0;
        if (flag) {
            ${dtMapper}.delete(new LambdaQueryWrapper<${dtEntity}>()
                .in(${dtEntity}::${getter(dt.foreignField)}, ids));
        }
        return flag;`
    : `        return ${varName}.deleteByIds(ids) > 0;`;

  const dtHasOrder = dt ? dt.fields.some(f => f.name === 'orderNum') : false;
  const dtMethod = dt
    ? `
    /**
     * 批量回填「${dt.title}」（列表页展示明细数量；一次 in 查询，避免 N+1）
     */
    private void fillDetailList(List<${E}> list) {
        if (list == null || list.isEmpty()) {
            return;
        }
        List<Long> ids = list.stream().map(${E}::${getter(t.pk)}).filter(Objects::nonNull).toList();
        if (ids.isEmpty()) {
            return;
        }
        Map<Long, List<${dtEntity}>> detailMap = ${dtMapper}.selectList(new LambdaQueryWrapper<${dtEntity}>()
            .in(${dtEntity}::${getter(dt.foreignField)}, ids)${dtHasOrder ? `
            .orderByAsc(${dtEntity}::getOrderNum)` : ''})
            .stream().collect(Collectors.groupingBy(${dtEntity}::${getter(dt.foreignField)}));
        list.forEach(e -> e.set${cap(dtListField)}(detailMap.getOrDefault(e.${getter(t.pk)}(), List.of())));
    }

    /**
     * 查询「${dt.title}」明细
     */
    private List<${dtEntity}> selectDetailList(Long ${t.pk}) {
        return ${dtMapper}.selectList(new LambdaQueryWrapper<${dtEntity}>()
            .eq(${dtEntity}::${getter(dt.foreignField)}, ${t.pk})${dtHasOrder ? `
            .orderByAsc(${dtEntity}::getOrderNum)` : ''});
    }

    /**
     * 保存「${dt.title}」明细（覆盖式写入）
     */
    private void saveDetailList(${E} bo) {
        List<${dtEntity}> detailList = bo.${getter(dtListField)}();
        if (detailList == null || detailList.isEmpty()) {
            return;
        }
        int order = 0;
        for (${dtEntity} d : detailList) {
            // 主键置空：交给雪花 ID 重新分配，避免前端「删掉再新增」的行按旧主键插入而冲突
            d.set${cap(dt.sub.pk)}(null);
            d.set${cap(dt.foreignField)}(bo.${getter(t.pk)}());${dtHasOrder ? `
            if (d.getOrderNum() == null) {
                d.setOrderNum(order);
            }` : ''}
            order++;
            ${dtMapper}.insert(d);
        }
    }
`
    : '';

  const needCollections = refFields.length > 0 || !!dt;
  const streamImports = refFields.length
    ? '\nimport java.util.Map;\nimport java.util.Objects;\nimport java.util.Set;\nimport java.util.stream.Collectors;'
    : (dt ? '\nimport java.util.Map;\nimport java.util.Objects;\nimport java.util.stream.Collectors;' : '');
  const pageListBody = needCollections
    ? [
      `        List<${E}> records = page.getRecords();`,
      ...(refFields.length ? ['        fillRefNames(records);'] : []),
      ...(dt ? ['        fillDetailList(records);'] : []),
      '        return PageResult.build(records, page.getTotal());',
    ].join('\n')
    : `        return PageResult.build(page.getRecords(), page.getTotal());`;

  // 详情：回填关联名称 + 带出明细（「从模板导入」依赖这里的明细返回，缺了就报「该模板下没有巡检项明细」）
  const byIdBody = (refFields.length || dt)
    ? `        ${E} e = ${varName}.selectById(${t.pk});
        if (e != null) {${refFields.length ? `
            fillRefNames(List.of(e));` : ''}${dt ? `
            e.set${cap(dtListField)}(selectDetailList(${t.pk}));` : ''}
        }
        return e;`
    : `        return ${varName}.selectById(${t.pk});`;

  return `package ${PACKAGE}.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;${needObjectUtil ? '\nimport cn.hutool.core.util.ObjectUtil;' : ''}
import org.dromara.common.mybatis.core.page.PageQuery;
import ${PACKAGE}.domain.${E};${dt ? `\nimport ${PACKAGE}.domain.${dtEntity};` : ''}
import ${PACKAGE}.mapper.${E}Mapper;${dt ? `\nimport ${PACKAGE}.mapper.${dtEntity}Mapper;` : ''}
import ${PACKAGE}.service.I${E}Service;
import org.springframework.stereotype.Service;${dt ? '\nimport org.springframework.transaction.annotation.Transactional;' : ''}
${refImports}
import java.util.Collection;
import java.util.List;${streamImports}

/**
 * ${t.title} Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class ${E}ServiceImpl implements I${E}Service {

    private final ${E}Mapper ${varName};${refMappers}${dt ? `\n    private final ${dtEntity}Mapper ${dtMapper};` : ''}

    @Override
    public PageResult<${E}> queryPageList(${E} bo, PageQuery pageQuery) {
        LambdaQueryWrapper<${E}> lqw = buildQueryWrapper(bo);
        Page<${E}> page = ${varName}.selectPage(pageQuery.build(), lqw);
${pageListBody}
    }

    @Override
    public List<${E}> queryList(${E} bo) {
        return ${varName}.selectList(buildQueryWrapper(bo));
    }

    @Override
    public ${E} queryById(Long ${t.pk}) {
${byIdBody}
    }

    @Override${dt ? '\n    @Transactional(rollbackFor = Exception.class)' : ''}
    public Boolean insertByBo(${E} bo) {
${insertBody}
    }

    @Override${dt ? '\n    @Transactional(rollbackFor = Exception.class)' : ''}
    public Boolean updateByBo(${E} bo) {
${updateBody}
    }

    @Override${dt ? '\n    @Transactional(rollbackFor = Exception.class)' : ''}
    public Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid) {
        if (Boolean.TRUE.equals(isValid)) {
${validateBlock}        }
${deleteBody}
    }
${dtMethod}${refMethod}
    /**
     * 构造查询条件
     */
    private LambdaQueryWrapper<${E}> buildQueryWrapper(${E} bo) {
        LambdaQueryWrapper<${E}> lqw = new LambdaQueryWrapper<>();
${conds}
        return lqw;
    }
}
`;
}

/** 是否适合作为查询条件 */
function tfIsFilterable(f) {
  if (f.virtual || f.hidden) return false;
  if (f.name === 'delFlag') return false;
  if (['remark', 'description', 'address', 'originalUrl', 'compressedUrl', 'fileName', 'standard'].includes(f.name)) return false;
  return /^(String|Long|Integer|LocalDate|LocalDateTime)$/.test(f.javaType);
}

/* ============================================================
 * 7. Controller（通用 CRUD，仅 ctrl=true 的模块）
 * ============================================================ */
function genController(t) {
  const E = t.entity;
  const perm = t.perm;
  const varName = t.key + 'Service';
  const iface = `I${E}Service`;

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
import ${PACKAGE}.domain.${E};
import ${PACKAGE}.service.${iface};
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * ${t.title}Controller
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("${t.basePath}")
public class ${E}Controller extends BaseController {

    private final ${iface} ${varName};

    /**
     * 查询${t.title}列表
     */
    @SaCheckPermission("${perm}:list")
    @GetMapping("/list")
    public R<PageResult<${E}>> list(${E} bo, PageQuery pageQuery) {
        return R.ok(${varName}.queryPageList(bo, pageQuery));
    }

    /**
     * 导出${t.title}列表
     */
    @SaCheckPermission("${perm}:export")
    @Log(title = "${t.title}", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(${E} bo, HttpServletResponse response) {
        List<${E}> list = ${varName}.queryList(bo);
        ExcelBuilder.of(list, ${E}.class).sheetName("${t.title}").toResponse(response);
    }

    /**
     * 查询${t.title}下拉选项（PRD 4.5；必须声明在 /{${t.pk}} 之前，避免被路径变量吞掉）
     */
    @SaCheckPermission("${perm}:list")
    @GetMapping("/optionselect")
    public R<List<${E}>> optionselect(${E} bo) {
        return R.ok(${varName}.queryList(bo));
    }

    /**
     * 获取${t.title}详细信息
     */
    @SaCheckPermission("${perm}:query")
    @GetMapping("/{${t.pk}}")
    public R<${E}> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long ${t.pk}) {
        return R.ok(${varName}.queryById(${t.pk}));
    }

    /**
     * 新增${t.title}
     */
    @SaCheckPermission("${perm}:add")
    @Log(title = "${t.title}", businessType = BusinessType.INSERT)
    @PostMapping()
    public R<Void> add(@Validated @RequestBody ${E} bo) {
        return toAjax(${varName}.insertByBo(bo));
    }

    /**
     * 修改${t.title}
     */
    @SaCheckPermission("${perm}:edit")
    @Log(title = "${t.title}", businessType = BusinessType.UPDATE)
    @PutMapping()
    public R<Void> edit(@Validated @RequestBody ${E} bo) {
        return toAjax(${varName}.updateByBo(bo));
    }

    /**
     * 删除${t.title}
     */
    @SaCheckPermission("${perm}:remove")
    @Log(title = "${t.title}", businessType = BusinessType.DELETE)
    @DeleteMapping("/{${t.pk}s}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空") @PathVariable Long[] ${t.pk}s) {
        return toAjax(${varName}.deleteWithValidByIds(List.of(${t.pk}s), true));
    }
}
`;
}

/* ============================================================
 * 8. 建表 SQL（PRD 5.2 数据字典 + BaseEntity 审计字段）
 * ============================================================ */
function genSql(t) {
  const lines = [];
  for (const f of allFields(t)) {
    if (f.virtual || f.name === t.pk) continue;
    const notNull = f.required ? ' NOT NULL' : '';
    // ⚠️ 不能写成 NOT NULL DEFAULT NULL —— MySQL 严格模式报 1067 Invalid default value。
    // 必填字段只在显式配了 default 时才输出 DEFAULT，否则留空。
    const def = f.default != null
      ? ` DEFAULT '${f.default}'`
      : (f.required ? '' : ' DEFAULT NULL');
    lines.push(`  ${f.column.padEnd(20)} ${f.sqlType.padEnd(14)}${notNull}${def} COMMENT '${f.comment.replace(/'/g, "''")}'`);
  }
  const audit = t.audit !== false
    ? [
      `  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门'`,
      `  create_by        BIGINT         DEFAULT NULL COMMENT '创建者'`,
      `  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间'`,
      `  update_by        BIGINT         DEFAULT NULL COMMENT '更新者'`,
      `  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间'`,
    ]
    : [`  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间'`];

  return `-- ============================================================
-- ${t.title}表 ${t.table}
-- 来源: PRD 5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增),
--                   BaseEntity 审计字段, del_flag 逻辑删除(0存在 2删除)
-- ============================================================
DROP TABLE IF EXISTS ${t.table};
CREATE TABLE ${t.table} (
  ${t.pkColumn.padEnd(20)} BIGINT         NOT NULL COMMENT '${pkField(t).comment}',
${lines.join(',\n')},
${audit.join(',\n')},
  PRIMARY KEY (${t.pkColumn})${genIndexes(t)}
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='${t.title}';
`;
}

function genIndexes(t) {
  const idx = [];
  if (t.key === 'room') {
    idx.push(`  UNIQUE KEY uk_room_code (room_code)`,
      `  UNIQUE KEY uk_room_name (room_name)`,
      `  KEY idx_room_status (status)`);
  } else if (t.key === 'area') {
    idx.push(`  KEY idx_area_room (room_id)`, `  KEY idx_area_parent (parent_id)`);
  } else if (t.key === 'point') {
    idx.push(`  UNIQUE KEY uk_point_code (point_code)`,
      `  KEY idx_point_room (room_id, point_name)`,
      `  KEY idx_point_status (status)`,
      `  KEY idx_point_area (area_id)`);
  } else if (t.key === 'pointItem') {
    idx.push(`  KEY idx_item_point (point_id)`);
  } else if (t.key === 'itemTemplate') {
    idx.push(`  UNIQUE KEY uk_template_name (template_name)`);
  } else if (t.key === 'itemTemplateDetail') {
    idx.push(`  KEY idx_detail_template (template_id)`);
  } else if (t.key === 'record') {
    idx.push(`  KEY idx_record_point (point_id, inspect_time)`,
      `  KEY idx_record_room (room_id, inspect_time)`,
      `  KEY idx_record_inspector (inspector_id, inspect_time)`,
      `  KEY idx_record_result (result)`);
  } else if (t.key === 'recordItem') {
    idx.push(`  KEY idx_ritem_record (record_id)`);
  } else if (t.key === 'photo') {
    idx.push(`  KEY idx_photo_record (record_id)`, `  KEY idx_photo_item (record_item_id)`);
  } else if (t.key === 'abnormal') {
    idx.push(`  KEY idx_abn_status (status, create_time)`,
      `  KEY idx_abn_room (room_id)`,
      `  KEY idx_abn_point (point_id)`,
      `  KEY idx_abn_record (record_id)`);
  } else if (t.key === 'statsDaily') {
    idx.push(`  UNIQUE KEY uk_stats (stats_date, room_id, point_id)`,
      `  KEY idx_stats_date (stats_date)`);
  }
  return idx.length ? ',\n' + idx.join(',\n') : '';
}

/* ============================================================
 * 9. 字典 SQL（PRD 5.3 枚举值编码约定）
 * ============================================================ */
const DICTS = [
  { type: 'sys_inspect_cycle', name: '巡检周期类型', data: [['daily', '每日', 1], ['weekly', '每周', 2], ['monthly', '每月', 3], ['custom', '自定义间隔', 4]] },
  { type: 'sys_point_status', name: '点位状态', data: [['active', '启用', 1], ['inactive', '停用', 2], ['maintenance', '维护中', 3]] },
  { type: 'sys_inspect_result', name: '巡检记录结果', data: [['pending', '待巡检', 1], ['in_progress', '巡检中', 2], ['completed_normal', '已完成(正常)', 3], ['completed_abnormal', '已完成(异常)', 4], ['overdue', '已逾期', 5]] },
  { type: 'sys_item_result', name: '巡检项结果', data: [['normal', '正常', 1], ['abnormal', '异常', 2], ['na', '不适用', 3]] },
  { type: 'sys_item_type', name: '巡检项类型', data: [['radio', '单选', 1], ['number', '数值', 2], ['text', '文本', 3]] },
  { type: 'sys_inspect_source', name: '巡检数据来源', data: [['h5_scan', '扫码巡检', 1], ['pc_supplement', 'PC补录', 2]] },
  { type: 'sys_abnormal_status', name: '异常项处理状态', data: [['pending', '待处理', 1], ['processed', '已处理', 2]] },
];

function genDictSql() {
  const types = DICTS.map(d => `'${d.type}'`).join(', ');
  const out = [
    '-- ============================================================',
    '-- 机房巡检系统 数据字典初始化（PRD 5.3 枚举值编码约定）',
    '-- 依赖: sys_dict_type / sys_dict_data（若依 v6 内置）',
    '-- 注意: v6 的这两张表【没有 tenant_id 列】，不要照搬旧版多租户脚本',
    '-- ID 号段: dict_id 1770000000000001001+ / dict_code 1770000000000002001+',
    '-- 本脚本可重复执行（先按 dict_type 清理，再插入）',
    '-- ============================================================',
    '',
    '-- 清理旧数据（按 dict_type 精确匹配本模块的 7 个字典）',
    `DELETE FROM sys_dict_data WHERE dict_type IN (${types});`,
    `DELETE FROM sys_dict_type WHERE dict_type IN (${types});`,
    '',
  ];
  let typeSeq = 1770000000000001000n;
  let dataSeq = 1770000000000002000n;
  for (const d of DICTS) {
    out.push(`-- ${d.name}`);
    out.push(`INSERT INTO sys_dict_type (dict_id, dict_name, dict_type, create_dept, create_by, create_time, remark) VALUES (${typeSeq++}, '${d.name}', '${d.type}', ${V6_DEPT}, ${V6_USER}, sysdate(), '机房巡检系统');`);
    for (const [val, label, ord] of d.data) {
      out.push(`INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, remark) VALUES (${dataSeq++}, ${ord}, '${label}', '${val}', '${d.type}', '', 'default', 'N', ${V6_DEPT}, ${V6_USER}, sysdate(), '机房巡检系统');`);
    }
    out.push('');
  }
  out.push('-- 执行后自检：应返回 7');
  out.push(`-- SELECT COUNT(*) AS dict_type_total FROM sys_dict_type WHERE dict_type IN (${types});`);
  return out.join('\n');
}

/* ============================================================
 * 10. 菜单 SQL（PRD 7.2 若依 v6 规范，sys_menu 22 列）
 * ============================================================ */
const MENUS = [
  { id: '1770000000000000010', name: '机房巡检', path: 'inspect', comp: null, type: 'M', icon: 'server', perm: '', parent: '0', order: 5 },
  { id: '1770000000000000101', name: '机房管理', path: 'room', comp: 'inspect/room/index', type: 'C', icon: 'building', perm: 'inspect:room:list', parent: '1770000000000000010', order: 1, btns: ['inspect:room:query:机房查询:1', 'inspect:room:add:机房新增:2', 'inspect:room:edit:机房修改:3', 'inspect:room:remove:机房删除:4', 'inspect:room:export:机房导出:5'] },
  { id: '1770000000000000102', name: '区域管理', path: 'area', comp: 'inspect/area/index', type: 'C', icon: 'tree-table', perm: 'inspect:area:list', parent: '1770000000000000010', order: 2, btns: ['inspect:area:query:区域查询:1', 'inspect:area:add:区域新增:2', 'inspect:area:edit:区域修改:3', 'inspect:area:remove:区域删除:4', 'inspect:area:export:区域导出:5'] },
  { id: '1770000000000000103', name: '点位管理', path: 'point', comp: 'inspect/point/index', type: 'C', icon: 'location', perm: 'inspect:point:list', parent: '1770000000000000010', order: 3, btns: ['inspect:point:query:点位查询:1', 'inspect:point:add:点位新增:2', 'inspect:point:edit:点位修改:3', 'inspect:point:remove:点位删除:4', 'inspect:point:import:点位导入:5', 'inspect:point:qrcode:二维码生成导出:6'] },
  { id: '1770000000000000104', name: '巡检项模板', path: 'itemTemplate', comp: 'inspect/itemTemplate/index', type: 'C', icon: 'list', perm: 'inspect:itemTemplate:list', parent: '1770000000000000010', order: 4, btns: ['inspect:itemTemplate:query:模板查询:1', 'inspect:itemTemplate:add:模板新增:2', 'inspect:itemTemplate:edit:模板修改:3', 'inspect:itemTemplate:remove:模板删除:4', 'inspect:itemTemplate:export:模板导出:5'] },
  { id: '1770000000000000105', name: '巡检记录', path: 'record', comp: 'inspect/record/index', type: 'C', icon: 'documentation', perm: 'inspect:record:list', parent: '1770000000000000010', order: 5, btns: ['inspect:record:query:记录查询:1', 'inspect:record:export:记录导出:2', 'inspect:record:remark:追加备注:3', 'inspect:record:supplement:逾期补录:4'] },
  { id: '1770000000000000106', name: '统计报表', path: 'stats', comp: 'inspect/stats/index', type: 'C', icon: 'chart', perm: 'inspect:stats:list', parent: '1770000000000000010', order: 6, btns: [] },
  { id: '1770000000000000107', name: '异常处理', path: 'abnormal', comp: 'inspect/abnormal/index', type: 'C', icon: 'warning', perm: 'inspect:abnormal:list', parent: '1770000000000000010', order: 7, btns: ['inspect:abnormal:query:异常查询:1', 'inspect:abnormal:process:异常处理:2', 'inspect:abnormal:export:异常导出:3'] },
];

// 本模块独占的菜单号段（勿与其他模块重叠）
const MENU_ROOT = '1770000000000000010';
const MENU_LIMIT = '1770000000000000199';
// v6 ry_vue.sql 中的审计常量：admin 用户 / 顶级部门
const V6_DEPT = '1761000000000000103';
const V6_USER = '1761100000000000001';

// 按 PRD 7.2 若依菜单规范：每个 C 菜单独占 10 号段，
// 按钮 ID = 菜单ID + 10*(按钮序号+1)，避免与其它模块的菜单/按钮 ID 相撞。
function menuButtonId(menuId, btnIndex) {
  return String(BigInt(menuId) + BigInt(10 * (btnIndex + 1)));
}

// 生成前自检：ID 不得重复、父级必须存在（防止再次出现 Duplicate entry）
/* ============================================================
 * 11. 设计期自检：关联名称回填
 * ============================================================ */
/**
 * 实体里声明了 xxxName 虚拟字段（roomName / areaName / parentName）时，
 * 对应的外键字段**必须**配 refName，否则生成的 ServiceImpl 不会回填名称，
 * 前端列表「所属机房/所属区域」列恒为空白（真实踩坑：点位列表两项都空白，
 * 但点「修改」又能显示 —— 因为表单自己用下拉选项解析出了名称）。
 *
 * 手写 Service 的模块（svcHandwritten，如 record/abnormal）由人工在 Ext Service
 * 里回填，不在此约束内。
 */
function assertRefNamesDeclared() {
  const problems = [];
  for (const t of TABLES) {
    if (t.svcHandwritten) continue;
    const declared = new Set(pFields(t).filter(f => f.refName).map(f => f.refName));
    for (const v of (t.virtual || [])) {
      if (!v.virtual || !/Name$/.test(v.name)) continue;
      if (!declared.has(v.name)) {
        problems.push(`${t.entity}.${v.name}（表 ${t.table} 的某个外键缺 refName: '${v.name}'）`);
      }
    }
  }
  if (problems.length) {
    throw new Error(`[gen-refname] 以下关联名称字段未声明 refName，列表会一直空白:\n  - ${problems.join('\n  - ')}`);
  }
}

function assertMenusSampled() {
  const seen = new Map();
  const nodes = [];
  for (const m of MENUS) {
    nodes.push({ id: m.id, label: m.name, parent: m.parent });
    (m.btns || []).forEach((b, i) => {
      nodes.push({ id: menuButtonId(m.id, i), label: b.split(':')[3], parent: m.id });
    });
  }
  for (const n of nodes) {
    if (seen.has(n.id)) throw new Error(`[gen-menu] 菜单ID重复: ${n.id} —— ${seen.get(n.id)} / ${n.label}`);
    seen.set(n.id, n.label);
  }
  for (const n of nodes) {
    if (n.parent !== '0' && !seen.has(n.parent)) throw new Error(`[gen-menu] 父菜单不存在: ${n.id} ${n.label} -> ${n.parent}`);
  }
  const outside = nodes.filter(n => BigInt(n.id) < BigInt(MENU_ROOT) || BigInt(n.id) > BigInt(MENU_LIMIT));
  if (outside.length) throw new Error(`[gen-menu] 菜单ID越界(应在 ${MENU_ROOT}~${MENU_LIMIT}): ${outside.map(n => n.id).join(', ')}`);
  return nodes.length;
}

function genMenuSql() {
  const nodeCount = assertMenusSampled();
  const btnRanges = MENUS
    .filter((m) => (m.btns || []).length)
    .map((m) => `${menuButtonId(m.id, 0)}-${menuButtonId(m.id, m.btns.length - 1)}`)
    .join(' / ');
  const out = [
    '-- ============================================================',
    '-- 机房巡检系统 菜单初始化（RuoYi-Vue-Plus v6）',
    '-- sys_menu 共 22 列，INSERT 必须严格按列顺序提供 22 个值',
    '-- 列顺序: menu_id, menu_name, parent_id, order_num, path, component,',
    '--         query_param, is_frame, is_cache, menu_type, visible, status,',
    '--         perms, icon, active_menu, ext, create_dept, create_by,',
    '--         create_time, update_by, update_time, remark',
    '--',
    `-- ID 号段（本模块独占 ${MENU_ROOT} ~ ${MENU_LIMIT}，共 ${nodeCount} 个节点）:`,
    `--   M 目录 : ${MENU_ROOT}`,
    `--   C 菜单 : ${MENUS.filter((m) => m.type === 'C').map((m) => m.id).join(' / ')}`,
    '--   F 按钮 : 菜单ID + 10*(序号+1)，各模块号段:',
    `--            ${btnRanges}`,
    '--',
    '-- 本脚本可重复执行：先清理本号段的菜单与角色关联，再重新插入',
    '-- ============================================================',
    '',
    '-- 清理旧数据（含 sys_role_menu 关联），保证幂等',
    `DELETE FROM sys_role_menu WHERE menu_id BETWEEN ${MENU_ROOT} AND ${MENU_LIMIT};`,
    `DELETE FROM sys_menu      WHERE menu_id BETWEEN ${MENU_ROOT} AND ${MENU_LIMIT};`,
    '',
  ];
  const cols = '(menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache, menu_type, visible, status, perms, icon, active_menu, ext, create_dept, create_by, create_time, update_by, update_time, remark)';
  const row = (id, name, parent, order, p, comp, type, icon, perm, active) =>
    `(${id}, '${name}', ${parent}, ${order}, '${p}', ${comp ? `'${comp}'` : 'NULL'}, '', 'N', 'N', '${type}', '0', '0', '${perm}', '${icon}', ${active ? `'${active}'` : 'NULL'}, NULL, ${V6_DEPT}, ${V6_USER}, sysdate(), NULL, NULL, '机房巡检系统')`;

  for (const m of MENUS) {
    out.push(`-- ${m.name}`);
    out.push(`INSERT INTO sys_menu ${cols} VALUES ${row(m.id, m.name, m.parent, m.order, m.path, m.comp, m.type, m.icon, m.perm, m.type === 'C' ? m.path : null)};`);
    // 按钮格式: 权限前缀:模块:动作:中文名:排序
    (m.btns || []).forEach((b, i) => {
      const parts = b.split(':');
      const perm = parts.slice(0, 3).join(':');   // inspect:room:query
      const label = parts[3];                     // 机房查询
      const ord = parts[4];                       // 1
      out.push(`INSERT INTO sys_menu ${cols} VALUES ${row(menuButtonId(m.id, i), label, m.id, ord, '', null, 'F', '#', perm, null)};`);
    });
    out.push('');
  }
  out.push('-- 角色授权：按 role_key 关联超级管理员（v6 的 role_id 并非 1，硬编码会授权失效）');
  out.push('-- 如需授权给其它角色，改 role_key 即可；去掉 WHERE 则授权给全部角色');
  out.push('INSERT INTO sys_role_menu (role_id, menu_id)');
  out.push('SELECT r.role_id, m.menu_id');
  out.push('FROM sys_role r');
  out.push('CROSS JOIN sys_menu m');
  out.push(`WHERE r.role_key = 'superadmin'`);
  out.push(`  AND m.menu_id BETWEEN ${MENU_ROOT} AND ${MENU_LIMIT};`);
  out.push('');
  out.push('-- ---------- 执行后自检（第 1 条必须返回 0 行）----------');
  out.push(`-- SELECT menu_id, COUNT(*) AS c FROM sys_menu WHERE menu_id BETWEEN ${MENU_ROOT} AND ${MENU_LIMIT} GROUP BY menu_id HAVING c > 1;`);
  out.push(`-- SELECT COUNT(*) AS menu_total FROM sys_menu WHERE menu_id BETWEEN ${MENU_ROOT} AND ${MENU_LIMIT};`);
  out.push(`-- SELECT COUNT(*) AS granted FROM sys_role_menu WHERE menu_id BETWEEN ${MENU_ROOT} AND ${MENU_LIMIT};`);
  return out.join('\n');
}

/* ============================================================
 * 11. PC 前端（plus-ui v6: TS + Element Plus + Vue3）
 * ============================================================ */
function genPcApiTypes(t) {
  const E = t.entity;
  const props = pFields(t).map(f => `  /** ${f.comment} */
  ${f.name}?: ${tsType(f.javaType)};`).join('\n');
  /* ⚠ PageQuery 是 src/types/global.d.ts 里的全局环境接口，不能再从 '@/api/types' 引入（TS2305） */
  return `/**
 * ${t.title} 查询
 */
export interface ${E}Query extends PageQuery {
${props}
}

/**
 * ${t.title} 表单
 */
export interface ${E}Form {
  /** 主键 */
  ${t.pk}?: string;
${props}
${(t.virtual || []).map(v => `  /** ${v.comment} */
  ${v.name}?: ${String(v.javaType).startsWith('List<') ? 'any[]' : 'string'};`).join('\n')}
}

/**
 * ${t.title} 视图
 */
export interface ${E}VO {
  /** 主键 */
  ${t.pk}?: string;
${props}
  /** 创建时间 */
  createTime?: string;
${(t.virtual || []).map(v => `  /** ${v.comment} */
  ${v.name}?: any;`).join('\n')}
}
`;
}

function genPcApiIndex(t) {
  const E = t.entity;
  const bp = t.basePath;
  const lower = t.key;
  return `import type { ${E}Form, ${E}Query, ${E}VO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询${t.title}列表
 */
export const list${E} = (query?: ${E}Query): AxiosPromise<PageResult<${E}VO>> => {
  return request({
    url: '${bp}/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询${t.title}详细
 */
export const get${E} = (${t.pk}: string | number): AxiosPromise<${E}VO> => {
  return request({
    url: '${bp}/' + ${t.pk},
    method: 'get'
  });
};

/**
 * 新增${t.title}
 */
export const add${E} = (data: ${E}Form): AxiosPromise => {
  return request({
    url: '${bp}',
    method: 'post',
    data
  });
};

/**
 * 修改${t.title}
 */
export const update${E} = (data: ${E}Form): AxiosPromise => {
  return request({
    url: '${bp}',
    method: 'put',
    data
  });
};

/**
 * 删除${t.title}
 */
export const del${E} = (${t.pk}: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '${bp}/' + ${t.pk},
    method: 'delete'
  });
};

/**
 * ${t.title}下拉选项
 */
export const optionselect${E} = (params?: any): AxiosPromise<${E}VO[]> => {
  return request({
    url: '${bp}/optionselect',
    method: 'get',
    params
  });
};
`;
}

function genPcView(t) {
  const E = t.entity;
  const lower = t.key;
  const perm = t.perm;

  // --- 主子表（明细子表格）---
  const dt = detailTarget(t);
  const dtHasOrder = dt ? dt.fields.some(f => f.name === 'orderNum') : false;
  /** 明细里第一个必填的文本字段，用于提交前逐行校验 */
  const dtNameField = dt ? (dt.fields.find(f => f.required && f.javaType === 'String') || dt.fields[0]) : null;
  const dtDefaults = dt
    ? [
      ...dt.fields.filter(f => !dtHasOrder || f.name !== 'orderNum').map(f => {
        // 字典字段给首选值，避免新增的行提交出空枚举进库存成脏数据
        const v = f.default != null
          ? `'${f.default}'`
          : (f.dict ? `${f.dict}.value?.[0]?.value ?? ''` : (f.javaType === 'Integer' ? '0' : "''"));
        return `${f.name}: ${v}`;
      }),
      ...(dtHasOrder ? [`orderNum: (form.value.${dt.listField}?.length ?? 0)`] : []),
    ].join(', ')
    : '';

  // --- 关联下拉：生成 import / Options ref / 选项加载函数（缺一不可，否则下拉为空）---
  const fFields = pFields(t).filter(isForeignSelect).map(f => ({ f, name: f.name, target: foreignTarget(f.foreign) }));
  const fTargets = [...new Map(fFields.map(x => [x.target.key, x.target])).values()];
  const foreignImports = fTargets.map(x => `import { ${x.api} } from '@/api/inspect/${x.module}';`).join('\n');
  const optionsBlock = fFields.length
    ? `/** 关联下拉选项 */\n${fFields.map(x => `const ${x.name}Options = ref<Array<{ label: string; value: any }>>([]);`).join('\n')}`
    : '';

  // 本页用到的字典（含明细子表格的字典），需要 useDict 拉取后交给 dict-tag / el-select 渲染
  const usedDicts = [...new Set([
    ...pFields(t).filter(f => f.dict).map(f => f.dict),
    ...(dt ? dt.fields.filter(f => f.dict).map(f => f.dict) : []),
  ])];
  const dictImport = usedDicts.length ? `import { useDict } from '@/utils/dict';\n` : '';
  const dictDecl = usedDicts.length
    ? `const { ${usedDicts.join(', ')} } = useDict(${usedDicts.map(d => `'${d}'`).join(', ')});\n`
    : '';
  // 自关联树字段（如 area.parentId）额外补一个「顶级」选项（value=0）：
  // 否则表为空时下拉无任何可选项，第一条根区域根本建不出来（PRD：顶级为 0）
  const optExpr = (x) => `(${x.name}Res.data ?? []).map((i: any) => ({ label: i.${x.target.label}, value: i.${x.target.value} }))`;
  const optAssign = (x) => (x.f.refZeroLabel
    ? `  ${x.name}Options.value = [{ label: '${x.f.refZeroLabel}', value: 0 }, ...${optExpr(x)}];`
    : `  ${x.name}Options.value = ${optExpr(x)};`);

  const foreignLoader = fFields.length
    ? `/** 加载关联下拉选项（不加载则下拉框为空） */
async function loadForeignOptions() {
${fFields.map(x => `  const ${x.name}Res = await ${x.target.api}({});`).join('\n')}
${fFields.map(optAssign).join('\n')}
}

`
    : '';

  // 列表列：
  //  - 字典字段用 dict-tag 渲染成「正常/停用」等标签，而不是直接吐 0/1 原始值
  //  - 外键字段优先显示后端回填的名称（roomName / areaName / parentName），而不是原始 ID
  const columns = pFields(t).map(f => {
    const w = ['LocalDateTime', 'LocalDate', 'BigDecimal'].includes(f.javaType) ? ' width="120"' : (f.javaType === 'String' && (f.sqlType || '').includes('VARCHAR(5')) ? ' width="90"' : '';
    const prop = fieldProp(f);
    const label = fieldLabel(f);
    if (f.dict) {
      return `      <el-table-column label="${label}" align="center" prop="${prop}"${w}>
        <template #default="scope">
          <dict-tag :options="${f.dict}" :value="scope.row.${prop}" />
        </template>
      </el-table-column>`;
    }
    return `      <el-table-column label="${label}" align="center" prop="${prop}"${w} />`;
  }).join('\n');

  const queryItems = pFields(t).filter(f => tfIsFilterable(f)).slice(0, 3).map(f => {
    if (isForeignSelect(f)) {
      return `      <el-form-item label="${fieldLabel(f)}" prop="${f.name}">
        <el-select v-model="queryParams.${f.name}" placeholder="请选择${fieldLabel(f)}" clearable style="width: 180px">
          <el-option v-for="o in ${f.name}Options" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </el-form-item>`;
    }
    if (f.dict) {
      return `      <el-form-item label="${fieldLabel(f)}" prop="${f.name}">
        <el-select v-model="queryParams.${f.name}" placeholder="请选择${fieldLabel(f)}" clearable style="width: 180px">
          <el-option v-for="d in ${f.dict}" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>`;
    }
    return `      <el-form-item label="${f.comment}" prop="${f.name}">
        <el-input v-model="queryParams.${f.name}" placeholder="请输入${f.comment}" clearable style="width: 180px" @keyup.enter="handleQuery" />
      </el-form-item>`;
  }).join('\n');

  // 列表里的「明细数」列：0 条会高亮成灰色，方便一眼看出哪个模板导入时会报「没有明细」
  const dtCountColumn = dt
    ? `      <el-table-column label="${dt.title}数" align="center" width="110">
        <template #default="scope">
          <el-tag :type="(scope.row.${dt.listField}?.length ?? 0) > 0 ? 'success' : 'info'">{{ scope.row.${dt.listField}?.length ?? 0 }}</el-tag>
        </template>
      </el-table-column>
`
    : '';

  // 明细子表格：主表弹窗内直接录入，随主表一起提交
  const dtBlock = dt
    ? `
      <el-divider content-position="left">
        ${dt.title}
        <el-button link type="primary" icon="Plus" style="margin-left: 12px" @click="handleAddDetail">添加明细</el-button>
      </el-divider>
      <el-table :data="form.${dt.listField} || []" size="small" border>
        <el-table-column label="序号" type="index" width="55" align="center" />
${dt.fields.map(dtColumn).join('\n')}
        <el-table-column label="操作" width="80" align="center">
          <template #default="{ $index }">
            <el-button link type="danger" icon="Delete" @click="handleRemoveDetail($index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>`
    : '';

  return `<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="90px">
${queryItems}
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" v-hasPermi="['${perm}:add']" @click="handleAdd">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" v-hasPermi="['${perm}:edit']" @click="handleUpdate()">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" v-hasPermi="['${perm}:remove']" @click="handleDelete()">删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="warning" plain icon="Download" v-hasPermi="['${perm}:export']" @click="handleExport">导出</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="${lower}List" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
${columns}
${dtCountColumn}      <el-table-column label="创建时间" align="center" prop="createTime" width="180" />
      <el-table-column label="操作" align="center" width="160" fixed="right">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" v-hasPermi="['${perm}:edit']" @click="handleUpdate(scope.row)">修改</el-button>
          <el-button link type="danger" icon="Delete" v-hasPermi="['${perm}:remove']" @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <el-dialog :title="title" v-model="open" width="${dt ? '1000px' : '700px'}" append-to-body>
      <el-form ref="${lower}Ref" :model="form" :rules="rules" label-width="100px">
${formItems(t)}
      </el-form>${dtBlock}
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="${E}" lang="ts">
import { ref, reactive, toRefs, getCurrentInstance } from 'vue';
import type { ${E}Form, ${E}Query, ${E}VO } from '@/api/inspect/${lower}/types';
import { list${E}, get${E}, del${E}, add${E}, update${E} } from '@/api/inspect/${lower}/index';
${dictImport}${foreignImports}
const { proxy } = getCurrentInstance() as any;
${dictDecl}
const ${lower}List = ref<${E}VO[]>([]);
const open = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const title = ref('');
const ${lower}Ref = ref();
const queryRef = ref();

const data = reactive({
  form: {} as ${E}Form,
  queryParams: {
    pageNum: 1,
    pageSize: 10
  } as ${E}Query
});
const { queryParams, form } = toRefs(data);

const rules = {
${pFields(t).filter(f => f.required).map(f => `  ${f.name}: [{ required: true, message: '${f.comment}不能为空', trigger: 'blur' }],`).join('\n')}
};

${optionsBlock}

/** 查询${t.title}列表 */
async function getList() {
  loading.value = true;
  try {
    const res = await list${E}(queryParams.value);
    ${lower}List.value = res.data?.rows ?? [];
    total.value = res.data?.total ?? 0;
  } finally {
    loading.value = false;
  }
}

function cancel() {
  open.value = false;
  reset();
}

function reset() {
  form.value = { ${t.pk}: undefined${dt ? `, ${dt.listField}: []` : ''} } as ${E}Form;
}

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

function resetQuery() {
  queryParams.value = { pageNum: 1, pageSize: 10 } as ${E}Query;
  queryRef.value?.resetFields();
  handleQuery();
}

function handleSelectionChange(selection: ${E}VO[]) {
  ids.value = selection.map(item => item.${t.pk}!) as Array<string | number>;
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
}

function handleAdd() {
  reset();
  open.value = true;
  title.value = '新增${t.title}';
}

async function handleUpdate(row?: ${E}VO) {
  reset();
  const _id = row?.${t.pk} ?? ids.value[0];
  const { data } = await get${E}(_id);
  form.value = data as any;${dt ? `
  if (!form.value.${dt.listField}) form.value.${dt.listField} = [];` : ''}
  open.value = true;
  title.value = '修改${t.title}';
}
${dt ? `
/** 明细：新增一行 */
function handleAddDetail() {
  if (!form.value.${dt.listField}) form.value.${dt.listField} = [];
  form.value.${dt.listField}!.push({ ${dtDefaults} });
}

/** 明细：删除一行 */
function handleRemoveDetail(index: number) {
  form.value.${dt.listField}?.splice(index, 1);
}
` : ''}

/** 提交表单 */
async function submitForm() {
  await ${lower}Ref.value?.validate();${dt ? `
  // 明细逐行校验：名称不允许为空，否则会往库里塞无意义的空明细
  const details = form.value.${dt.listField} ?? [];
  for (let i = 0; i < details.length; i++) {
    if (!details[i].${dtNameField.name}) {
      proxy?.$modal.msgError(\`第 \${i + 1} 行${dt.title}的「${dtNameField.comment}」不能为空\`);
      return;
    }
  }` : ''}
  if (form.value.${t.pk} != null) {
    await update${E}(form.value);
    proxy?.$modal.msgSuccess('修改成功');
  } else {
    await add${E}(form.value);
    proxy?.$modal.msgSuccess('新增成功');
  }
  open.value = false;
  getList();
}

async function handleDelete(row?: ${E}VO) {
  const _ids = row?.${t.pk} ?? ids.value;
  await proxy?.$modal.confirm('是否确认删除${t.title}编号为"' + _ids + '"的数据项？');
  await del${E}(_ids);
  proxy?.$modal.msgSuccess('删除成功');
  getList();
}

/** 导出 */
function handleExport() {
  proxy?.download('${t.basePath}/export', { ...queryParams.value }, \`${t.title}_\${new Date().getTime()}.xlsx\`);
}

${foreignLoader}getList();
${fFields.length ? 'loadForeignOptions();' : ''}
</script>
`;
}

/**
 * 明细子表格的一列（按字段类型选择编辑控件）
 *  - required（0否 1是）这类 CHAR(1) 开关 -> el-switch
 *  - 配了 dict 的字段 -> el-select（选项来自 useDict，生成器已保证字典被引入）
 *  - Integer -> el-input-number，其余文本 -> el-input
 */
function dtColumn(f) {
  // 「是否必填（0否 1是）」这类长注释在表格里太占宽度，收敛成「必填」
  const label = f.name === 'required' ? '必填' : f.comment;
  if (f.name === 'required') {
    return `        <el-table-column label="${label}" width="90" align="center">
          <template #default="{ row }">
            <el-switch v-model="row.${f.name}" active-value="1" inactive-value="0" />
          </template>
        </el-table-column>`;
  }
  if (f.dict) {
    return `        <el-table-column label="${label}" width="130">
          <template #default="{ row }">
            <el-select v-model="row.${f.name}" placeholder="${label}">
              <el-option v-for="d in ${f.dict}" :key="d.value" :label="d.label" :value="d.value" />
            </el-select>
          </template>
        </el-table-column>`;
  }
  if (f.javaType === 'Integer') {
    return `        <el-table-column label="${label}" width="100" align="center">
          <template #default="{ row }">
            <el-input-number v-model="row.${f.name}" :min="0" controls-position="right" style="width: 100%" />
          </template>
        </el-table-column>`;
  }
  return `        <el-table-column label="${label}" min-width="160">
          <template #default="{ row }">
            <el-input v-model="row.${f.name}" placeholder="请输入${label}" />
          </template>
        </el-table-column>`;
}

function formItems(t) {
  return pFields(t).map(f => {
    const label = fieldLabel(f);
    const prop = f.name;
    if (isForeignSelect(f)) {
      return `        <el-form-item label="${label}" prop="${prop}">
          <el-select v-model="form.${prop}" placeholder="请选择${label}" clearable style="width: 100%">
            <el-option v-for="o in ${prop}Options" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>`;
    }
    if (f.javaType === 'LocalDateTime') {
      return `        <el-form-item label="${label}" prop="${prop}">
          <el-date-picker v-model="form.${prop}" type="datetime" placeholder="请选择${label}" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" />
        </el-form-item>`;
    }
    if (f.javaType === 'LocalDate') {
      return `        <el-form-item label="${label}" prop="${prop}">
          <el-date-picker v-model="form.${prop}" type="date" placeholder="请选择${label}" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>`;
    }
    if (f.javaType === 'BigDecimal' || f.javaType === 'Integer') {
      return `        <el-form-item label="${label}" prop="${prop}">
          <el-input-number v-model="form.${prop}" :min="0" placeholder="请输入${label}" style="width: 100%" />
        </el-form-item>`;
    }
    if (f.javaType === 'Long') {
      // 雪花 ID 19 位超出 JS 安全整数，禁用 number 控件
      return `        <el-form-item label="${label}" prop="${prop}">
          <el-input v-model="form.${prop}" placeholder="请输入${label}" />
        </el-form-item>`;
    }
    if (f.dict) {
      // 按字典渲染，不再硬编码 正常/停用 两个值
      return `        <el-form-item label="${label}" prop="${prop}">
          <el-radio-group v-model="form.${prop}">
            <el-radio v-for="d in ${f.dict}" :key="d.value" :value="d.value">{{ d.label }}</el-radio>
          </el-radio-group>
        </el-form-item>`;
    }
    return `        <el-form-item label="${label}" prop="${prop}">
          <el-input v-model="form.${prop}" placeholder="请输入${label}" />
        </el-form-item>`;
  }).join('\n');
}

/* ============================================================
 * 12. H5 API（RuoYi-App-Plus / unibest，JS + @/utils/request）
 * ============================================================ */
function genH5Api(t) {
  const E = t.entity;
  const bp = t.basePath;
  return `import request from '@/utils/request'

/**
 * 查询${t.title}列表
 */
export function list${E}(query) {
  return request({
    url: '${bp}/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询${t.title}详细
 */
export function get${E}(${t.pk}) {
  return request({
    url: '${bp}/' + ${t.pk},
    method: 'get'
  })
}

/**
 * 新增${t.title}
 */
export function add${E}(data) {
  return request({
    url: '${bp}',
    method: 'post',
    data
  })
}

/**
 * 修改${t.title}
 */
export function update${E}(data) {
  return request({
    url: '${bp}',
    method: 'put',
    data
  })
}

/**
 * 删除${t.title}
 */
export function del${E}(${t.pk}) {
  return request({
    url: '${bp}/' + ${t.pk},
    method: 'delete'
  })
}

/**
 * ${t.title}下拉选项
 */
export function optionselect${E}(params) {
  return request({
    url: '${bp}/optionselect',
    method: 'get',
    params
  })
}
`;
}

/* ============================================================
 * 13. 主流程
 * ============================================================ */
function parseSpec() {
  if (!fs.existsSync(SPEC)) return [];
  const content = fs.readFileSync(SPEC, 'utf-8');
  return content.split('\n')
    .map(l => l.match(/^##\s+(.+?)(?:\s*\|.*)?$/))
    .filter(Boolean)
    .map(m => ({ title: m[1].trim() }));
}

function writeFile(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf-8');
}

function main() {
  const features = parseSpec();
  const out = [];

  // 设计期自检：先拦住「实体声明了 xxxName 却没配 refName」这类必然导致列表空白的问题
  assertRefNamesDeclared();

  // --- Java ---
  for (const t of TABLES) {
    writeFile(path.join(JAVA_BASE, 'domain', `${t.entity}.java`), genDomain(t));
    writeFile(path.join(JAVA_BASE, 'mapper', `${t.entity}Mapper.java`), genMapper(t));
    writeFile(path.join(JAVA_BASE, 'service', `I${t.entity}Service.java`), genService(t));
    writeFile(path.join(JAVA_BASE, 'service', 'impl', `${t.entity}ServiceImpl.java`), genServiceImpl(t));
    if (t.ctrl) {
      writeFile(path.join(JAVA_BASE, 'controller', `${t.entity}Controller.java`), genController(t));
    }
    out.push(`  ✓ Java ${t.entity.padEnd(26)} ${t.ctrl ? '(含 Controller)' : '(Controller 手写)'}`);
  }

  // --- SQL ---
  const schemaSql = [
    '-- ============================================================',
    '-- 机房巡检系统 建表脚本（RuoYi-Vue-Plus v6 / MySQL 8）',
    '-- 来源: my-feature.prd 5.2 数据字典',
    '-- 执行顺序: 本脚本 -> insp_dict.sql -> insp_menu.sql',
    '-- 注意: 逻辑删除为 del_flag（0存在 2删除），需与 v6 的',
    '--       mybatis-plus.global-config.db-config 保持一致',
    '-- ============================================================',
    'SET NAMES utf8mb4;',
    'SET FOREIGN_KEY_CHECKS = 0;',
    '',
    ...TABLES.map(genSql),
    'SET FOREIGN_KEY_CHECKS = 1;',
  ].join('\n');

  writeFile(path.join(OUT, 'sql', 'insp_schema.sql'), schemaSql);
  writeFile(path.join(OUT, 'sql', 'insp_dict.sql'), genDictSql());
  writeFile(path.join(OUT, 'sql', 'insp_menu.sql'), genMenuSql());
  out.push('  ✓ SQL  insp_schema.sql / insp_dict.sql / insp_menu.sql');

  // --- PC 前端 ---
  for (const t of TABLES) {
    if (!t.pcPage) continue; // 子表/内部表不单独出页面；复杂模块页面手写
    writeFile(path.join(OUT, 'pc', 'api', 'inspect', t.key, 'types.ts'), genPcApiTypes(t));
    writeFile(path.join(OUT, 'pc', 'api', 'inspect', t.key, 'index.ts'), genPcApiIndex(t));
    writeFile(path.join(OUT, 'pc', 'views', 'inspect', t.key, 'index.vue'), genPcView(t));
    out.push(`  ✓ PC   api/inspect/${t.key}/ + views/inspect/${t.key}/index.vue`);
  }

  // --- H5 API ---
  // h5Handwritten 的表（point/record/photo 等）其 H5 API 是手写增强版，
  // 生成器不得覆盖，否则会丢掉 myInspectPointList / submitInspectRecord / uploadInspectPhoto 等专用函数。
  let h5Count = 0;
  let h5Skipped = 0;
  for (const t of TABLES) {
    const p = path.join(OUT, 'h5', 'api', 'inspect', `${t.key}.js`);
    if (t.h5Handwritten) {
      // 手写文件：仅当不存在时才落一份通用版做兜底，已存在则原样保留
      if (fs.existsSync(p)) {
        h5Skipped++;
        continue;
      }
    }
    writeFile(p, genH5Api(t));
    h5Count++;
  }
  out.push(`  ✓ H5   api/inspect/*.js （生成 ${h5Count} 个，保留手写 ${h5Skipped} 个）`);

  console.log(`\n🔨 机房巡检系统代码生成器（RuoYi-Vue-Plus v6）`);
  console.log(`   PRD 功能点: ${features.length} 个   |   数据表: ${TABLES.length} 张`);
  console.log(`   输出目录: ${OUT}\n`);
  console.log(out.join('\n'));
  console.log(`\n✅ 完成`);
  console.log(`   Java 包名: ${PACKAGE}`);
  console.log(`   目标后端: ruoyi-admin/src/main/java/${PACKAGE.replace(/\./g, '/')}/`);
  console.log(`   目标 PC : src/api/inspect/ + src/views/inspect/`);
  console.log(`   目标 H5 : src/api/inspect/`);
  console.log(`\n⚠ 待手写: 点位(二维码/导入)、记录(提交/补录)、异常(处理)、统计、扫码、照片上传 及 H5 页面`);
}

main();
