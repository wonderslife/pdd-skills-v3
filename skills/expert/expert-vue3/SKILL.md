---
name: expert-vue3
description: "Vue 3 前端开发专家。当项目涉及 Vue 3 Composition API、Pinia 状态管理、Vue Router 4、Element Plus 组件库时自动触发。支持中文触发：Vue组件、页面开发、前端问题、组件封装、表单校验。"
license: MIT
compatibility: Vue 3 + Element Plus / Ant Design Vue 前端项目
metadata:
  author: "neuqik@hotmail.com"
  version: "1.0"
  triggers:
    - "/vue3" | "/前端"
    - "Vue组件" | "页面开发" | "前端问题" | "组件封装"
    - "Element Plus" | "Pinia" | "Composition API" | "表单校验"
---

# Vue 3 前端开发专家 / Vue 3 Frontend Development Expert

## 1. 技能概述 / Overview

### 🇨🇳 定位
为基于 Vue 3 生态的前端项目提供专家级指导，包括：Composition API 最佳实践、Pinia 状态管理、Vue Router 4 配置、Element Plus / Ant Design Vue 组件深度使用、前端性能优化等。

**核心能力**:
- Composition API（setup、ref/reactive、computed、watch）
- Pinia 状态管理（defineStore、持久化、模块化）
- Vue Router 4（动态路由、导航守卫、keep-alive）
- 组件设计（Props/Emits 类型安全、Slots、Provide/Inject）
- Element Plus 深度使用（表单校验、表格虚拟滚动、Tree 组件）
- 前端工程化（Vite 配置、环境变量、代理配置）

### 🇺🇸 Positioning
Provides expert-level guidance for Vue 3 ecosystem frontend projects, including: Composition API best practices, Pinia state management, Vue Router 4 configuration, Element Plus / Ant Design Vue component deep usage, and frontend performance optimization.

---

## 2. 开发规范 / Development Standards

### 🇨🇳

#### 2.1 Composition API 规范
- 统一使用 `<script setup>` 语法糖
- 响应式数据：基本类型用 `ref()`，对象/数组用 `reactive()`
- 组件暴露方法使用 `defineExpose()`
- Props 使用 `defineProps<T>()` 类型声明
- Emits 使用 `defineEmits<T>()` 类型声明

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';

// Props & Emits
const props = defineProps<{ projectId: number }>();
const emit = defineEmits<{ (e: 'refresh'): void }>();

// Reactive state
const loading = ref(false);
const formRef = ref<FormInstance>();
const formData = reactive({ name: '', status: 'draft' });

// Computed
const isSubmittable = computed(() => formData.name.length > 0);

// Methods
async function handleSubmit() {
  await formRef.value?.validate();
  // ...
}

