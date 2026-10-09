import request from '@/utils/request'

/**
 * 企业微信网页授权免登
 *
 * 移动端进入应用时携带企业微信回调的 code，由后端换取成员身份并绑定若依账号，
 * 返回若依登录 token 与用户信息。
 *
 * 后端接口属「企业微信端任务管控（PRD 模块12）」待实现清单，落地前本方法会抛错，
 * 页面已做降级：捕获异常后跳转账号密码登录页（/pages/login）。
 *
 * @param {string} code 企业微信网页授权 code
 */
export function wecomAuth(code) {
  return request({
    url: '/yuqing/wecom/auth',
    method: 'get',
    params: { code },
  })
}

/**
 * 校验企业微信授权链接可达性 / 获取应用信息（用于免登入口预检）
 */
export function getWecomAppInfo() {
  return request({
    url: '/yuqing/wecom/appInfo',
    method: 'get',
  })
}

/**
 * 补充事件信息（链接 + 备注），纳入舆情库同源管理
 * PRD 模块12 验收标准 4
 */
export function submitEventSupplement(data) {
  return request({
    url: '/yuqing/wecom/supplement',
    method: 'post',
    data,
  })
}
