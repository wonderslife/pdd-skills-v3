<script lang="ts" setup>
definePage({
  style: {
    navigationBarTitleText: '发布任务',
    navigationBarBackgroundColor: '#1677ff',
    navigationBarTextStyle: 'white',
  },
})

/**
 * H5 任务发布 / 编辑（PRD 模块12 验收标准 3、8）
 * 支持配置：任务名称、关键词组、渠道范围、结束时间；
 * 移动端提交后 taskSource 自动标记为 wecom，并实时同步 PC 端任务列表。
 * 校验与 PC 端一致，失败给出字段级提示。
 */
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { addYqTask, getYqTask, updateYqTask } from '@/api/yuqing/task'
import { listYqKeywordGroup } from '@/api/yuqing/keywordGroup'
import { listYqKeyword } from '@/api/yuqing/keyword'
import { listYqChannel } from '@/api/yuqing/channel'
import { modal } from '@/plugins'
import { TASK_TYPE_MAP, COLLECT_STRATEGY_MAP } from '@/utils/yuqingDict'

const taskId = ref('')
const isEdit = computed(() => Boolean(taskId.value))

const form = ref<any>({
  taskName: '',
  taskType: 'temporary',
  taskSource: 'wecom',
  collectStrategy: 'polling',
  collectInterval: 3600,
  startTime: '',
  endTime: '',
  status: '0',
  remark: '',
})

/** 选中的关键词组 / 渠道 ID */
const selectedGroups = ref<string[]>([])
const selectedChannels = ref<string[]>([])

const groupOptions = ref<any[]>([])
const channelOptions = ref<any[]>([])
const errors = ref<Record<string, string>>({})
const submitting = ref(false)

/** 已挂载详情中的分组/渠道回显用 */
let initialKeywordIds: string[] = []

onLoad(async (options: any) => {
  await Promise.all([loadGroups(), loadChannels()])
  if (options?.taskId) {
    taskId.value = String(options.taskId)
    await loadTask()
  }
  applyInitialSelection()
})

async function loadGroups() {
  try {
    const res: any = await listYqKeywordGroup({ pageNum: 1, pageSize: 200 })
    groupOptions.value = res?.rows ?? []
  } catch (e) {
    groupOptions.value = []
  }
}

async function loadChannels() {
  try {
    const res: any = await listYqChannel({ pageNum: 1, pageSize: 200, status: '0' })
    channelOptions.value = res?.rows ?? []
  } catch (e) {
    channelOptions.value = []
  }
}

async function loadTask() {
  try {
    const res: any = await getYqTask(taskId.value)
    const data = res?.data ?? res ?? {}
    form.value = {
      taskName: data.taskName ?? '',
      taskType: data.taskType ?? 'temporary',
      taskSource: data.taskSource ?? 'wecom',
      collectStrategy: data.collectStrategy ?? 'polling',
      collectInterval: data.collectInterval ?? 3600,
      startTime: data.startTime ?? '',
      endTime: data.endTime ?? '',
      status: data.status ?? '0',
      remark: data.remark ?? '',
    }
    selectedChannels.value = (data.channelList ?? []).map((c: any) => String(c.channelId)).filter(Boolean)
    initialKeywordIds = (data.keywordList ?? []).map((k: any) => String(k.keywordId)).filter(Boolean)
  } catch (e) {
    // 拦截器已提示
  }
}

/** 详情里的关键词 ID 反查所属分组并勾选 */
async function applyInitialSelection() {
  if (!initialKeywordIds.length) return
  try {
    const res: any = await listYqKeyword({ pageNum: 1, pageSize: 500 })
    const rows = res?.rows ?? []
    const set = new Set(initialKeywordIds)
    const gids = new Set<string>()
    rows.forEach((k: any) => {
      if (set.has(String(k.keywordId)) && k.groupId) gids.add(String(k.groupId))
    })
    selectedGroups.value = Array.from(gids)
  } catch (e) {
    // 回显失败不阻塞编辑
  }
}

function toggleGroup(id: string) {
  const arr = selectedGroups.value
  const i = arr.indexOf(id)
  if (i >= 0) arr.splice(i, 1)
  else arr.push(id)
  delete errors.value.keywordGroup
}

function toggleChannel(id: string) {
  const arr = selectedChannels.value
  const i = arr.indexOf(id)
  if (i >= 0) arr.splice(i, 1)
  else arr.push(id)
}

/** 校验（与 PC 端一致） */
function validate(): boolean {
  const e: Record<string, string> = {}
  if (!form.value.taskName || !form.value.taskName.trim()) e.taskName = '请输入任务名称'
  if (!selectedGroups.value.length) e.keywordGroup = '请至少选择一个关键词组'
  if (!selectedChannels.value.length) e.channel = '请至少选择一个采集渠道'
  if (form.value.endTime && form.value.startTime && form.value.endTime < form.value.startTime) {
    e.endTime = '结束时间不能早于开始时间'
  }
  errors.value = e
  if (Object.keys(e).length) {
    modal.msg(Object.values(e)[0])
    return false
  }
  return true
}

/** 按选中分组展开出关键词 ID */
async function buildKeywordList() {
  const res: any = await listYqKeyword({ pageNum: 1, pageSize: 500 })
  const rows = res?.rows ?? []
  const picked = new Set(selectedGroups.value)
  return rows
    .filter((k: any) => picked.has(String(k.groupId)))
    .map((k: any) => ({ keywordId: String(k.keywordId) }))
}

