<script lang="ts" setup>
definePage({
  style: {
    navigationBarTitleText: '指令交互',
    navigationBarBackgroundColor: '#1677ff',
    navigationBarTextStyle: 'white',
  },
})

/**
 * H5 指令交互（PRD 模块12 验收标准 6）
 * 下达自然语言指令 → 后端解析为任务调取指令 → 回推响应结果 → 记录指令日志。
 */
import { ref, nextTick } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { listYqWecomCommand, addYqWecomCommand } from '@/api/yuqing/wecomCommand'
import { modal } from '@/plugins'
import { COMMAND_TYPE_MAP, EXEC_STATUS_MAP, labelOf } from '@/utils/yuqingDict'

const messages = ref<any[]>([])
const inputText = ref('')
const sending = ref(false)
const scrollTop = ref(0)

/** 快捷指令模板 */
const quickCommands = [
  '生成今日舆情日报',
  '查询近24小时负面舆情',
  '发布XX事件专项采集任务',
  '把高风险舆情推送给值班领导',
  '调整预警阈值为30分钟10条',
]

onLoad(() => {
  loadHistory()
})

async function loadHistory() {
  try {
    const res: any = await listYqWecomCommand({ pageNum: 1, pageSize: 30 })
    const rows = (res?.rows ?? []).slice().reverse()
    messages.value = rows.map(toMessage)
    scrollToBottom()
  } catch (e) {
    messages.value = []
  }
}

function toMessage(row: any) {
  return {
    id: row.commandId,
    role: 'user',
    text: row.commandText,
    commandType: row.commandType,
    execStatus: row.execStatus,
    execResult: row.execResult,
    time: row.execTime || row.createTime,
    pending: false,
  }
}

function scrollToBottom() {
  nextTick(() => {
    scrollTop.value = 999999
  })
}

function pickQuick(text: string) {
  inputText.value = text
}

async function send() {
  const text = (inputText.value || '').trim()
  if (!text) {
    modal.msg('请输入指令内容')
    return
  }
  if (text.length > 500) {
    modal.msg('指令内容不超过 500 字')
    return
  }
  if (sending.value) return
  sending.value = true

  const local: any = { id: `local-${Date.now()}`, role: 'user', text, pending: true, execStatus: 'pending' }
  messages.value.push(local)
  inputText.value = ''
  scrollToBottom()

  try {
    const res: any = await addYqWecomCommand({
      commandText: text,
      commandType: 'query_opinion',
      execStatus: 'pending',
    })
    const data = res?.data ?? res ?? {}
    // 后端同步解析成功时直接回填结果；异步场景由日志刷新补齐
    local.execStatus = data.execStatus || 'success'
    local.execResult = data.execResult || '指令已受理，结果将回推至企业微信'
    local.commandType = data.commandType
    local.pending = false
    messages.value.push({
      id: `reply-${Date.now()}`,
      role: 'bot',
      text: local.execResult,
      commandType: local.commandType,
      execStatus: local.execStatus,
    })
  } catch (e: any) {
    local.pending = false
    local.execStatus = 'failed'
    messages.value.push({
      id: `reply-${Date.now()}`,
      role: 'bot',
      text: e?.msg || '指令下发失败，请稍后重试',
      execStatus: 'failed',
    })
  } finally {
    sending.value = false
    scrollToBottom()
  }
}

function refreshHistory() {
  loadHistory()
  modal.msg('已刷新指令日志')
}
</script>

<template>
  <view class="page">
    <scroll-view class="chat-scroll" scroll-y :scroll-top="scrollTop" :scroll-with-animation="true">
      <view class="intro">
        <text class="intro-text">向数字员工下达自然语言指令，例如「生成今日舆情日报」</text>
      </view>

      <view v-for="m in messages" :key="m.id" class="msg" :class="m.role">
        <view class="bubble" :class="[m.role, m.execStatus === 'failed' ? 'failed' : '']">
          <text class="bubble-text">{{ m.text }}</text>
          <view v-if="m.role === 'user' && m.commandType" class="bubble-tag">
            <text class="tag-text">{{ labelOf(COMMAND_TYPE_MAP, m.commandType) }}</text>
          </view>
          <view v-if="m.execStatus" class="bubble-foot">
            <text class="foot-text">{{ labelOf(EXEC_STATUS_MAP, m.execStatus) }}</text>
          </view>
        </view>
      </view>

      <view v-if="!messages.length" class="empty">
        <uni-icons type="chat" size="44" color="#c0c4cc"></uni-icons>
        <text class="empty-text">暂无指令记录</text>
      </view>
    </scroll-view>

    <view class="quick-bar">
      <scroll-view scroll-x class="quick-scroll">
        <view class="quick-row">
          <text v-for="q in quickCommands" :key="q" class="quick-chip" @click="pickQuick(q)">{{ q }}</text>
        </view>
      </scroll-view>
    </view>

    <view class="input-bar">
      <input
        v-model="inputText"
        class="input"
        type="text"
        placeholder="输入指令…"
        confirm-type="send"
        @confirm="send"
      />
      <text class="refresh" @click="refreshHistory">刷新</text>
      <button class="send-btn" :loading="sending" @click="send">发送</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f5f6f8;
  box-sizing: border-box;
}

.chat-scroll {
  flex: 1;
  padding: 12px 16px 0;
  box-sizing: border-box;
}

.intro {
  padding: 10px 0 14px;
  text-align: center;

  .intro-text {
    font-size: 12px;
    color: #b0b0b0;
  }
}

.msg {
  display: flex;
  flex-direction: row;
  margin-bottom: 14px;

  &.user {
    justify-content: flex-end;
  }

  &.bot {
    justify-content: flex-start;
  }
}

.bubble {
  max-width: 76%;
  padding: 10px 14px;
  border-radius: 12px;

  &.user {
    background-color: #1677ff;
    border-top-right-radius: 4px;
  }

  &.bot {
    background-color: #ffffff;
    border-top-left-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }

  &.failed {
    background-color: rgba(245, 108, 108, 0.12);
  }
}

.bubble-text {
  font-size: 14px;
  line-height: 21px;
  color: #ffffff;

  .bot & {
    color: #333333;
  }
}

.bubble-tag {
  margin-top: 6px;

  .tag-text {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.85);
  }
}

.bubble-foot {
  margin-top: 4px;

  .foot-text {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);

    .bot & {
      color: #999999;
    }
  }
}

.empty {
  padding-top: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;

  .empty-text {
    margin-top: 12px;
    font-size: 14px;
    color: #b0b0b0;
  }
}

.quick-bar {
  background-color: #f5f6f8;
  padding: 8px 0 4px;
}

.quick-scroll {
  white-space: nowrap;
  width: 100%;
}

.quick-row {
  display: flex;
  flex-direction: row;
  padding: 0 12px;
}

.quick-chip {
  flex-shrink: 0;
  font-size: 12px;
  color: #1677ff;
  background-color: rgba(22, 119, 255, 0.08);
  border-radius: 14px;
  padding: 6px 12px;
  margin-right: 8px;
}

.input-bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
  background-color: #ffffff;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.04);
}

.input {
  flex: 1;
  height: 40px;
  background-color: #f5f6f8;
  border-radius: 20px;
  padding: 0 14px;
  font-size: 14px;
  color: #333333;
}

.refresh {
  font-size: 13px;
  color: #8c8c8c;
  padding: 0 10px;
}

.send-btn {
  height: 40px;
  line-height: 40px;
  padding: 0 20px;
  border-radius: 20px;
  background-color: #1677ff;
  color: #ffffff;
  font-size: 14px;
  border: none;
  margin: 0;
}
</style>
