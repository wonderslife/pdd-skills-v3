-- ============================================================
-- 机房巡检系统 数据字典初始化（PRD 5.3 枚举值编码约定）
-- 依赖: sys_dict_type / sys_dict_data（若依 v6 内置）
-- 注意: v6 的这两张表【没有 tenant_id 列】，不要照搬旧版多租户脚本
-- ID 号段: dict_id 1770000000000001001+ / dict_code 1770000000000002001+
-- 本脚本可重复执行（先按 dict_type 清理，再插入）
-- ============================================================

-- 清理旧数据（按 dict_type 精确匹配本模块的 7 个字典）
DELETE FROM sys_dict_data WHERE dict_type IN ('sys_inspect_cycle', 'sys_point_status', 'sys_inspect_result', 'sys_item_result', 'sys_item_type', 'sys_inspect_source', 'sys_abnormal_status');
DELETE FROM sys_dict_type WHERE dict_type IN ('sys_inspect_cycle', 'sys_point_status', 'sys_inspect_result', 'sys_item_result', 'sys_item_type', 'sys_inspect_source', 'sys_abnormal_status');

-- 巡检周期类型
INSERT INTO sys_dict_type (dict_id, dict_name, dict_type, create_dept, create_by, create_time, remark) VALUES (1770000000000001000, '巡检周期类型', 'sys_inspect_cycle', 1761000000000000103, 1761100000000000001, sysdate(), '机房巡检系统');
INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, remark) VALUES (1770000000000002000, 1, '每日', 'daily', 'sys_inspect_cycle', '', 'default', 'N', 1761000000000000103, 1761100000000000001, sysdate(), '机房巡检系统');
INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, remark) VALUES (1770000000000002001, 2, '每周', 'weekly', 'sys_inspect_cycle', '', 'default', 'N', 1761000000000000103, 1761100000000000001, sysdate(), '机房巡检系统');
INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, remark) VALUES (1770000000000002002, 3, '每月', 'monthly', 'sys_inspect_cycle', '', 'default', 'N', 1761000000000000103, 1761100000000000001, sysdate(), '机房巡检系统');
INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, remark) VALUES (1770000000000002003, 4, '自定义间隔', 'custom', 'sys_inspect_cycle', '', 'default', 'N', 1761000000000000103, 1761100000000000001, sysdate(), '机房巡检系统');

-- 点位状态
INSERT INTO sys_dict_type (dict_id, dict_name, dict_type, create_dept, create_by, create_time, remark) VALUES (1770000000000001001, '点位状态', 'sys_point_status', 1761000000000000103, 1761100000000000001, sysdate(), '机房巡检系统');
INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, remark) VALUES (1770000000000002004, 1, '启用', 'active', 'sys_point_status', '', 'default', 'N', 1761000000000000103, 1761100000000000001, sysdate(), '机房巡检系统');
INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, remark) VALUES (1770000000000002005, 2, '停用', 'inactive', 'sys_point_status', '', 'default', 'N', 1761000000000000103, 1761100000000000001, sysdate(), '机房巡检系统');
INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, remark) VALUES (1770000000000002006, 3, '维护中', 'maintenance', 'sys_point_status', '', 'default', 'N', 1761000000000000103, 1761100000000000001, sysdate(), '机房巡检系统');

-- 巡检记录结果
INSERT INTO sys_dict_type (dict_id, dict_name, dict_type, create_dept, create_by, create_time, remark) VALUES (1770000000000001002, '巡检记录结果', 'sys_inspect_result', 1761000000000000103, 1761100000000000001, sysdate(), '机房巡检系统');
INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, remark) VALUES (1770000000000002007, 1, '待巡检', 'pending', 'sys_inspect_result', '', 'default', 'N', 1761000000000000103, 1761100000000000001, sysdate(), '机房巡检系统');
INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, remark) VALUES (1770000000000002008, 2, '巡检中', 'in_progress', 'sys_inspect_result', '', 'default', 'N', 1761000000000000103, 1761100000000000001, sysdate(), '机房巡检系统');
INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, remark) VALUES (1770000000000002009, 3, '已完成(正常)', 'completed_normal', 'sys_inspect_result', '', 'default', 'N', 1761000000000000103, 1761100000000000001, sysdate(), '机房巡检系统');
INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, remark) VALUES (1770000000000002010, 4, '已完成(异常)', 'completed_abnormal', 'sys_inspect_result', '', 'default', 'N', 1761000000000000103, 1761100000000000001, sysdate(), '机房巡检系统');
INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, remark) VALUES (1770000000000002011, 5, '已逾期', 'overdue', 'sys_inspect_result', '', 'default', 'N', 1761000000000000103, 1761100000000000001, sysdate(), '机房巡检系统');

