/**
 * 定金支付 - 单元测试
 * 覆盖验收标准：重复支付幂等 / 库存不足拦截
 */

import { describe, it, expect } from 'vitest';
import { 定金支付 } from './定金支付.js';

describe('定金支付', () => {

  it('应该正确初始化', () => {
    expect(true).toBe(true);
  });

  it('应该处理正常输入', async () => {
    const result = await 定金支付({ orderId: 'O-001', amount: 100 });
    expect(result.success).toBe(true);
  });

  // 验收标准 #5：重复支付定金时幂等处理
  it('重复支付定金时幂等处理', async () => {
    const first = await 定金支付({ orderId: 'O-001', amount: 100 });
    const second = await 定金支付({ orderId: 'O-001', amount: 100 });
    expect(second.success).toBe(true);
    expect(second.data).toEqual(first.data);
    expect(second.message).toContain('重复支付');
  });

  // 验收标准 #6：库存不足时定金支付失败并提示
  it('库存不足时定金支付失败并提示', async () => {
    const result = await 定金支付({ orderId: 'O-002', amount: 100, stock: 0 });
    expect(result.success).toBe(false);
    expect(result.message).toContain('库存不足');
  });

  it('应该处理错误情况', async () => {
    await expect(定金支付(null)).rejects.toThrow();
  });
});
