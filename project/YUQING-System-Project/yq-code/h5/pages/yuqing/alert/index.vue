<template>
  <view class="page">
    <view class="stat">
      <view class="stat-item">
        <text class="num err">{{ pending.pending }}</text>
        <text class="lbl">未处置</text>
      </view>
      <view class="stat-item">
        <text class="num">{{ pending.processing }}</text>
        <text class="lbl">处置中</text>
      </view>
      <view class="stat-item">
        <text class="num err">{{ pending.highlightPending }}</text>
        <text class="lbl">紧急未处置</text>
      </view>
    </view>

    <view class="filter">
      <picker :range="statusLabels" @change="onStatusChange">
        <view class="picker">{{ statusLabel }}</view>
      </picker>
    </view>

    <view v-if="list.length === 0" class="empty">暂无预警</view>

    <view v-for="item in list" :key="item.alertId" class="card" @click="openProcess(item)">
      <view class="row">
        <text class="title" :class="{ err: item.alertLevel === 'urgent' || item.alertLevel === 'warning' }">{{ item.alertTitle }}</text>
      </view>
      <view class="row meta">
        <text class="tag">{{ levelText(item.alertLevel) }}</text>
        <text class="tag">{{ sceneText(item.triggerScene) }}</text>
        <text class="tag">{{ statusText(item.status) }}</text>
      </view>
      <view class="row">
        <text class="trigger">{{ item.triggerValue }}</text>
      </view>
      <view class="row meta">
        <text>{{ item.triggerTime }}</text>
      </view>
    </view>

    <view v-if="hasMore" class="more" @click="loadMore">加载更多</view>

    <view v-if="showDlg" class="mask" @click="closeDlg">
      <view class="dlg" @click.stop>
        <view class="dlg-title">预警处置</view>
        <view class="dlg-line">{{ current.alertTitle }}</view>
        <view class="dlg-line sub">{{ current.triggerValue }}</view>
        <view class="dlg-label">处置状态</view>
        <view class="status-group">
          <view v-for="s in statusChoices" :key="s.value" class="status-item" :class="{ active: form.status === s.value }" @click="form.status = s.value">
            {{ s.label }}
          </view>
        </view>
        <view class="dlg-label">处置说明（已处置/已忽略必填）</view>
        <textarea v-model="form.processRemark" class="ta" placeholder="请写明具体处置动作或忽略理由" :maxlength="500" />
        <view class="btns">
          <view class="btn" @click="closeDlg">取消</view>
          <view class="btn primary" @click="submit">提交</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { listYqAlert } from '@/api/yuqing/alert';
import { processAlert, alertPendingCount } from '@/api/yuqing/alert/dispatch';

definePage({
  style: {
    navigationBarTitleText: '风险预警'
  }
});

const pending = ref<Record<string, any>>({ pending: 0, processing: 0, highlightPending: 0 });
const list = ref<any[]>([]);
const pageNum = ref(1);
const pageSize = 10;
const hasMore = ref(true);
const showDlg = ref(false);
const current = ref<Record<string, any>>({});
const form = reactive({ alertId: '', status: 'processing', processRemark: '' });

const statusChoices = [
  { label: '处置中', value: 'processing' },
  { label: '已处置', value: 'handled' },
  { label: '已忽略', value: 'ignored' }
];

const statusLabels = ['全部', '未处置', '处置中', '已处置', '已忽略'];
const statusValues = ['', 'pending', 'processing', 'handled', 'ignored'];
const statusIndex = ref(1);
const statusLabel = ref('未处置');

function onStatusChange(e: any) {
  statusIndex.value = Number(e.detail.value);
  statusLabel.value = statusLabels[statusIndex.value];
  pageNum.value = 1;
  list.value = [];
  hasMore.value = true;
  load();
}

function levelText(v: any) {
  const s = String(v);
  return s === 'urgent' ? '紧急' : s === 'warning' ? '预警' : s === 'attention' ? '关注' : '提示';
}

function sceneText(v: any) {
  const s = String(v);
  return s === 'new_negative' ? '新增负面' : s === 'high_risk' ? '高风险' : s === 'burst_increment' ? '突发增量' : s === 'special_topic' ? '重点专项' : s;
}

function statusText(v: any) {
  const s = String(v);
  return s === 'pending' ? '未处置' : s === 'processing' ? '处置中' : s === 'handled' ? '已处置' : s === 'ignored' ? '已忽略' : s;
}

