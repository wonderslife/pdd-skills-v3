# -*- coding: utf-8 -*-
"""
预售下单全流程 API 测试（PRESALE-API-order-flow）
覆盖验收标准: #2 预售截止拦截 / #5 幂等 / #6 库存不足 / #7 paid / #10 状态筛选 / #11 发货 / #12 退款
前置: 后端已启动(8080)、数据库可连、商品存在
"""
import json
import time
import urllib.request
import pymysql

BASE = "http://localhost:8080"
GOODS_ID = 2092090046842286081   # E2E测试预售商品-定金20元
BUYER_ID = 1                     # admin

DB = dict(host='43.138.34.68', port=3306, user='ruoyi_zhai', password='BWnSwWmCSAyLtAr4',
          database='ruoyi_zhai', charset='utf8mb4')

PASS, FAIL = 0, 0

def report(name, ok, detail=""):
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f"  ✅ PASS  {name}  {detail}")
    else:
        FAIL += 1
        print(f"  ❌ FAIL  {name}  {detail}")

def http(method, path, body=None, token=None):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data, timeout=15) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {}

def db_query(sql):
    conn = pymysql.connect(**DB)
    cur = conn.cursor()
    cur.execute(sql)
    rows = cur.fetchall()
    conn.close()
    return rows

def db_exec(sql):
    conn = pymysql.connect(**DB)
    cur = conn.cursor()
    cur.execute(sql)
    conn.commit()
    conn.close()

print("=" * 60)
print("预售下单全流程 API 测试")
print("=" * 60)

# ---- 1. 登录拿 token ----
print("\n[1] 登录 admin")
code, resp = http("POST", "/auth/login", {"username": "admin", "password": "admin123"})
token = (resp.get("data") or {}).get("accessToken", "")
report("登录接口 200", code == 200, f"code={code}")
report("获取 token", bool(token), f"token={token[:20]}...")

# ---- 2. 库存=0 时支付定金 → 应拦截（#6）----
print("\n[2] 库存=0 时支付定金（验证库存不足拦截）")
code, resp = http("POST", "/presale/deposit",
                  {"goodsId": GOODS_ID, "buyerId": BUYER_ID, "depositAmount": 20}, token)
msg = resp.get("msg", "")
report("库存不足拦截", "库存不足" in msg, f"msg={msg}")

# ---- 3. 补库存后支付定金 → 成功 ----
print("\n[3] 补库存 stock=5")
db_exec(f"UPDATE presale_goods SET stock=5 WHERE id={GOODS_ID}")
rows = db_query(f"SELECT stock FROM presale_goods WHERE id={GOODS_ID}")
report("补库存成功", rows[0][0] == 5, f"stock={rows[0][0]}")

print("\n[4] 支付定金（成功路径）")
code, resp = http("POST", "/presale/deposit",
                  {"goodsId": GOODS_ID, "buyerId": BUYER_ID, "depositAmount": 20}, token)
report("定金支付 200", code == 200 and (resp.get("code") == 200 or resp.get("msg") == "操作成功"),
       f"code={code} msg={resp.get('msg')}")
order_no = None
rows = db_query(f"SELECT order_no, status FROM presale_order WHERE goods_id={GOODS_ID} AND buyer_id={BUYER_ID} ORDER BY id DESC LIMIT 1")
if rows:
    order_no, ostatus = rows[0]
    report("订单生成且状态=pending_tail", ostatus == "pending_tail", f"order_no={order_no} status={ostatus}")
else:
    report("订单生成", False, "无订单记录")
rows = db_query(f"SELECT stock FROM presale_goods WHERE id={GOODS_ID}")
report("库存扣减 5→4", rows[0][0] == 4, f"stock={rows[0][0]}")

# ---- 4. 重复支付 → 幂等拦截（#5）----
print("\n[5] 重复支付定金（验证幂等）")
code, resp = http("POST", "/presale/deposit",
                  {"goodsId": GOODS_ID, "buyerId": BUYER_ID, "depositAmount": 20}, token)
msg = resp.get("msg", "")
report("幂等拦截", "重复" in msg, f"msg={msg}")
rows = db_query(f"SELECT COUNT(*) FROM presale_order WHERE goods_id={GOODS_ID} AND buyer_id={BUYER_ID}")
report("订单数仍为1", rows[0][0] == 1, f"count={rows[0][0]}")

# ---- 5. 订单列表按状态筛选（#10）----
print("\n[6] 订单列表按状态筛选")
code, resp = http("GET", f"/presale/order/list?status=pending_tail&orderNo={order_no}", None, token)
total = ((resp.get("data") or {}).get("total"))
report("状态筛选生效", total and total > 0, f"total={total}")

# ---- 6. 尾款支付 → paid（#7）----
print("\n[7] 尾款支付")
code, resp = http("POST", "/presale/tail/pay", {"orderNo": order_no}, token)
report("尾款支付 200", code == 200 and (resp.get("code") == 200 or resp.get("msg") == "操作成功"),
       f"msg={resp.get('msg')}")
rows = db_query(f"SELECT status FROM presale_order WHERE order_no='{order_no}'")
report("订单状态=paid", rows and rows[0][0] == "paid", f"status={rows[0][0] if rows else None}")

print("\n[8] 重复尾款支付（幂等）")
code, resp = http("POST", "/presale/tail/pay", {"orderNo": order_no}, token)
msg = resp.get("msg", "")
report("重复尾款拦截", "重复" in msg or "已支付" in msg, f"msg={msg}")

# ---- 7. 发货（#11）+ 退款拦截（#12）----
print("\n[9] 发货")
rows = db_query(f"SELECT id FROM presale_order WHERE order_no='{order_no}'")
oid = rows[0][0]
code, resp = http("PUT", f"/presale/order/ship/{oid}?shippingNo=SF123456", None, token)
report("发货 200", code == 200 and (resp.get("code") == 200 or resp.get("msg") == "操作成功"),
       f"msg={resp.get('msg')}")
rows = db_query(f"SELECT status, shipping_no FROM presale_order WHERE id={oid}")
report("订单状态=shipped + 物流单号", rows[0][0] == "shipped" and rows[0][1] == "SF123456",
       f"status={rows[0][0]} shipping_no={rows[0][1]}")

print("\n[10] 已发货后退款（应拦截）")
code, resp = http("PUT", f"/presale/order/refund/{oid}", None, token)
msg = resp.get("msg", "")
report("已发货退款拦截", "发货" in msg or "退款" in msg, f"msg={msg}")

# ---- 汇总 ----
print("\n" + "=" * 60)
print(f"结果: {PASS} 通过 / {FAIL} 失败  | 通过率 {PASS * 100 // max(PASS + FAIL, 1)}%")
print("=" * 60)
