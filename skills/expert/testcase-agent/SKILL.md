---
name: testcase-agent
description: "自动化测试执行专家 - 读取YAML测试用例，通过Chrome DevTools MCP执行E2E测试，生成专业HTML报告。当用户需要执行测试、运行测试、回放测试时调用此技能。支持中文触发：执行测试、运行测试、回放测试、跑一下这个yaml、重放刚才的测试、开始自动化、执行测试用例、运行yaml文件、单步调试、带截图执行、生成测试报告、批量执行测试、并行测试、E2E执行、浏览器自动化执行。"
license: MIT
compatibility: Chrome DevTools MCP + YAML 测试框架
metadata:
  author: "PDD Team"
  version: "1.0.1"
  lastUpdated: "2026-05-08"
  triggers:
    - "/test" | "/replay" | "/execute"
    - "执行测试" | "运行测试" | "回放测试"
    - "跑一下这个yaml" | "重放刚才的测试"
    - "开始自动化" | "E2E执行" | "浏览器自动化"
    - "单步调试" | "带截图执行" | "生成测试报告"
---

# Testcase Agent - 自动化测试执行专家

基于 Chrome DevTools MCP 的 E2E 测试执行引擎。读取 Testcase Modeler 生成的 YAML 用例，通过 CDP 操控浏览器，完成执行、断言验证、错误自愈和报告生成。

**核心能力**: YAML驱动执行(零代码) | 5条铁律保障质量 | 智能元素定位(4级降级) | 自愈机制 | 深度网络校验 | HTML报告(截图/时间线/诊断)

**关系**: Modeler(建模YAML) → Agent(执行)

## 触发条件
**主动触发**: 用户提到执行/运行/回放/跑一下/开始自动化等词，或提供 YAML 路径/内容/Modeler 输出引用时，即使没说"执行测试"也应主动运行。

**中文触发词**: 核心执行(执行测试/运行yaml/回放/重放/跑一下/开始自动化) | 调试报告(单步调试/带截图执行/生成报告) | 批量集成(批量执行/并行测试/CI-CD/Jenkins/夜间回归)

**文件触发**: YAML文件路径(`pdd test replay ./tests/xxx.yaml`) | YAML内容(含test_id:/steps:/action:) | Modeler输出引用

## 五条 Iron Law 铁律
> 完整实现见 `references/iron-rules-detail.md`

**铁律1 状态感知优先**: 执行 steps 前先检查登录状态。读取 context_check→获取页面URL/快照→判断登录(home_indicator)→已登录跳过/未登录执行登录。Session 过期立即停止。
**铁律2 原子化执行**: 每步完成立即三操作: ①截图保存(`step_{N}_{action}_{timestamp}.png`) ②记录响应数据 ③评估断言结果。
**铁律3 深度网络校验**: 提交/删除/上传/导出等改数据操作必须用网络工具监控 API 调用。UI 显示成功但 API 失败→标记 FAILED。
```yaml
assertions:
  - type: toast_visible
    expected: "保存成功"
  - type: network_called   # 网络层强制
    url_pattern: "/api/apply*"
    method: POST
    response_code: 200
```
**铁律4 自愈而非放弃**: 找不到元素时禁止直接报错，启动4级降级:
```
Level1 UID缓存(<1ms,~95%) → Level2 精确语义(~50ms,~80%) → Level3 模糊匹配(~100ms,~65%) → Level4 AI辅助(~500ms-2s,~55%兜底)
```
整体自愈成功率目标>65%。详见 `references/self-healing-strategy.md`
**铁律5 报告完整性**: 必须生成完整 HTML 报告(基本信息/执行摘要/每步记录/失败诊断/统计图表/附录)。输出 `test-results/reports/{test_id}_report_{timestamp}.html`

## 执行流程概览 (5阶段)
```
1. 初始化: 加载YAML/验证结构/加载config/初始化环境变量
2. 状态检测 [铁律1]: 检测登录状态，未登录执行登录
3. 步骤执行 [铁律2] FOR EACH step: 动作解析→元素定位[铁律4]→执行动作→截图记录→断言验证(UI+网络[铁律3])→结果汇总(PASS/FAIL/SKIP/ERROR)
4. 清理: 执行teardown/最终截图/收集网络和控制台日志
5. 报告生成 [铁律5]: 汇总→统计→组装HTML→输出
```

## 快速开始
```bash
# 单个用例
pdd test replay tests/login/portal-login.yaml
pdd test replay tests/login/portal-login.yaml --debug   # 单步调试
# 批量/并行
pdd test replay ./tests/asset-eval/
pdd test replay tests/*.yaml --parallel --max-tabs=3
pdd test replay ./tests/ --rerun-failed
```

## 参考文档索引
| 文档 | 内容 | 适用场景 |
|------|------|---------|
| iron-rules-detail.md | 5条铁律完整实现/代码示例 | 深入理解规则、自定义行为 |
| self-healing-strategy.md | 4级降级/UID缓存/成功失败案例 | 排查元素定位、优化自愈率 |
| error-handling.md | 错误分类/重试策略/处理流程图 | 配置错误处理、分析失败 |
| cli-reference.md | CLI命令/参数/CI-CD示例 | 命令行使用、自动化脚本 |

## 相关资源
- 上游: Testcase Modeler (生成YAML)
- 配置: config/test-actions.yaml, config/cdp-test-config.yaml
- 报告模板: templates/report-template.html

## FAQ
- **如何触发**: 提供 YAML 路径/内容，或说"执行/运行/回放测试"
- **失败排查**: 看 HTML 报告失败详情+诊断，或 --debug 单步
- **提高自愈率**: target 描述准确稳定，定期更新 UID 缓存
- **支持浏览器**: Chromium 内核(Chrome/Edge/Brave)，需开远程调试端口
- **CI/CD集成**: CLI 命令+JUnit XML 输出，见 cli-reference.md

> 版本历史: v1.0.0(774行) → v1.0.1(三层重构<300行,详情移references/)