-- 巡检项结果
INSERT INTO sys_dict_type (dict_id, dict_name, dict_type, create_dept, create_by, create_time, remark) VALUES (1770000000000001003, '巡检项结果', 'sys_item_result', 1761000000000000103, 1761100000000000001, sysdate(), '机房巡检系统');
INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, remark) VALUES (1770000000000002012, 1, '正常', 'normal', 'sys_item_result', '', 'default', 'N', 1761000000000000103, 1761100000000000001, sysdate(), '机房巡检系统');
INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, remark) VALUES (1770000000000002013, 2, '异常', 'abnormal', 'sys_item_result', '', 'default', 'N', 1761000000000000103, 1761100000000000001, sysdate(), '机房巡检系统');
INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, remark) VALUES (1770000000000002014, 3, '不适用', 'na', 'sys_item_result', '', 'default', 'N', 1761000000000000103, 1761100000000000001, sysdate(), '机房巡检系统');

-- 巡检项类型
INSERT INTO sys_dict_type (dict_id, dict_name, dict_type, create_dept, create_by, create_time, remark) VALUES (1770000000000001004, '巡检项类型', 'sys_item_type', 1761000000000000103, 1761100000000000001, sysdate(), '机房巡检系统');
INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, remark) VALUES (1770000000000002015, 1, '单选', 'radio', 'sys_item_type', '', 'default', 'N', 1761000000000000103, 1761100000000000001, sysdate(), '机房巡检系统');
INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, remark) VALUES (1770000000000002016, 2, '数值', 'number', 'sys_item_type', '', 'default', 'N', 1761000000000000103, 1761100000000000001, sysdate(), '机房巡检系统');
INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, remark) VALUES (1770000000000002017, 3, '文本', 'text', 'sys_item_type', '', 'default', 'N', 1761000000000000103, 1761100000000000001, sysdate(), '机房巡检系统');

-- 巡检数据来源
INSERT INTO sys_dict_type (dict_id, dict_name, dict_type, create_dept, create_by, create_time, remark) VALUES (1770000000000001005, '巡检数据来源', 'sys_inspect_source', 1761000000000000103, 1761100000000000001, sysdate(), '机房巡检系统');
INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, remark) VALUES (1770000000000002018, 1, '扫码巡检', 'h5_scan', 'sys_inspect_source', '', 'default', 'N', 1761000000000000103, 1761100000000000001, sysdate(), '机房巡检系统');
INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, remark) VALUES (1770000000000002019, 2, 'PC补录', 'pc_supplement', 'sys_inspect_source', '', 'default', 'N', 1761000000000000103, 1761100000000000001, sysdate(), '机房巡检系统');

-- 异常项处理状态
INSERT INTO sys_dict_type (dict_id, dict_name, dict_type, create_dept, create_by, create_time, remark) VALUES (1770000000000001006, '异常项处理状态', 'sys_abnormal_status', 1761000000000000103, 1761100000000000001, sysdate(), '机房巡检系统');
INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, remark) VALUES (1770000000000002020, 1, '待处理', 'pending', 'sys_abnormal_status', '', 'default', 'N', 1761000000000000103, 1761100000000000001, sysdate(), '机房巡检系统');
INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, remark) VALUES (1770000000000002021, 2, '已处理', 'processed', 'sys_abnormal_status', '', 'default', 'N', 1761000000000000103, 1761100000000000001, sysdate(), '机房巡检系统');

-- 执行后自检：应返回 7
-- SELECT COUNT(*) AS dict_type_total FROM sys_dict_type WHERE dict_type IN ('sys_inspect_cycle', 'sys_point_status', 'sys_inspect_result', 'sys_item_result', 'sys_item_type', 'sys_inspect_source', 'sys_abnormal_status');