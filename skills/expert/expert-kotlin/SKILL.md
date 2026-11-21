---
name: expert-kotlin
description: "Kotlin 语言开发专家。当项目涉及 Kotlin 语法特性、协程结构化并发、Flow 数据流、空安全与 Java 互操作时自动触发。支持中文触发：Kotlin、协程、coroutine、suspend、Flow、StateFlow、空安全。"
license: MIT
compatibility: Kotlin 1.9+ / 2.0+，JVM 与 Android 目标
metadata:
  author: "neuqik@hotmail.com"
  version: "1.0"
  stack: ["kotlin"]
  triggers:
    - "/kotlin" | "/协程"
    - "Kotlin" | "coroutine" | "suspend" | "挂起函数"
    - "Flow" | "StateFlow" | "SharedFlow" | "空安全"
---

# Kotlin 语言开发专家 / Kotlin Language Expert

## 1. 技能概述 / Overview

为 Kotlin 项目提供语言级专家指导，重点覆盖协程结构化并发、Flow 数据流选型、空安全治理与 Java 互操作。本技能与 `expert-jetpack`（平台组件）、`expert-android`（平台基础）互补。

**核心能力**:
- 协程：结构化并发、作用域选型、异常传播、取消语义
- Flow：冷/热流决策、`flowOn`/`buffer`/`conflate`、`stateIn`/`shareIn` 配置
- 空安全：`!!` 治理、平台类型边界、密封类建模
- 语言特性：委托属性、中缀函数、DSL 构建、inline/reified

## 2. 协程审查清单

遇到协程相关代码时按此清单检查：

| # | 检查项 | 判定 |
|---|---|---|
| 1 | 是否使用 `GlobalScope`？ | 一律拒绝 → `viewModelScope` / `lifecycleScope` / 自定义 `CoroutineScope SupervisorJob()` |
| 2 | 挂起函数内是否切调度器？ | IO 操作缺 `withContext(Dispatchers.IO)` → 指出 |
| 3 | 异常是否有边界？ | 根协程缺 `try/catch` 或 `CoroutineExceptionHandler` → 指出 |
| 4 | 是否吞掉 `CancellationException`？ | `catch (e: Exception)` 不再抛出 → 必须修复 |
| 5 | 并发共享状态？ | 可变状态跨协程 → 建议 `Mutex`/`StateFlow`/actor |
| 6 | `runBlocking` 是否出现在生产代码？ | 仅允许在 main/测试入口 |

## 3. Flow 选型决策树

```
需要"当前值"？
├─ 是 → 有多订阅者？
│        ├─ 是 → StateFlow（配置 stateIn(scope, SharingStarted.WhileSubscribed(5000), initial)）
│        └─ 否 → 单次请求用 suspend fun 直接返回；多值累积用 StateFlow
└─ 否 → 事件型？
         ├─ 单次事件（导航/Toast）→ SharedFlow(replay=0, extraBufferCapacity≥1) 或 Channel
         └─ 数据流（逐项处理）→ 冷流 Flow + flowOn(Dispatchers.IO)
```

规则：
- UI 层收集必须 `collectAsStateWithLifecycle()` / `repeatOnLifecycle`
- `flowOn` 只放靠近数据源的末端，禁止在 UI 层 `flowOn`
- 冷流默认惰性；需要共享上游时才 `shareIn`，勿滥用

## 4. 空安全反模式

1. `!!` 非空断言：生产代码中出现即指出，改用 `?.` / `?:` / `requireNotNull` / `lateinit`（限 Android 框架注入点）
2. 平台类型（Java 互操作返回值）：必须显式标注可空性后再使用
3. `as` 强转：用 `as?` + 空分支
4. `lateinit` 判空：用 `::x.isInitialized`，勿 `x != null`（对 lateinit 原始类型字段会 NPE）
5. 可空集合：优先空集合 `emptyList()` 而非 null

## 5. 常用生成模板

### 5.1 带 UI 状态的 ViewModel 数据流

```kotlin
class UserListViewModel(private val repo: UserRepository) : ViewModel() {
    private val _state = MutableStateFlow<UserListState>(UserListState.Loading)
    val state: StateFlow<UserListState> = _state.asStateFlow()

    fun load() = viewModelScope.launch {
        _state.value = UserListState.Loading
        runCatching { repo.fetchUsers() }
            .onSuccess { _state.value = UserListState.Success(it) }
            .onFailure { e -> _state.value = UserListState.Error(e.message ?: "未知错误") }
    }
}
```

### 5.2 安全的挂起函数

```kotlin
suspend fun fetchUser(id: Long): User =
    withContext(Dispatchers.IO) {          // 显式调度器
        api.getUser(id)                     // Retrofit suspend 接口
    }
```

## 6. 与其他技能协作

- Android 生命周期挂接（`viewModelScope`/`repeatOnLifecycle` 细节）→ `expert-jetpack`
- 四大组件与权限模型 → `expert-android`
- ADB/Compose 测试 → `expert-android-test`
- 工程体检（KAPT→KSP 等）→ `pdd config --gradle-doctor`（android-toolchain 插件）
