-- ============================================================
-- Seed Base Data for RuoYi Framework
-- Usage: mysql -u root -p asset_ruoyi < seed_base_data.sql
-- ============================================================

-- 1. 部门数据 (sys_dept)
INSERT INTO sys_dept (dept_id, parent_id, ancestors, dept_name, order_num, leader, phone, email, status, del_flag, create_by, create_time)
VALUES
(100, 0, '0', '集团总部', 1, '管理员', '', '', '0', '0', 'admin', NOW()),
(200, 100, '0,100', '华东分公司', 1, '', '', '', '0', '0', 'admin', NOW()),
(201, 100, '0,100', '华南分公司', 2, '', '', '', '0', '0', 'admin', NOW()),
(210, 200, '0,100,200', '综合管理部', 1, '', '', '', '0', '0', 'admin', NOW()),
(211, 200, '0,100,200', '财务管理部', 2, '', '', '', '0', '0', 'admin', NOW()),
(212, 200, '0,100,200', '资产管理部', 3, '', '', '', '0', '0', 'admin', NOW()),
(213, 200, '0,100,200', '评估业务部', 4, '', '', '', '0', '0', 'admin', NOW()),
(214, 200, '0,100,200', '处置业务部', 5, '', '', '', '0', '0', 'admin', NOW()),
(220, 201, '0,100,201', '综合管理部', 1, '', '', '', '0', '0', 'admin', NOW()),
(221, 201, '0,100,201', '财务管理部', 2, '', '', '', '0', '0', 'admin', NOW()),
(222, 201, '0,100,201', '资产管理部', 3, '', '', '', '0', '0', 'admin', NOW()),
(223, 201, '0,100,201', '评估业务部', 4, '', '', '', '0', '0', 'admin', NOW())
ON DUPLICATE KEY UPDATE dept_name=VALUES(dept_name);

-- 2. 字典类型 (sys_dict_type)
INSERT INTO sys_dict_type (dict_id, dict_name, dict_type, status, create_by, create_time, remark)
VALUES
(100, '资产类别', 'asset_category', '0', 'admin', NOW(), '资产分类'),
(101, '资产状态', 'asset_status', '0', 'admin', NOW(), '资产当前状态'),
(102, '处置方式', 'disposal_method', '0', 'admin', NOW(), '资产处置方式'),
(103, '评估方法', 'evaluation_method', '0', 'admin', NOW(), '资产评估方法'),
(104, '审批状态', 'approval_status', '0', 'admin', NOW(), '审批流程状态')
ON DUPLICATE KEY UPDATE dict_name=VALUES(dict_name);

