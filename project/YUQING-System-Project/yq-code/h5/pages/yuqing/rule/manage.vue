<script lang="ts" setup>
definePage({
  style: {
    navigationBarTitleText: '规则管控',
    navigationBarBackgroundColor: '#1677ff',
    navigationBarTextStyle: 'white',
  },
})

/**
 * H5 规则管控（PRD 模块12 验收标准 5、10）
 * 移动端调整推送级别 / 频次 / 预警阈值，保存后实时生效并同步 PC 配置页。
 */
import { ref } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { listYqPushRule, updateYqPushRule } from '@/api/yuqing/pushRule'
import { listYqAlertRule, updateYqAlertRule } from '@/api/yuqing/alertRule'
import { modal } from '@/plugins'
import { PUSH_LEVEL_MAP, PUSH_SCENE_MAP, ALERT_LEVEL_MAP, RISK_LEVEL_MAP, labelsOf, labelOf } from '@/utils/yuqingDict'

const tab = ref<'push' | 'alert'>('push')
const pushRules = ref<any[]>([])
const alertRules = ref<any[]>([])
const loading = ref(false)

/** 编辑弹窗（推送规则） */
const pushDialog = ref(false)
const pushForm = ref<any>({})
/** 编辑弹窗（预警规则） */
const alertDialog = ref(false)
const alertForm = ref<any>({})

onShow(() => load())

onPullDownRefresh(async () => {
  await load()
  uni.stopPullDownRefresh()
})

async function load() {
  if (loading.value) return
  loading.value = true
  await Promise.allSettled([loadPush(), loadAlert()])
  loading.value = false
}

async function loadPush() {
  try {
    const res: any = await listYqPushRule({ pageNum: 1, pageSize: 50 })
    pushRules.value = res?.rows ?? []
  } catch (e) {
    pushRules.value = []
  }
}

async function loadAlert() {
  try {
    const res: any = await listYqAlertRule({ pageNum: 1, pageSize: 50 })
    alertRules.value = res?.rows ?? []
  } catch (e) {
    alertRules.value = []
  }
}

function openPushEdit(item: any) {
  pushForm.value = { ...item }
  pushDialog.value = true
}

async function savePush() {
  try {
    await updateYqPushRule(pushForm.value)
    pushDialog.value = false
    modal.msg('已保存并同步 PC 端')
    loadPush()
  } catch (e) {
    // 拦截器已提示
  }
}

async function togglePush(item: any) {
  const next = item.status === '0' ? '1' : '0'
  const ok = await modal.confirm(next === '1' ? '确认停用该推送规则？' : '确认启用该推送规则？')
  if (!ok) return
  try {
    await updateYqPushRule({ ...item, status: next })
    item.status = next
    modal.msg('操作成功')
  } catch (e) {
    // 拦截器已提示
  }
}

function openAlertEdit(item: any) {
  alertForm.value = { ...item }
  alertDialog.value = true
}

async function saveAlert() {
  const f = alertForm.value
  if (f.windowMinutes != null && Number(f.windowMinutes) <= 0) {
    modal.msg('统计时间窗口需大于 0 分钟')
    return
  }
  if (f.countThreshold != null && Number(f.countThreshold) < 0) {
    modal.msg('条数阈值不能为负数')
    return
  }
  try {
    await updateYqAlertRule(f)
    alertDialog.value = false
    modal.msg('已保存并同步 PC 端')
    loadAlert()
  } catch (e) {
    // 拦截器已提示
  }
}

async function toggleAlert(item: any) {
  const next = item.status === '0' ? '1' : '0'
  const ok = await modal.confirm(next === '1' ? '确认停用该预警规则？' : '确认启用该预警规则？')
  if (!ok) return
  try {
    await updateYqAlertRule({ ...item, status: next })
    item.status = next
    modal.msg('操作成功')
  } catch (e) {
    // 拦截器已提示
  }
}
</script>

