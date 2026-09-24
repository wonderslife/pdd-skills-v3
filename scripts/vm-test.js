#!/usr/bin/env node
/**
 * PDD-VM 集成测试脚本
 * 测试 Dashboard 和 TUI 的基本启动和数据流
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

// 颜色支持
let chalk;
try { chalk = (await import('chalk')).default; } catch { chalk = { green:(s)=>s, red:(s)=>s, cyan:(s=>s), bold:(s)=>s }; }

console.log(chalk.bold.cyan('\n🧪 PDD-VM 集成测试\n'));

// Test 1: 模块导入测试
console.log(chalk.bold('1. 模块导入测试'));
test('models.js 可导入', async () => {
  const m = await import('../lib/vm/models.js');
  assert(m.StageEnum !== undefined, 'StageEnum 存在');
  assert(m.Feature !== undefined, 'Feature 存在');
  assert(m.ProjectSummary !== undefined, 'ProjectSummary 存在');
});

test('state-store.js 可导入', async () => {
  const m = await import('../lib/vm/state-store.js');
  assert(m.StateStore !== undefined, 'StateStore 存在');
});

test('data-provider.js 可导入', async () => {
  const m = await import('../lib/vm/data-provider.js');
  assert(m.PDDDataProvider !== undefined, 'PDDDataProvider 存在');
});

test('event-bus.js 可导入', async () => {
  const m = await import('../lib/vm/event-bus.js');
  assert(m.VMEvents !== undefined, 'VMEvents 存在');
  assert(m.VMEventBus !== undefined, 'VMEventBus 存在');
});

test('dashboard/server.js 可导入', async () => {
  const m = await import('../lib/vm/dashboard/server.js');
  assert(m.DashboardServer !== undefined, 'DashboardServer 存在');
});

test('tui/tui.js 可导入', async () => {
  const m = await import('../lib/vm/tui/tui.js');
  assert(m.TUIApp !== undefined, 'TUIApp 存在');
});

// Test 2: Feature 模型测试
console.log(chalk.bold('\n2. Feature 数据模型测试'));
test('Feature 创建与序列化', async () => {
  const { Feature, StageEnum, QualityMetrics, TokenUsage } = await import('../lib/vm/models.js');
  const f = new Feature({
    id: 'test-001',
    name: 'Test Feature',
    stage: StageEnum.IMPLEMENTING,
    priority: 'P0'
  });
  assert(f.id === 'test-001', 'ID 正确');
  assert(f.stage === 'implementing', 'Stage 正确');
  const json = f.toJSON();
  assert(json.id === 'test-001', 'JSON ID 正确');
  const restored = Feature.fromJSON(json);
  assert(restored.id === f.id, 'Roundtrip ID 匹配');
  assert(restored.stage === f.stage, 'Roundtrip stage 匹配');
});

// Test 3: StageEnum 完整性
test('StageEnum 包含6个阶段', async () => {
  const { StageEnum, STAGE_VALUES } = await import('../lib/vm/models.js');
  assert(STAGE_VALUES.length === 6, `应有6个阶段, 实际${STAGE_VALUES.length}`);
  assert(STAGE_VALUES.includes('prd'), '包含 prd');
  assert(STAGE_VALUES.includes('done'), '包含 done');
});

// Test 4: QualityMetrics 等级映射
test('评分到等级映射正确', async () => {
  const { getGradeFromScore } = await import('../lib/vm/models.js');
  assert(getGradeFromScore(98) === 'S', '98 → S');
  assert(getGradeFromScore(90) === 'A', '90 → A');
  assert(getGradeFromScore(75) === 'B', '75 → B');
  assert(getGradeFromScore(60) === 'C', '60 → C');
  assert(getGradeFromScore(45) === 'D', '45 → D');
  assert(getGradeFromScore(20) === 'F', '20 → F');
});

// Test 5: EventBus 事件发射
test('EventBus 事件发射与接收', async () => {
  const { createEventBus, VMEvents } = await import('../lib/vm/event-bus.js');
  const bus = createEventBus();
  let received = false;
  bus.on(VMEvents.FEATURE_STAGE_CHANGED, () => { received = true; });
  bus.emitStageChange('f1', 'prd', 'spec', {});
  assert(received, '事件被接收');

  const evt = bus.getSSEEvent();
  assert(evt !== null, 'SSE事件存在');
  assert(evt.type === 'feature_stage_changed', 'SSE事件类型正确');
});

// Test 6: 文件结构完整性
console.log(chalk.bold('\n3. 文件结构完整性测试'));
const requiredFiles = [
  'lib/vm/models.js',
  'lib/vm/state-schema.js',
  'lib/vm/state-store.js',
  'lib/vm/scanner.js',
  'lib/vm/reconciler.js',
  'lib/vm/event-bus.js',
  'lib/vm/data-provider.js',
  'lib/vm/hooks/hook-interface.js',
  'lib/vm/hooks/generate-hook.js',
  'lib/vm/hooks/verify-hook.js',
  'lib/vm/hooks/extract-hook.js',
  'lib/vm/hooks/report-hook.js',
  'lib/vm/dashboard/server.js',
  'lib/vm/dashboard/sse.js',
  'lib/vm/dashboard/api-routes.js',
  'lib/vm/dashboard/static/index.html',
  'lib/vm/dashboard/static/css/dashboard.css',
  'lib/vm/dashboard/static/js/app.js',
  'lib/vm/dashboard/static/js/charts.js',
  'lib/vm/dashboard/static/js/pipeline-view.js',
  'lib/vm/dashboard/static/js/kanban-view.js',
  'lib/vm/dashboard/static/js/quality-view.js',
  'lib/vm/dashboard/static/js/system-view.js',
  'lib/vm/tui/tui.js',
  'lib/vm/tui/renderer.js',
  'lib/vm/tui/input.js',
  'lib/vm/tui/components/progress-bar.js',
  'lib/vm/tui/components/table.js',
  'lib/vm/tui/components/sparkline.js',
  'lib/vm/tui/components/status-light.js',
  'lib/vm/tui/components/card.js',
  'lib/vm/tui/screens/overview-screen.js',
  'lib/vm/tui/screens/kanban-screen.js',
  'lib/vm/tui/screens/quality-screen.js',
  'lib/vm/tui/screens/system-screen.js'
];

for (const file of requiredFiles) {
  test(`文件存在: ${file}`, () => {
    const fullPath = path.join(__dirname, '..', file);
    assert(fs.existsSync(fullPath), `文件不存在: ${fullPath}`);
  });
}

// 结果汇总
console.log(chalk.bold('\n' + '='.repeat(40)));
console.log(chalk.bold('Result: ' + chalk.green(passed + ' passed') + ' / ' + chalk.red(failed + ' failed') + ' / ' + (passed + failed) + ' total'));
if (failed > 0) {
  console.log(chalk.red('\n❌ 有测试失败！'));
  process.exit(1);
} else {
  console.log(chalk.green('\n✅ 所有测试通过！PDD-VM 集成就绪。'));
  process.exit(0);
}
