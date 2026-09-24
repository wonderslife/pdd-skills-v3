<script lang="ts" setup>
definePage({
  style: {
    navigationBarTitleText: '任务管控',
    navigationBarBackgroundColor: '#1677ff',
    navigationBarTextStyle: 'white',
  },
})

/**
 * H5 任务管控（PRD 模块12 验收标准 3、4）
 * 列表 + 发布临时/专项任务（移动端来源自动标记 wecom）+ 补充事件信息
 */
import { ref } from 'vue'
import { onShow, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { listYqTask, updateYqTask } from '@/api/yuqing/task'
import { submitEventSupplement } from '@/api/yuqing/wecom'
import { modal } from '@/plugins'
import { TASK_TYPE_MAP, TASK_SOURCE_MAP, labelOf } from '@/utils/yuqingDict'

const list = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const finished = ref(false)
const pageNum = ref(1)
const pageSize = 10
const keyword = ref('')

/** 补充事件信息弹窗 */
const supplementVisible = ref(false)
const supplementForm = ref({ url: '', remark: '' })
const supplementSubmitting = ref(false)

onShow(() => {
  refresh()
})

onPullDownRefresh(async () => {
  await refresh()
  uni.stopPullDownRefresh()
})

onReachBottom(() => {
  loadMore()
})

async function refresh() {
  pageNum.value = 1
  finished.value = false
  list.value = []
  await load()
}

async function loadMore() {
  if (finished.value || loading.value) return
  pageNum.value += 1
  await load()
}

async function load() {
  if (loading.value) return
  loading.value = true
  try {
    const res: any = await listYqTask({
      pageNum: pageNum.value,
      pageSize,
      taskName: keyword.value || undefined,
    })
    const rows = res?.rows ?? []
    const count = Number(res?.total ?? 0)
    total.value = count
    list.value = pageNum.value === 1 ? rows : [...list.value, ...rows]
    finished.value = list.value.length >= count || rows.length < pageSize
  } catch (e) {
    finished.value = true
  } finally {
    loading.value = false
  }
}

/** 启停切换 —— 与 PC 端状态实时同步（PRD 验收标准 3） */
async function toggleStatus(item: any) {
  const nextStatus = item.status === '0' ? '1' : '0'
  const ok = await modal.confirm(nextStatus === '1' ? '确认停用该任务？' : '确认启用该任务？')
  if (!ok) return
  try {
    await updateYqTask({ taskId: item.taskId, status: nextStatus })
    item.status = nextStatus
    modal.msg('操作成功')
  } catch (e) {
    // 失败提示由请求拦截器统一弹出
  }
}

function goCreate() {
  uni.navigateTo({ url: '/pages/yuqing/task/edit' })
}

function goEdit(item: any) {
  uni.navigateTo({ url: `/pages/yuqing/task/edit?taskId=${item.taskId}` })
}

function goTaskOpinion(item: any) {
  uni.navigateTo({ url: `/pages/yuqing/opinion/index?taskId=${item.taskId}` })
}

function openSupplement() {
  supplementForm.value = { url: '', remark: '' }
  supplementVisible.value = true
}

function closeSupplement() {
  supplementVisible.value = false
}

/** 补充事件信息：链接 + 备注，纳入舆情库同源管理 */
async function submitSupplement() {
  const { url, remark } = supplementForm.value
  if (!url.trim()) {
    modal.msg('请填写舆情链接')
    return
  }
  if (!/^https?:\/\//i.test(url.trim())) {
    modal.msg('链接需以 http:// 或 https:// 开头')
    return
  }
  if (supplementSubmitting.value) return
  supplementSubmitting.value = true
  try {
    await submitEventSupplement({ url: url.trim(), remark: remark.trim() })
    modal.msg('已提交，纳入同源管理')
    supplementVisible.value = false
    refresh()
  } catch (e) {
    // 拦截器已提示
  } finally {
    supplementSubmitting.value = false
  }
}
</script>

<template>
  <view class="page">
    <!-- 搜索 -->
    <view class="search-bar">
      <input
        v-model="keyword"
        class="search-input"
        type="text"
        placeholder="搜索任务名称"
        confirm-type="search"
        @confirm="refresh"
      />
      <text class="search-btn" @click="refresh">搜索</text>
    </view>

    <view class="summary">
      <text class="summary-text">共 {{ total }} 个任务</text>
      <text class="summary-link" @click="openSupplement">+ 补充事件信息</text>
    </view>

    <view v-for="item in list" :key="item.taskId" class="task-card">
      <view class="task-head" @click="goEdit(item)">
        <text class="task-name">{{ item.taskName || '未命名任务' }}</text>
        <text class="task-status" :class="item.status === '0' ? 'on' : 'off'">
          {{ item.status === '0' ? '正常' : '停用' }}
        </text>
      </view>
      <view class="task-meta">
        <text class="meta-item">
          类型：{{ labelOf(TASK_TYPE_MAP, item.taskType) }} · {{ labelOf(TASK_SOURCE_MAP, item.taskSource) }}
        </text>
        <text class="meta-item">关键词：{{ item.keywordCount != null ? item.keywordCount : '-' }}</text>
        <text class="meta-item">结束时间：{{ item.endTime || '常态化' }}</text>
      </view>
      <view class="task-actions">
        <text class="act" @click="goTaskOpinion(item)">看舆情</text>
        <text class="act" @click="goEdit(item)">编辑</text>
        <text class="act" :class="item.status === '0' ? 'danger' : 'primary'" @click="toggleStatus(item)">
          {{ item.status === '0' ? '停用' : '启用' }}
        </text>
      </view>
    </view>

    <view v-if="!list.length && !loading" class="empty">
      <uni-icons type="folder-add" size="46" color="#c0c4cc"></uni-icons>
      <text class="empty-text">暂无任务</text>
    </view>

    <view v-if="list.length && finished" class="load-more"><text class="load-more-text">没有更多了</text></view>
    <view v-if="loading" class="load-more"><text class="load-more-text">加载中...</text></view>

    <!-- 悬浮发布按钮 -->
    <view class="fab" @click="goCreate">
      <uni-icons type="plusempty" size="24" color="#ffffff"></uni-icons>
      <text class="fab-text">发布任务</text>
    </view>

    <!-- 补充事件信息弹窗 -->
    <view v-if="supplementVisible" class="mask" @click="closeSupplement">
      <view class="dialog" @click.stop>
        <view class="dialog-title">补充事件信息</view>
        <input v-model="supplementForm.url" class="dialog-input" type="text" placeholder="舆情链接（http/https）" />
        <textarea v-model="supplementForm.remark" class="dialog-textarea" placeholder="备注说明（选填）" />
        <view class="dialog-btns">
          <button class="dialog-btn cancel" @click="closeSupplement">取消</button>
          <button class="dialog-btn confirm" :loading="supplementSubmitting" @click="submitSupplement">提交</button>
        </view>
      </view>
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

.search-bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  background-color: #ffffff;
  border-radius: 10px;
  padding: 0 14px;
  height: 42px;
}