<template>
  <view class="page">
    <!-- Tab -->
    <view class="tabs">
      <text class="tab" :class="{ active: tab === 'push' }" @click="tab = 'push'">推送规则</text>
      <text class="tab" :class="{ active: tab === 'alert' }" @click="tab = 'alert'">预警阈值</text>
    </view>

    <!-- 推送规则 -->
    <view v-if="tab === 'push'">
      <view v-for="item in pushRules" :key="item.ruleId" class="card">
        <view class="card-head">
          <text class="card-name">{{ item.ruleName || '未命名规则' }}</text>
          <text class="badge" :class="item.status === '0' ? 'on' : 'off'">
            {{ item.status === '0' ? '启用' : '停用' }}
          </text>
        </view>
        <view class="meta">
          <text class="meta-item">推送级别：{{ labelOf(PUSH_LEVEL_MAP, item.pushLevel) }}</text>
          <text class="meta-item">推送场景：{{ labelsOf(PUSH_SCENE_MAP, item.pushScenes) }}</text>
          <text class="meta-item">定时：{{ item.scheduleCron || '即时' }}</text>
          <text class="meta-item">目标：{{ item.targetType || '-' }}</text>
        </view>
        <view class="acts">
          <text class="act" @click="openPushEdit(item)">调整</text>
          <text class="act" :class="item.status === '0' ? 'danger' : 'primary'" @click="togglePush(item)">
            {{ item.status === '0' ? '停用' : '启用' }}
          </text>
        </view>
      </view>
      <view v-if="!pushRules.length" class="empty"><text class="empty-text">暂无推送规则</text></view>
    </view>

    <!-- 预警阈值 -->
    <view v-if="tab === 'alert'">
      <view v-for="item in alertRules" :key="item.ruleId" class="card">
        <view class="card-head">
          <text class="card-name">{{ item.ruleName || '未命名规则' }}</text>
          <text class="badge" :class="item.status === '0' ? 'on' : 'off'">
            {{ item.status === '0' ? '启用' : '停用' }}
          </text>
        </view>
        <view class="meta">
          <text class="meta-item">窗口：{{ item.windowMinutes != null ? item.windowMinutes + ' 分钟' : '-' }}</text>
          <text class="meta-item">条数阈值：{{ item.countThreshold != null ? item.countThreshold : '-' }}</text>
          <text class="meta-item">热度阈值：{{ item.heatThreshold != null ? item.heatThreshold : '-' }}</text>
          <text class="meta-item">最低风险：{{ labelOf(RISK_LEVEL_MAP, item.riskLevelThreshold) }}</text>
          <text class="meta-item">预警级别：{{ labelOf(ALERT_LEVEL_MAP, item.alertLevel) }}</text>
        </view>
        <view class="acts">
          <text class="act" @click="openAlertEdit(item)">调整阈值</text>
          <text class="act" :class="item.status === '0' ? 'danger' : 'primary'" @click="toggleAlert(item)">
            {{ item.status === '0' ? '停用' : '启用' }}
          </text>
        </view>
      </view>
      <view v-if="!alertRules.length" class="empty"><text class="empty-text">暂无预警规则</text></view>
    </view>

    <view class="foot-tip"><text class="foot-text">{{ loading ? '加载中…' : '下拉刷新' }}</text></view>

    <!-- 推送规则编辑 -->
    <view v-if="pushDialog" class="mask" @click="pushDialog = false">
      <view class="dialog" @click.stop>
        <view class="dialog-title">调整推送规则</view>
        <text class="dialog-label">推送级别</text>
        <view class="chips">
          <text
            v-for="(label, val) in PUSH_LEVEL_MAP"
            :key="val"
            class="chip"
            :class="{ active: pushForm.pushLevel === val }"
            @click="pushForm.pushLevel = val"
          >
            {{ label }}
          </text>
        </view>
        <text class="dialog-label">定时批量 cron（留空为即时）</text>
        <input v-model="pushForm.scheduleCron" class="dialog-input" type="text" placeholder="0 0 9 * * ?" />
        <view class="dialog-btns">
          <button class="dialog-btn cancel" @click="pushDialog = false">取消</button>
          <button class="dialog-btn confirm" @click="savePush">保存</button>
        </view>
      </view>
    </view>

    <!-- 预警规则编辑 -->
    <view v-if="alertDialog" class="mask" @click="alertDialog = false">
      <view class="dialog" @click.stop>
        <view class="dialog-title">调整预警阈值</view>
        <text class="dialog-label">统计窗口（分钟）</text>
        <input v-model.number="alertForm.windowMinutes" class="dialog-input" type="number" placeholder="60" />
        <text class="dialog-label">条数阈值</text>
        <input v-model.number="alertForm.countThreshold" class="dialog-input" type="number" placeholder="10" />
        <text class="dialog-label">热度阈值</text>
        <input v-model.number="alertForm.heatThreshold" class="dialog-input" type="number" placeholder="80" />
        <view class="dialog-btns">
          <button class="dialog-btn cancel" @click="alertDialog = false">取消</button>
          <button class="dialog-btn confirm" @click="saveAlert">保存</button>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: #f5f6f8;
  padding: 12px 16px calc(24px + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.tabs {
  display: flex;
  flex-direction: row;
  background-color: #ffffff;
  border-radius: 10px;
  padding: 4px;
  margin-bottom: 12px;
}

.tab {
  flex: 1;
  height: 36px;
  line-height: 36px;
  text-align: center;
  font-size: 14px;
  color: #666666;
  border-radius: 8px;

  &.active {
    color: #ffffff;
    background-color: #1677ff;
  }
}

.card {
  background-color: #ffffff;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.card-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;

  .card-name {
    font-size: 15px;
    font-weight: 600;
    color: #333333;
    flex: 1;
    padding-right: 10px;
  }

  .badge {
    font-size: 11px;
    padding: 2px 9px;
    border-radius: 9px;

    &.on {
      color: #52c41a;
      background-color: rgba(82, 196, 26, 0.12);
    }

    &.off {
      color: #8c8c8c;
      background-color: rgba(140, 140, 140, 0.12);
    }
  }
}

.meta {
  margin-top: 10px;
  display: flex;
  flex-direction: column;

  .meta-item {
    font-size: 13px;
    color: #666666;
    line-height: 22px;
  }
}

.acts {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  flex-direction: row;
  justify-content: flex-end;

  .act {
    font-size: 13px;
    color: #1677ff;
    padding-left: 18px;

    &.danger {
      color: #f56c6c;
    }

    &.primary {
      color: #52c41a;
    }
  }
}

.empty {
  padding: 60px 0;
  text-align: center;

  .empty-text {
    font-size: 14px;
    color: #b0b0b0;
  }
}

.foot-tip {
  padding: 12px 0;
  text-align: center;

  .foot-text {
    font-size: 12px;
    color: #b0b0b0;
  }
}

.mask {
  position: fixed;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.45);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dialog {
  width: 300px;
  background-color: #ffffff;
  border-radius: 12px;
  padding: 20px 16px 16px;
}

.dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: #333333;
  text-align: center;
  margin-bottom: 14px;
}

.dialog-label {
  display: block;
  font-size: 12px;
  color: #999999;
  margin: 10px 0 6px;
}

.dialog-input {
  height: 40px;
  background-color: #f5f6f8;
  border-radius: 8px;
  padding: 0 12px;
  font-size: 14px;
  color: #333333;
}

.chips {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}

.chip {
  font-size: 13px;
  color: #666666;
  background-color: #f5f6f8;
  border-radius: 16px;
  padding: 6px 14px;
  margin: 0 8px 8px 0;
  border: 1px solid transparent;

  &.active {
    color: #1677ff;
    background-color: rgba(22, 119, 255, 0.1);
    border-color: #1677ff;
  }
}

.dialog-btns {
  margin-top: 18px;
  display: flex;
  flex-direction: row;
}

.dialog-btn {
  flex: 1;
  height: 40px;
  line-height: 40px;
  border-radius: 8px;
  font-size: 15px;
  border: none;

  &.cancel {
    margin-right: 10px;
    background-color: #f5f6f8;
    color: #666666;
  }

  &.confirm {
    background-color: #1677ff;
    color: #ffffff;
  }
}
</style>