async function handleSubmit() {
  if (submitting.value) return
  if (!validate()) return
  submitting.value = true
  uni.showLoading({ title: '提交中' })
  try {
    const keywordList = await buildKeywordList()
    if (!keywordList.length) {
      uni.hideLoading()
      modal.msg('所选关键词组下暂无关键词')
      return
    }
    const payload: any = {
      ...form.value,
      taskSource: isEdit.value ? form.value.taskSource : 'wecom',
      keywordList,
      channelList: selectedChannels.value.map((id) => ({ channelId: String(id) })),
    }
    if (isEdit.value) payload.taskId = taskId.value
    await (isEdit.value ? updateYqTask(payload) : addYqTask(payload))
    uni.hideLoading()
    modal.msg(isEdit.value ? '已保存并同步至 PC 端' : '任务已发布并同步至 PC 端')
    setTimeout(() => uni.navigateBack(), 600)
  } catch (e) {
    uni.hideLoading()
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="page">
    <view class="card">
      <view class="field">
        <text class="label">任务名称 <text class="req">*</text></text>
        <input v-model="form.taskName" class="input" type="text" placeholder="例如：XX事件专项监测" />
        <text v-if="errors.taskName" class="err">{{ errors.taskName }}</text>
      </view>

      <view class="field">
        <text class="label">任务类型</text>
        <view class="chips">
          <text
            v-for="(label, val) in TASK_TYPE_MAP"
            :key="val"
            class="chip"
            :class="{ active: form.taskType === val }"
            @click="form.taskType = val"
          >
            {{ label }}
          </text>
        </view>
      </view>

      <view class="field">
        <text class="label">采集策略</text>
        <view class="chips">
          <text
            v-for="(label, val) in COLLECT_STRATEGY_MAP"
            :key="val"
            class="chip"
            :class="{ active: form.collectStrategy === val }"
            @click="form.collectStrategy = val"
          >
            {{ label }}
          </text>
        </view>
      </view>

      <view class="field">
        <text class="label">采集间隔（秒）</text>
        <input v-model.number="form.collectInterval" class="input" type="number" placeholder="3600" />
      </view>

      <view class="field">
        <text class="label">结束时间（临时/专项任务）</text>
        <view class="picker-box">
          <picker mode="date" :value="form.endTime" @change="(e: any) => (form.endTime = e.detail.value)">
            <text class="picker-text">{{ form.endTime || '常态化（不设结束时间）' }}</text>
          </picker>
          <text v-if="form.endTime" class="clear" @click="form.endTime = ''">清除</text>
        </view>
        <text v-if="errors.endTime" class="err">{{ errors.endTime }}</text>
      </view>
    </view>

    <view class="card">
      <view class="field">
        <text class="label">关键词组 <text class="req">*</text></text>
        <view v-if="groupOptions.length" class="chips">
          <text
            v-for="g in groupOptions"
            :key="g.groupId"
            class="chip"
            :class="{ active: selectedGroups.includes(String(g.groupId)) }"
            @click="toggleGroup(String(g.groupId))"
          >
            {{ g.groupName }}
          </text>
        </view>
        <text v-else class="hint">暂无可选关键词组，请先在 PC 端维护</text>
        <text v-if="errors.keywordGroup" class="err">{{ errors.keywordGroup }}</text>
      </view>

      <view class="field">
        <text class="label">渠道范围 <text class="req">*</text></text>
        <view v-if="channelOptions.length" class="chips">
          <text
            v-for="c in channelOptions"
            :key="c.channelId"
            class="chip"
            :class="{ active: selectedChannels.includes(String(c.channelId)) }"
            @click="toggleChannel(String(c.channelId))"
          >
            {{ c.channelName }}
          </text>
        </view>
        <text v-else class="hint">暂无可选渠道，请先在 PC 端维护</text>
        <text v-if="errors.channel" class="err">{{ errors.channel }}</text>
      </view>

      <view class="field">
        <text class="label">备注</text>
        <textarea v-model="form.remark" class="textarea" placeholder="选填" />
      </view>
    </view>

    <view class="submit-bar">
      <button class="submit-btn" :loading="submitting" @click="handleSubmit">
        {{ isEdit ? '保存' : '发布任务' }}
      </button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: #f5f6f8;
  padding: 12px 16px calc(90px + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.card {
  background-color: #ffffff;
  border-radius: 12px;
  padding: 6px 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.field {
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;

  &:last-child {
    border-bottom: none;
  }
}

.label {
  font-size: 13px;
  color: #666666;

  .req {
    color: #f56c6c;
  }
}

.input {
  margin-top: 8px;
  height: 40px;
  background-color: #f5f6f8;
  border-radius: 8px;
  padding: 0 12px;
  font-size: 14px;
  color: #333333;
}

.textarea {
  margin-top: 8px;
  width: 100%;
  height: 68px;
  background-color: #f5f6f8;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  color: #333333;
  box-sizing: border-box;
}

.chips {
  margin-top: 10px;
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

.picker-box {
  margin-top: 8px;
  height: 40px;
  background-color: #f5f6f8;
  border-radius: 8px;
  padding: 0 12px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;

  .picker-text {
    font-size: 14px;
    color: #333333;
  }

  .clear {
    font-size: 13px;
    color: #f56c6c;
  }
}

.hint {
  margin-top: 8px;
  font-size: 12px;
  color: #b0b0b0;
}

.err {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: #f56c6c;
}

.submit-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
  background-color: #ffffff;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.04);
}

.submit-btn {
  height: 44px;
  line-height: 44px;
  border-radius: 22px;
  background-color: #1677ff;
  color: #ffffff;
  font-size: 16px;
  border: none;
}
</style>
