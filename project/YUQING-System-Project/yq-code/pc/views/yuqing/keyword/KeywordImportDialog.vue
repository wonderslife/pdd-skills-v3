<template>
  <el-dialog title="导入词表" v-model="visible" width="960px" append-to-body @closed="handleClosed">
    <el-alert type="info" :closable="false" show-icon class="mb8">
      <template #title>
        支持词表格式：段落标记行（<b>样例:</b> / <b>排除:</b>）+ 组合表达式行 + 排除词行。组合表达式内以最后
        一组作为检索词，例如 (辽宁|沈阳)+(药监局|药品) 只会用「药监局/药品」两个词发起检索，地区在本地校验。
      </template>
    </el-alert>

    <el-form label-width="100px" class="mb8">
      <el-form-item label="词表文件">
        <el-upload
          action="#"
          :auto-upload="false"
          :show-file-list="false"
          :on-change="handleFileChange"
          accept=".txt,.csv,.text"
          style="display: inline-block"
        >
          <el-button icon="Upload">选择 .txt 文件</el-button>
        </el-upload>
        <el-button link type="primary" @click="handleClear">清空</el-button>
        <span v-if="fileName" class="file-name">已读取：{{ fileName }}</span>
      </el-form-item>

      <el-form-item label="词表内容">
        <el-input v-model="form.text" type="textarea" :rows="10" placeholder="也可以直接粘贴词表内容" />
      </el-form-item>

      <el-row :gutter="10">
        <el-col :span="8">
          <el-form-item label="绑定任务" label-width="100px">
            <el-select v-model="form.taskId" placeholder="不绑定则只入库" clearable filterable style="width: 100%">
              <el-option v-for="o in taskOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="关键词分组" label-width="100px">
            <el-select v-model="form.groupId" placeholder="默认「词表导入」" clearable filterable style="width: 100%">
              <el-option v-for="o in groupOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="匹配策略" label-width="100px">
            <el-select v-model="form.matchStrategy" placeholder="沿用默认" clearable style="width: 100%">
              <el-option label="严格（必须命中全部词组）" value="strict" />
              <el-option label="宽松（命中任一词组即可）" value="loose" />
              <el-option label="关闭本地匹配（只检索）" value="off" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>

    <div class="mb8">
      <el-button type="primary" icon="View" :loading="parsing" @click="handleParse">解析预览</el-button>
      <el-button type="success" icon="Check" :loading="committing" :disabled="!canCommit" @click="handleCommit">确认导入</el-button>
    </div>

    <template v-if="result">
      <el-alert :type="result.errors.length ? 'error' : 'success'" :closable="false" show-icon class="mb8">
        <template #title>{{ summaryText }}</template>
      </el-alert>

      <el-alert v-if="result.errors.length" type="error" :closable="false" class="mb8">
        <template #title>需修正的问题（{{ result.errors.length }} 条，修正后才能导入）</template>
        <div v-for="(e, i) in result.errors.slice(0, 30)" :key="'e' + i">{{ e }}</div>
        <div v-if="result.errors.length > 30">…… 其余 {{ result.errors.length - 30 }} 条省略</div>
      </el-alert>

      <el-alert v-if="result.warnings.length" type="warning" :closable="false" class="mb8">
        <template #title>提醒（{{ result.warnings.length }} 条，不阻断导入）</template>
        <div v-for="(w, i) in result.warnings.slice(0, 20)" :key="'w' + i">{{ w }}</div>
      </el-alert>

      <el-table :data="previewRows" height="280" border size="small">
        <el-table-column label="行" prop="lineNo" width="60" align="center" />
        <el-table-column label="关键词文本" prop="keywordText" min-width="220" show-overflow-tooltip />
        <el-table-column label="类型" prop="keywordType" width="90" align="center">
          <template #default="scope">
            <el-tag :type="typeTag(scope.row.keywordType)" size="small">{{ typeLabel(scope.row.keywordType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="结构" width="150" align="center">
          <template #default="scope">
            <span v-if="scope.row.keywordType === 'combo'">
              {{ scope.row.groupCount }} 组 / {{ scope.row.wordCount }} 词 / 检索 {{ (scope.row.searchTerms || []).length }}
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="备注" prop="remark" min-width="220" show-overflow-tooltip />
      </el-table>
      <div v-if="result.items.length > previewRows.length" class="table-tip">
        仅展示前 {{ previewRows.length }} 条，共 {{ result.items.length }} 条
      </div>
    </template>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="visible = false">关 闭</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup name="KeywordImportDialog" lang="ts">
import { ref, reactive, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { parseKeywordImport, commitKeywordImport } from '@/api/yuqing/keyword/import';
import type { KeywordImportForm, KeywordImportItem, KeywordImportResult } from '@/api/yuqing/keyword/import';
import { optionselectYqTask } from '@/api/yuqing/task/index';
import { optionselectYqKeywordGroup } from '@/api/yuqing/keywordGroup/index';

const emit = defineEmits(['success']);

const PREVIEW_LIMIT = 200;

const visible = ref(false);
const fileName = ref('');
const parsing = ref(false);
const committing = ref(false);
const result = ref<KeywordImportResult | null>(null);
const taskOptions = ref<Array<{ label: string; value: any }>>([]);
const groupOptions = ref<Array<{ label: string; value: any }>>([]);

const form = reactive<KeywordImportForm>({
  text: '',
  taskId: null,
  groupId: null,
  groupName: null,
  matchStrategy: null
});

const previewRows = computed<KeywordImportItem[]>(() => (result.value ? result.value.items.slice(0, PREVIEW_LIMIT) : []));

const canCommit = computed(() => !!result.value && result.value.errors.length === 0 && result.value.items.length > 0);

const summaryText = computed(() => {
  const r = result.value;
  if (!r) {
    return '';
  }
  if (r.committed) {
    return '导入完成：新增关键词 ' + r.insertedKeywords + ' 条，复用 ' + r.reusedKeywords
      + ' 条，新建任务关联 ' + r.boundRelations + ' 条（已存在跳过 ' + r.skippedRelations + ' 条）。';
  }
  const parts = [
    '解析出 ' + r.items.length + ' 条',
    '组合 ' + r.comboCount,
    '排除 ' + r.negativeCount,
    '普通 ' + r.plainCount
  ];
  if (r.duplicateCount > 0) {
    parts.push('跳过重复 ' + r.duplicateCount);
  }
  if (r.inlineExcludeCount > 0) {
    parts.push('内联排除 ' + r.inlineExcludeCount);
  }
  if (r.searchTermCount > 0) {
    parts.push('预计检索请求 ' + r.searchTermCount + ' 次');
  }
  return parts.join(' · ');
});

function typeLabel(type: string): string {
  if (type === 'combo') {
    return '组合';
  }
  if (type === 'negative') {
    return '排除';
  }
  return '普通';
}

/** el-tag 的 type 只接受这五个字面量，返回 string 会触发 TS2322 */
type TagType = 'primary' | 'success' | 'info' | 'warning' | 'danger';

function typeTag(type: string): TagType {
  if (type === 'combo') {
    return 'primary';
  }
  if (type === 'negative') {
    return 'danger';
  }
  return 'info';
}

async function handleFileChange(uploadFile: any): Promise<void> {
  const raw = uploadFile && uploadFile.raw;
  if (!raw) {
    return;
  }
  try {
    form.text = await raw.text();
    fileName.value = raw.name;
    result.value = null;
  } catch (e) {
    ElMessage.error('文件读取失败，请改用粘贴方式');
  }
}

function handleClear(): void {
  form.text = '';
  fileName.value = '';
  result.value = null;
}

function buildPayload(): KeywordImportForm {
  return {
    text: form.text,
    taskId: form.taskId ?? null,
    groupId: form.groupId ?? null,
    groupName: form.groupName ?? null,
    matchStrategy: form.matchStrategy ?? null
  };
}

async function handleParse(): Promise<void> {
  if (!form.text || !form.text.trim()) {
    ElMessage.warning('请先选择文件或粘贴词表内容');
    return;
  }
  parsing.value = true;
  try {
    const res = await parseKeywordImport(buildPayload());
    result.value = res.data as KeywordImportResult;
  } finally {
    parsing.value = false;
  }
}

async function handleCommit(): Promise<void> {
  if (!form.text || !form.text.trim()) {
    ElMessage.warning('请先选择文件或粘贴词表内容');
    return;
  }
  committing.value = true;
  try {
    const res = await commitKeywordImport(buildPayload());
    result.value = res.data as KeywordImportResult;
    ElMessage.success('导入完成');
    emit('success');
  } finally {
    committing.value = false;
  }
}

function handleClosed(): void {
  result.value = null;
}

async function loadOptions(): Promise<void> {
  if (taskOptions.value.length === 0) {
    const res = await optionselectYqTask({});
    taskOptions.value = (res.data ?? []).map((i: any) => ({ label: i.taskName, value: i.taskId }));
  }
  if (groupOptions.value.length === 0) {
    const res = await optionselectYqKeywordGroup({});
    groupOptions.value = (res.data ?? []).map((i: any) => ({ label: i.groupName, value: i.groupId }));
  }
}

function open(): void {
  visible.value = true;
  loadOptions();
}

defineExpose({ open });
</script>

<style scoped>
.file-name {
  margin-left: 8px;
  color: #909399;
  font-size: 12px;
}
.table-tip {
  margin-top: 6px;
  color: #909399;
  font-size: 12px;
}
</style>
