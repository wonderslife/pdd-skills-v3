-- ============================================================
-- F-004「全网自动采集与调度」演示数据
-- 用途: 导入后即可用 MOCK_DEMO 适配器离线跑通采集全链路（不发起任何外部请求）。
-- 执行顺序: yq_schema.sql -> yq_dict.sql -> yq_menu.sql -> 本脚本
-- 幂等: 先按主键 DELETE 再 INSERT，可重复执行
-- 说明: 演示渠道 DEMO-NEWS-STATIC 使用的是配置里的示例站点，enabled 后需替换为真实站点
-- ============================================================
SET NAMES utf8mb4;

-- 关键词分组
DELETE FROM yq_keyword_group WHERE group_id = 1761400000000008001;
INSERT INTO yq_keyword_group (group_id, group_name, del_flag, create_dept, create_by, create_time, update_by, update_time)
VALUES (1761400000000008001, '演示关键词组', '0', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL);

-- 关键词
DELETE FROM yq_keyword WHERE keyword_id IN (1761400000000008011, 1761400000000008012, 1761400000000008013, 1761400000000008014);
INSERT INTO yq_keyword (keyword_id, group_id, keyword_text, keyword_type, keyword_category, combo_expression, ref_count, status, del_flag, remark, create_dept, create_by, create_time, update_by, update_time)
VALUES
  (1761400000000008011, 1761400000000008001, '演示企业', 'precise', 'core', NULL, 1, '0', '0', 'F-004 演示关键词（普通词：只检索不过滤）', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL),
  (1761400000000008012, 1761400000000008001, '服务保障', 'fuzzy', 'extended', NULL, 1, '0', '0', 'F-004 演示关键词', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL),
  (1761400000000008013, 1761400000000008001, '(辽宁|沈阳|大连)+(药监局|药品监管)', 'combo', 'core', '(辽宁|沈阳|大连)+(药监局|药品监管)', 1, '0', '0', 'F-004 演示组合关键词：地区组 AND 主题组，只以「药监局/药品监管」2 个主题词发起检索，地区在本地校验', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL),
  (1761400000000008014, 1761400000000008001, '招聘|广告|代理', 'negative', 'core', NULL, 1, '0', '0', 'F-004 演示任务级排除词（keyword_type=negative，经 yq_task_keyword 关联，避免误杀）', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL);

-- 采集渠道 1：本地模拟（离线可跑）
DELETE FROM yq_channel WHERE channel_id = 1761400000000008031;
INSERT INTO yq_channel (channel_id, channel_name, channel_category, channel_domain, adapter_class, collector_id, interval_override, request_interval, concurrency_limit, proxy_group_id, ua_pool_id, fail_rate_threshold, last_collect_time, status, del_flag, remark, create_dept, create_by, create_time, update_by, update_time)
VALUES (1761400000000008031, '本地模拟渠道', 'other', 'mock.yuqing.local', 'MOCK_DEMO', NULL, NULL, 0, 1, NULL, NULL, 30, NULL, '0', '0', 'F-004 离线自测渠道，不发起外部请求', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL);

-- 采集渠道 2：静态新闻站（示例适配器，需替换为真实站点后再启用）
DELETE FROM yq_channel WHERE channel_id = 1761400000000008032;
INSERT INTO yq_channel (channel_id, channel_name, channel_category, channel_domain, adapter_class, collector_id, interval_override, request_interval, concurrency_limit, proxy_group_id, ua_pool_id, fail_rate_threshold, last_collect_time, status, del_flag, remark, create_dept, create_by, create_time, update_by, update_time)
VALUES (1761400000000008032, '示例新闻网站', 'news', 'news.example.com', 'DEMO_NEWS_STATIC', NULL, NULL, 3000, 2, NULL, NULL, 30, NULL, '1', '0', '示例站点适配器，请替换为真实站点并确认合规边界后再启用', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL);

-- 监测任务
DELETE FROM yq_task WHERE task_id = 1761400000000008021;
INSERT INTO yq_task (task_id, task_name, task_type, task_source, collect_strategy, collect_interval, level_rule_id, alert_rule_id, push_rule_id, start_time, end_time, last_schedule_time, status, del_flag, remark, create_dept, create_by, create_time, update_by, update_time)
VALUES (1761400000000008021, '演示舆情监测任务', 'normal', 'pc', 'polling', 180, NULL, NULL, NULL, sysdate(), NULL, NULL, '0', '0', 'F-004 演示任务：180 秒轮询一次', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL);

-- 任务-关键词关联
DELETE FROM yq_task_keyword WHERE id IN (1761400000000008041, 1761400000000008042, 1761400000000008043, 1761400000000008044);
INSERT INTO yq_task_keyword (id, task_id, keyword_id, match_strategy, create_dept, create_by, create_time, update_by, update_time)
VALUES
  (1761400000000008041, 1761400000000008021, 1761400000000008011, 'fuzzy', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL),
  (1761400000000008042, 1761400000000008021, 1761400000000008012, 'fuzzy', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL),
  (1761400000000008043, 1761400000000008021, 1761400000000008013, 'strict', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL),
  (1761400000000008044, 1761400000000008021, 1761400000000008014, NULL, 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL);

-- 任务-渠道关联
DELETE FROM yq_task_channel WHERE id IN (1761400000000008051, 1761400000000008052);
INSERT INTO yq_task_channel (id, task_id, channel_id, override_interval, create_dept, create_by, create_time, update_by, update_time)
VALUES
  (1761400000000008051, 1761400000000008021, 1761400000000008031, 60, 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL),
  (1761400000000008052, 1761400000000008021, 1761400000000008032, NULL, 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL);

-- 关键词引用计数
UPDATE yq_keyword SET ref_count = (SELECT COUNT(*) FROM yq_task_keyword tk WHERE tk.keyword_id = yq_keyword.keyword_id)
WHERE keyword_id IN (1761400000000008011, 1761400000000008012, 1761400000000008013, 1761400000000008014);
