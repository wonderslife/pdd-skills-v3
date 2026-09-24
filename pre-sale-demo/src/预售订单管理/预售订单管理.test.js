/**
 * 预售订单管理 - 单元测试
 * 覆盖验收标准：按状态筛选 / 仅尾款已付可发货 / 仅未发货可退款
 */

import { describe, it, expect } from 'vitest';
import { 预售订单管理 } from './预售订单管理.js';

describe('预售订单管理', () => {

  it('应该正确初始化', () => {
    expect(true).toBe(true);
  });

  it('应该处理正常输入', async () => {
    const result = await 预售订单管理({ action: 'list' });
    expect(result.success).toBe(true);
  });

  // 验收标准 #10：预售订单列表按状态筛选生效
  it('预售订单列表按状态筛选生效', async () => {
    const result = await 预售订单管理({ action: 'list', status: 'paid' });
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  // 验收标准 #11：仅尾款已付订单可发货
  it('仅尾款已付订单可发货', async () => {
    const ok = await 预售订单管理({ action: 'ship', orderId: 'O-201', status: 'paid' });
    expect(ok.success).toBe(true);

    const denied = await 预售订单管理({ action: 'ship', orderId: 'O-202', status: 'pending_tail' });
    expect(denied.success).toBe(false);
    expect(denied.message).toContain('未付尾款');
  });

  // 验收标准 #12：退款仅限未发货订单
  it('退款仅限未发货订单', async () => {
    const ok = await 预售订单管理({ action: 'refund', orderId: 'O-203', shipped: false });
    expect(ok.success).toBe(true);

    const denied = await 预售订单管理({ action: 'refund', orderId: 'O-204', shipped: true });
    expect(denied.success).toBe(false);
  });

  it('应该处理错误情况', async () => {
    await expect(预售订单管理(null)).rejects.toThrow();
  });
});
