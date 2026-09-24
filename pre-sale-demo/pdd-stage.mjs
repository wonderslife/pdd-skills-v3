#!/usr/bin/env node
/**
 * PDD 阶段推进工具
 * 用法:
 *   node pdd-stage.mjs              查看当前阶段分布
 *   node pdd-stage.mjs spec         全部功能点 -> spec
 *   node pdd-stage.mjs implementing 全部功能点 -> implementing
 *   node pdd-stage.mjs verifying    全部功能点 -> verifying
 *   node pdd-stage.mjs done         全部功能点 -> done
 *   node pdd-stage.mjs done F-101   仅推进指定功能点
 * 阶段顺序: prd < extracted < spec < implementing < verifying < done
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { StateStore } from '../lib/vm/state-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = process.cwd();
const STAGES = ['prd', 'extracted', 'spec', 'implementing', 'verifying', 'done'];

const targetStage = process.argv[2];
const targetId = process.argv[3];

const store = new StateStore(projectRoot, { autoBackup: false });

async function main() {
  const state = await store.loadState();
  const features = state.project.features || [];

  if (!targetStage) {
    // 显示当前阶段分布
    const dist = {};
    features.forEach(f => { dist[f.stage] = (dist[f.stage] || 0) + 1; });
    console.log('\n📊 当前阶段分布:');
    STAGES.forEach(s => console.log(`   ${s.padEnd(12)} ${dist[s] || 0} 个功能点`));
    console.log(`\n共 ${features.length} 个功能点\n`);
    console.log('用法: node pdd-stage.mjs <spec|implementing|verifying|done> [功能点ID]');
    return;
  }

  if (!STAGES.includes(targetStage)) {
    console.error(`无效阶段: ${targetStage}（可选: ${STAGES.join(' / ')}）`);
    process.exit(1);
  }

  const targetIndex = STAGES.indexOf(targetStage);
  let changed = 0;

  for (const f of features) {
    if (targetId && f.id !== targetId) continue;

    const currentIndex = STAGES.indexOf(f.stage);
    // 只允许向前推进，不允许回退（除非显式指定更低阶段）
    if (currentIndex === -1 || currentIndex < targetIndex || targetStage === f.stage) {
      if (f.stage !== targetStage) {
        f.stage = targetStage;
        f.updatedAt = Date.now();
        if (!Array.isArray(f.timeline)) f.timeline = [];
        f.timeline.push({
          stage: targetStage,
          timestamp: Date.now(),
          note: `通过 pdd-stage 工具推进至 ${targetStage}`
        });
        changed++;
        console.log(`  ✓ ${f.id} ${f.name}: ${f.stage} -> ${targetStage}`);
      }
    } else {
      console.log(`  - ${f.id} ${f.name}: 当前 ${f.stage}，已在 ${targetStage} 之后，跳过`);
    }
  }

  if (changed > 0) {
    // 保存（带重试：dashboard 自动刷新可能同时写状态文件，跨进程竞争时重试）
    let saved = false;
    for (let attempt = 0; attempt < 5 && !saved; attempt++) {
      try {
        await store.saveState(state);
        saved = true;
      } catch (saveError) {
        if (attempt < 4) {
          console.log(`  ⚠ 保存冲突（${saveError.message.split(':')[0]}），重试 ${attempt + 1}/4...`);
          await new Promise(resolve => setTimeout(resolve, 800));
        } else {
          console.error(`  ✗ 保存失败: ${saveError.message}`);
          process.exit(1);
        }
      }
    }
    console.log(`\n✅ 已更新 ${changed} 个功能点到 ${targetStage}`);
  } else {
    console.log(`\nℹ️  没有需要更新的功能点`);
  }
}

main().catch(err => {
  console.error('执行失败:', err.message);
  process.exit(1);
});