async function load() {
  const res = await listYqAlert({
    pageNum: pageNum.value,
    pageSize,
    status: statusValues[statusIndex.value] || undefined
  });
  const rows = res.data?.rows || [];
  list.value = list.value.concat(rows);
  hasMore.value = rows.length >= pageSize;
}

function loadMore() {
  pageNum.value += 1;
  load();
}

async function loadPending() {
  const res = await alertPendingCount();
  pending.value = res.data || { pending: 0, processing: 0, highlightPending: 0 };
}

function openProcess(item: Record<string, any>) {
  if (item.status === 'handled' || item.status === 'ignored') {
    return;
  }
  current.value = item;
  form.alertId = item.alertId;
  form.status = 'processing';
  form.processRemark = '';
  showDlg.value = true;
}

function closeDlg() {
  showDlg.value = false;
}

async function submit() {
  const need = form.status === 'handled' || form.status === 'ignored';
  if (need && (!form.processRemark || form.processRemark.trim().length < 5)) {
    uni.showToast({ title: '处置说明不少于 5 个字', icon: 'none' });
    return;
  }
  await processAlert({
    alertId: form.alertId,
    status: form.status,
    processRemark: form.processRemark
  });
  uni.showToast({ title: '提交成功', icon: 'success' });
  showDlg.value = false;
  pageNum.value = 1;
  list.value = [];
  hasMore.value = true;
  await load();
  await loadPending();
}

onMounted(() => {
  load();
  loadPending();
});
</script>

<style scoped>
.page {
  padding: 20rpx;
  background: #f5f6fa;
  min-height: 100vh;
}
.stat {
  display: flex;
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx 0;
}
.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.num {
  font-size: 40rpx;
  font-weight: 600;
}
.err {
  color: #f56c6c;
}
.lbl {
  font-size: 24rpx;
  color: #909399;
  margin-top: 8rpx;
}
.filter {
  margin: 20rpx 0;
}
.picker {
  background: #fff;
  border-radius: 10rpx;
  padding: 18rpx 24rpx;
  font-size: 28rpx;
}
.card {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}
.row {
  display: flex;
  align-items: center;
  margin-bottom: 10rpx;
}
.title {
  font-size: 30rpx;
  font-weight: 600;
}
.meta {
  font-size: 24rpx;
  color: #909399;
}
.tag {
  border: 1rpx solid #dcdfe6;
  border-radius: 6rpx;
  padding: 2rpx 10rpx;
  margin-right: 12rpx;
  font-size: 22rpx;
}
.trigger {
  font-size: 26rpx;
  color: #606266;
}
.empty {
  text-align: center;
  color: #909399;
  padding: 80rpx 0;
}
.more {
  text-align: center;
  color: #409eff;
  padding: 24rpx 0;
  font-size: 28rpx;
}
.mask {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}
.dlg {
  width: 620rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
}
.dlg-title {
  font-size: 32rpx;
  font-weight: 600;
  text-align: center;
  margin-bottom: 20rpx;
}
.dlg-line {
  font-size: 28rpx;
  margin-bottom: 10rpx;
}
.dlg-line.sub {
  font-size: 24rpx;
  color: #909399;
}
.dlg-label {
  font-size: 26rpx;
  color: #606266;
  margin: 20rpx 0 10rpx;
}
.status-group {
  display: flex;
}
.status-item {
  flex: 1;
  text-align: center;
  border: 1rpx solid #dcdfe6;
  border-radius: 8rpx;
  padding: 14rpx 0;
  margin-right: 12rpx;
  font-size: 26rpx;
}
.status-item.active {
  border-color: #409eff;
  color: #409eff;
}
.ta {
  width: 100%;
  height: 160rpx;
  border: 1rpx solid #dcdfe6;
  border-radius: 8rpx;
  padding: 14rpx;
  font-size: 26rpx;
  box-sizing: border-box;
}
.btns {
  display: flex;
  margin-top: 26rpx;
}
.btn {
  flex: 1;
  text-align: center;
  border: 1rpx solid #dcdfe6;
  border-radius: 10rpx;
  padding: 18rpx 0;
  margin-right: 16rpx;
  font-size: 28rpx;
}
.btn.primary {
  background: #409eff;
  border-color: #409eff;
  color: #fff;
}
</style>
