---
name: expert-jetpack
description: "Jetpack 与 Compose 专家。当项目涉及 ViewModel/StateFlow 架构、Room 持久化、Navigation 导航、WorkManager 后台任务、Compose UI 与重组性能时自动触发。支持中文触发：Jetpack、Compose、ViewModel、Room、Composable、重组、状态提升。"
license: MIT
compatibility: Jetpack 最新稳定版 / Compose BOM 2024.x / Kotlin 2.0
metadata:
  author: "neuqik@hotmail.com"
  version: "1.0"
  stack: ["android"]
  triggers:
    - "/compose" | "/jetpack"
    - "Jetpack" | "Compose" | "Composable" | "重组"
    - "ViewModel" | "StateFlow" | "Room" | "Navigation" | "WorkManager"
---

# Jetpack 与 Compose 专家 / Jetpack & Compose Expert

## 1. 技能概述 / Overview

为 Android 工程提供 Jetpack 全家桶与 Compose 声明式 UI 的专家指导。本技能承接架构层与 UI 层：ViewModel 数据流、Room 持久化、Navigation 导航、Compose 状态管理与重组性能。语言层问题转 `expert-kotlin`。

**核心能力**:
- ViewModel + StateFlow 单向数据流（UDF）架构
- Compose 状态管理：状态提升、remember/derivedStateOf、副作用 API
- 重组性能：稳定性诊断、@Immutable/@Stable、LazyList 优化
- Room / Navigation / WorkManager / DataStore 落地规范

## 2. 单向数据流（UDF）架构模板

```kotlin
// Screen（无状态 Composable）
@Composable
fun UserListScreen(
    state: UserListState,
    onRefresh: () -> Unit,
    onUserClick: (Long) -> Unit,
    modifier: Modifier = Modifier
) {
    when (state) {
        UserListState.Loading -> LoadingIndicator()
        is UserListState.Success -> UserList(state.users, onRefresh, onUserClick)
        is UserListState.Error -> ErrorRetry(state.message, onRefresh)
    }
}

// 宿主处收集（生命周期感知）
val state by viewModel.state.collectAsStateWithLifecycle()
UserListScreen(state = state, onRefresh = viewModel::load, onUserClick = navToDetail)
```

规则：
- Screen 只收 state + 回调，不持有 ViewModel 引用之外的状态
- 状态提升：共享状态放 ViewModel，纯 UI 临时状态 `rememberSaveable` 留在局部

## 3. Compose 副作用 API 选型

| 场景 | API |
|---|---|
| 首次进入拉取数据 / 组合期挂起任务 | `LaunchedEffect(key)` |
| 值变化后重启效果且需最新值 | `rememberUpdatedState` + LaunchedEffect |
| 非挂起回调（点击计数等） | `remember { ... }` 普通对象，勿用副作用 |
| 一次性事件（Toast/导航） | SharedFlow + `LaunchedEffect` 收集，禁止在组合期直接调用 |
| 组合销毁时清理 | `DisposableEffect` + `onDispose` |

禁用：组合期直接调用 `viewModelScope.launch`、`Toast.show()` 等非幂等操作。

## 4. 重组性能清单

1. 列表项 lambda 稳定：`onClick: (Long) -> Unit` 优于捕获变量的闭包；可 `remember` 提升引用
2. 数据类参数标注 `@Immutable`/`@Stable`，或使用 Kotlinx immutable collections
3. 高频派生计算用 `derivedStateOf`，勿在组合体里直接 filter/sort
4. `LazyColumn` 传 `key = { it.id }`；item 内容稳定避免整屏重组
5. 大状态对象拆分读取：只订阅所需字段的 StateFlow

## 5. Room / Navigation / WorkManager 规范

- Room：DAO 返回 `Flow<List<T>>`；迁移用 `Migration` 对象 + `exportSchema=true`；主线程禁写
- Navigation：路由常量集中定义（`Routes.kt`）；参数类型化（`navArgument("id") { type = NavType.LongType }`）；跨模块路由见 `expert-android` §4
- WorkManager：周期任务最小 15 分钟；约束用 `Constraints`；重试策略 `BackoffPolicy.EXPONENTIAL`

## 6. 与其他技能协作

- Flow/协程语义 → `expert-kotlin`；四大组件/权限 → `expert-android`
- 生命周期审查（RECOMPOSITION_RISK 等规则）→ `pdd verify`
- Compose UI 测试 → `expert-android-test`