// Lifecycle
onMounted(() => { loadData(); });
</script>
```

#### 2.2 Pinia 状态管理规范
- Store 文件放在 `src/stores/` 目录
- 命名规范：`use{Module}Store`（如 `useUserStore`）
- 优先使用 Setup Store 语法（更灵活）
- 持久化使用 `pinia-plugin-persistedstate`

#### 2.3 路由配置规范
- 路由配置集中在 `src/router/` 目录
- 动态路由使用懒加载：`() => import('@/views/xxx/index.vue')`
- 页面缓存使用 `<keep-alive>` + `activated()` 钩子
- 路由守卫统一在 `permission.js` 中管理

#### 2.4 组件设计规范
- 业务组件放在 `src/views/{module}/components/`
- 通用组件放在 `src/components/`
- 组件名使用 PascalCase，文件名使用 kebab-case
- 复杂表单抽离为独立组件，通过 Props/Emits 通信

### 🇺🇸

#### 2.1 Composition API Standards
- Use `<script setup>` syntax sugar uniformly
- Reactive data: `ref()` for primitives, `reactive()` for objects/arrays
- Component method exposure via `defineExpose()`
- Props typing with `defineProps<T>()`
- Emits typing with `defineEmits<T>()`

#### 2.2 Pinia State Management Standards
- Store files in `src/stores/` directory
- Naming convention: `use{Module}Store` (e.g., `useUserStore`)
- Prefer Setup Store syntax (more flexible)
- Persistence via `pinia-plugin-persistedstate`

---

## 3. 常见问题模式 / Common Issue Patterns

### 🇨🇳

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 响应式丢失 | 对 reactive 对象进行了解构 | 使用 `toRefs()` 解构，或改用 `ref()` |
| 表单校验不触发 | FormItem 的 `prop` 与 formData 字段名不匹配 | 确保 `prop` 与数据绑定路径完全一致 |
| keep-alive 不缓存 | 组件 name 与路由 meta.title 不匹配 | 确保组件 `defineOptions({ name: 'XxxPage' })` |
| 列表页返回后数据未刷新 | 未实现 `activated()` 钩子 | 在 `onActivated()` 中重新请求数据 |
| Element Plus 样式丢失 | 按需导入配置不完整 | 检查 `unplugin-auto-import` 和 `unplugin-vue-components` 配置 |
| 跨组件状态不同步 | 未使用 Pinia 管理共享状态 | 将共享状态迁移到 Pinia Store |

### 🇺🇸

| Issue | Cause | Solution |
|-------|-------|----------|
| Reactivity lost | Destructured reactive object | Use `toRefs()` for destructuring, or use `ref()` |
| Form validation not triggering | FormItem `prop` doesn't match formData field name | Ensure `prop` matches data binding path exactly |
| keep-alive not caching | Component name doesn't match route meta.title | Set `defineOptions({ name: 'XxxPage' })` |
| List page data not refreshed on return | `activated()` hook not implemented | Request data again in `onActivated()` |

---

## 4. Element Plus 最佳实践 / Element Plus Best Practices

### 🇨🇳

#### 4.1 表格性能优化
- 数据量 > 500 行使用虚拟滚动 `<el-table-v2>`
- 表格列宽使用 `min-width` 而非 `width`
- 复杂渲染列使用 `<template #default="scope">` 避免 `formatter`

#### 4.2 表单校验最佳实践
```javascript
const rules = reactive<FormRules>({
  name: [
    { required: true, message: '请输入名称', trigger: 'blur' },
    { min: 2, max: 50, message: '长度 2-50 个字符', trigger: 'blur' }
  ],
  status: [
    { required: true, message: '请选择状态', trigger: 'change' }
  ]
});
```

#### 4.3 对话框组件封装
- 对话框组件通过 `v-model:visible` 控制显隐
- 关闭时重置表单：`formRef.value?.resetFields()`
- 打开时加载数据：使用 `watch(visible)` 触发

---

## 5. Guardrails

### 🇨🇳 必须遵守
- [ ] 禁止在组件中硬编码状态映射，必须使用统一的 constants.js 或字典管理
- [ ] 表单提交前必须调用 `formRef.value?.validate()`
- [ ] 列表页必须实现 `onActivated()` 钩子用于 keep-alive 场景
- [ ] API 路径必须与后端 Controller 完整路径一致（防止 PATTERN-R008）
- [ ] 文件上传使用若依通用上传组件，不自行实现

### 🇺🇸 Must Follow
- [ ] No hardcoded status mappings in components; use unified constants.js or dictionary management
- [ ] Must call `formRef.value?.validate()` before form submission
- [ ] List pages must implement `onActivated()` hook for keep-alive scenarios
- [ ] API paths must match backend Controller complete paths (prevent PATTERN-R008)
- [ ] File uploads use RuoYi common upload component; do not implement custom upload

---

## 6. 版本历史 / Version History

| 版本 / Version | 日期 / Date | 变更内容 / Changes |
|------|------|---------|
| 1.0 | 2026-04-28 | 初始版本 / Initial version |