.search-input {
  flex: 1;
  height: 42px;
  font-size: 14px;
  color: #333333;
}

.search-btn {
  font-size: 14px;
  color: #1677ff;
  padding-left: 12px;
}

.summary {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 12px 2px;

  .summary-text {
    font-size: 13px;
    color: #999999;
  }

  .summary-link {
    font-size: 13px;
    color: #1677ff;
  }
}

.task-card {
  background-color: #ffffff;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.task-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;

  .task-name {
    font-size: 15px;
    font-weight: 600;
    color: #333333;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding-right: 10px;
  }

  .task-status {
    font-size: 11px;
    padding: 2px 9px;
    border-radius: 9px;
    flex-shrink: 0;

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

.task-meta {
  margin-top: 10px;
  display: flex;
  flex-direction: column;

  .meta-item {
    font-size: 13px;
    color: #666666;
    line-height: 22px;
  }
}

.task-actions {
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
  margin-top: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;

  .empty-text {
    margin-top: 12px;
    font-size: 14px;
    color: #999999;
  }
}

.load-more {
  padding: 16px 0;
  text-align: center;

  .load-more-text {
    font-size: 12px;
    color: #b0b0b0;
  }
}

.fab {
  position: fixed;
  right: 20px;
  bottom: calc(24px + env(safe-area-inset-bottom));
  height: 46px;
  padding: 0 20px;
  border-radius: 23px;
  background-color: #1677ff;
  display: flex;
  flex-direction: row;
  align-items: center;
  box-shadow: 0 6px 18px rgba(22, 119, 255, 0.35);

  .fab-text {
    margin-left: 6px;
    font-size: 14px;
    color: #ffffff;
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
  margin-bottom: 16px;
}

.dialog-input {
  height: 40px;
  background-color: #f5f6f8;
  border-radius: 8px;
  padding: 0 12px;
  font-size: 14px;
  color: #333333;
  margin-bottom: 10px;
}

.dialog-textarea {
  width: 100%;
  height: 72px;
  background-color: #f5f6f8;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  color: #333333;
  box-sizing: border-box;
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