-- 3. 字典数据 (sys_dict_data)
INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, status, create_by, create_time, remark)
VALUES
-- 资产类别
(1000, 1, '设备', 'equipment', 'asset_category', '', 'default', 'N', '0', 'admin', NOW(), ''),
(1001, 2, '车辆', 'vehicle', 'asset_category', '', 'default', 'N', '0', 'admin', NOW(), ''),
(1002, 3, '不动产', 'property', 'asset_category', '', 'default', 'N', '0', 'admin', NOW(), ''),
(1003, 4, '无形资产', 'intangible', 'asset_category', '', 'default', 'N', '0', 'admin', NOW(), ''),
-- 资产状态
(1010, 1, '闲置', 'idle', 'asset_status', '', 'info', 'Y', '0', 'admin', NOW(), ''),
(1011, 2, '评估中', 'evaluating', 'asset_status', '', 'warning', 'N', '0', 'admin', NOW(), ''),
(1012, 3, '处置中', 'disposing', 'asset_status', '', 'danger', 'N', '0', 'admin', NOW(), ''),
(1013, 4, '已处置', 'disposed', 'asset_status', '', 'success', 'N', '0', 'admin', NOW(), ''),
-- 处置方式
(1020, 1, '转让', 'transfer', 'disposal_method', '', 'default', 'N', '0', 'admin', NOW(), ''),
(1021, 2, '报废', 'scrap', 'disposal_method', '', 'default', 'N', '0', 'admin', NOW(), ''),
(1022, 3, '捐赠', 'donate', 'disposal_method', '', 'default', 'N', '0', 'admin', NOW(), ''),
(1023, 4, '置换', 'exchange', 'disposal_method', '', 'default', 'N', '0', 'admin', NOW(), ''),
-- 评估方法
(1030, 1, '市场法', 'market', 'evaluation_method', '', 'default', 'N', '0', 'admin', NOW(), ''),
(1031, 2, '收益法', 'income', 'evaluation_method', '', 'default', 'N', '0', 'admin', NOW(), ''),
(1032, 3, '成本法', 'cost', 'evaluation_method', '', 'default', 'N', '0', 'admin', NOW(), ''),
-- 审批状态
(1040, 1, '已提交', 'submitted', 'approval_status', '', 'info', 'N', '0', 'admin', NOW(), ''),
(1041, 2, '部门审批通过', 'dept_approved', 'approval_status', '', 'primary', 'N', '0', 'admin', NOW(), ''),
(1042, 3, '领导审批中', 'leader_review', 'approval_status', '', 'warning', 'N', '0', 'admin', NOW(), ''),
(1043, 4, '已通过', 'approved', 'approval_status', '', 'success', 'N', '0', 'admin', NOW(), ''),
(1044, 5, '已驳回', 'rejected', 'approval_status', '', 'danger', 'N', '0', 'admin', NOW(), '')
ON DUPLICATE KEY UPDATE dict_label=VALUES(dict_label);

-- 4. 测试用户 (sys_user) - 密码: admin123
INSERT INTO sys_user (user_id, dept_id, user_name, nick_name, user_type, email, phonenumber, sex, password, status, del_flag, create_by, create_time)
VALUES
(10, 100, 'admin', '系统管理员', '00', 'admin@example.com', '', '0', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '0', '0', 'admin', NOW()),
(11, 212, 'zhangsan', '张三', '00', 'zhangsan@example.com', '', '0', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '0', '0', 'admin', NOW()),
(12, 213, 'lisi', '李四', '00', 'lisi@example.com', '', '1', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '0', '0', 'admin', NOW()),
(13, 210, 'wangwu', '王五', '00', 'wangwu@example.com', '', '0', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '0', '0', 'admin', NOW()),
(14, 100, 'zhaoliu', '赵六', '00', 'zhaoliu@example.com', '', '0', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '0', '0', 'admin', NOW())
ON DUPLICATE KEY UPDATE nick_name=VALUES(nick_name);

-- 5. 角色 (sys_role)
INSERT INTO sys_role (role_id, role_name, role_key, role_sort, data_scope, status, del_flag, create_by, create_time, remark)
VALUES
(10, '超级管理员', 'admin', 1, '1', '0', '0', 'admin', NOW(), '系统最高权限'),
(11, '资产管理员', 'asset_manager', 2, '5', '0', '0', 'admin', NOW(), '资产登记和管理'),
(12, '评估师', 'evaluator', 3, '5', '0', '0', 'admin', NOW(), '资产评估执行'),
(13, '部门经理', 'dept_manager', 4, '4', '0', '0', 'admin', NOW(), '审批和部门管理'),
(14, '分管领导', 'leader', 5, '3', '0', '0', 'admin', NOW(), '高级审批')
ON DUPLICATE KEY UPDATE role_name=VALUES(role_name);

-- 6. 用户角色关联 (sys_user_role)
INSERT INTO sys_user_role (user_id, role_id) VALUES
(10, 10), (11, 11), (12, 12), (13, 13), (14, 14)
ON DUPLICATE KEY UPDATE user_id=VALUES(user_id);

-- ============================================================
-- Seed Complete!
-- ============================================================
