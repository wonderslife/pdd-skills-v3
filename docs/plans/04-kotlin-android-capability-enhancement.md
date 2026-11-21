# pdd-skills-v3 Kotlin 原生 Android 开发能力增强方案

> 版本：v1.1 | 日期：2026-11-21 | 状态：设计评审中
> 目标版本：pdd-skills-v3 3.4.0
> v1.1 变更：补充 §7 使用示例、§8 迁移指南（完整版），原§8 风险与对策顺延为 §9

---

## 1. 背景与目标

### 1.1 现状分析

pdd-skills-v3 当前的能力体系围绕 **Java/Spring Boot 后端 + RuoYi 管理框架 + Vue3 前端** 构建，存在以下硬绑定：

| 层 | 现状 | 硬绑定位置 |
|---|---|---|
| 契约发现 | 默认扫描 `src/main/java` 下的 `*Controller.java` | [lib/contract-discovery/index.js](file:///home/wonder/trae-projects/pdd-skills-v3/lib/contract-discovery/index.js)、[lib/dependency-chain/controller-scanner.js](file:///home/wonder/trae-projects/pdd-skills-v3/lib/dependency-chain/controller-scanner.js) |
| 代码质量 | Linter 注册表仅含 checkstyle/pmd（Java）+ eslint（JS）+ ruff（Python） | [scripts/linter/run-linters.js](file:///home/wonder/trae-projects/pdd-skills-v3/scripts/linter/run-linters.js) |
| 专家技能 | expert-ruoyi / expert-springcloud / expert-activiti 等全部面向 Java 技术栈 | [skills/expert/](file:///home/wonder/trae-projects/pdd-skills-v3/skills/expert/) |
| 测试框架 | Python 驱动的 Web UI 测试，无 ADB/移动端能力 | [tests/](file:///home/wonder/trae-projects/pdd-skills-v3/tests/) |

全仓库检索 `android` / `kotlin` / `adb` 关键词，**零适配代码**，属于全新能力建设。

### 1.2 目标

在不破坏现有 Spring Boot / RuoYi 支持的前提下，为 pdd-skills-v3 增加 **Kotlin 原生 Android 开发全链路支持**，覆盖：

- 语法特性适配（Kotlin 语言、协程、Flow）
- Android 生命周期感知（Activity/Fragment/ViewModel/Compose）
- 组件化开发支持（多 Module、ARouter 风格路由）
- Gradle 构建体系对接（KTS、版本目录、构建变体）

### 1.3 设计原则

1. **零侵入**：现有 Java/RuoYi 链路代码不改语义，只通过扩展点新增能力
2. **插件优先**：Android 能力以独立插件包交付，核心框架仅扩展必要接口
3. **对称设计**：Android 技术栈与 Java 技术栈在能力模型上对齐，降低认知成本
4. **渐进落地**：分四阶段交付，每阶段可独立验收

---

## 2. 总体架构设计

### 2.1 分层架构

```
┌─────────────────────────────────────────────────────────┐
│  技能层（Skills）                                          │
│  ├─ skills/expert/expert-android        （Android 开发专家）│
│  ├─ skills/expert/expert-kotlin         （Kotlin 语言专家） │
│  ├─ skills/expert/expert-jetpack        （Jetpack/Compose）│
│  └─ skills/expert/expert-android-test   （Android 测试）   │
├─────────────────────────────────────────────────────────┤
│  能力适配层（新增 lib/android/）                             │
│  ├─ gradle-inspector    Gradle 工程解析                     │
│  ├─ lifecycle-analyzer  生命周期/组件扫描                    │
│  ├─ kotlin-parser       Kotlin 语法与协程分析               │
│  └─ contract-bridge     前后端契约桥接（Android 侧 DTO）      │
├─────────────────────────────────────────────────────────┤
│  核心框架层（扩展点改造，向后兼容）                             │
│  ├─ lib/contract-discovery   新增 Android 工程类型识别       │
│  ├─ scripts/linter           注册表新增 detekt/ktlint       │
│  ├─ lib/plugin               新增 android-toolchain 插件     │
│  └─ tests/framework          新增 ADB 动作执行器             │
├─────────────────────────────────────────────────────────┤
│  工具链（外部依赖）                                          │
│  Android SDK / Gradle / JDK 17+ / adb / emulator          │
└─────────────────────────────────────────────────────────┘
```

### 2.2 技术栈识别模型（核心扩展点）

新增统一的**工程类型探测器**，替代各处硬编码的 `src/main/java` 判断：

```javascript
// lib/project-type/detector.js（新增）
{
  detect(rootDir) -> {
    type: 'spring-boot' | 'ruoyi' | 'vue3' | 'android-kotlin' | 'android-compose' | 'mixed',
    modules: [...],        // 多模块工程的子模块清单
    buildSystem: 'maven' | 'gradle' | 'gradle-kts',
    confidence: 0.0~1.0
  }
}
```

识别规则（Android 侧）：

| 信号文件 | 判定 |
|---|---|
| `settings.gradle(.kts)` + `AndroidManifest.xml` | Android 工程 |
| `build.gradle.kts` 含 `com.android.application` | App 模块 |
| `build.gradle.kts` 含 `com.android.library` | Library 模块 |
| `build.gradle.kts` 含 `org.jetbrains.compose` | Compose 工程 |
| `libs.versions.toml` | 版本目录（Version Catalog）启用 |

现有 Java 工程识别逻辑**原样保留**，探测器以「先匹配先返回」的顺序注册，Android 规则追加在末尾，保证老工程判定结果不变（向后兼容的关键）。

---

## 3. 能力边界梳理与映射规则

### 3.1 现有能力 → Android 场景映射表

| 现有能力（Java/RuoYi 语境） | Android 语境映射 | 实现方式 |
|---|---|---|
| Controller 扫描（`*Controller.java`） | 页面/路由扫描（Activity/Fragment/Compose Destination） | `lifecycle-analyzer` 新增 `route-scanner` |
| Service/Mapper 依赖链 | Repository/UseCase/ViewModel 依赖链 | `dependency-chain` 增加 `kotlin-resolver` |
| 前后端契约（DTO 生成 TS 类型） | 后端契约 → Kotlin data class / Retrofit 接口 | `contract-bridge` 复用 openapi 解析，输出目标改为 Kotlin |
| RuoYi 菜单/权限路由 | App 页面路由表（ARouter/Navigation Component） | `expert-android` 技能内置模板 |
| checkstyle/pmd 质量检查 | detekt + ktlint + Android Lint | linter 注册表新增三条目 |
| Web UI 自动化测试（Python + Playwright） | App UI 测试（ADB + UiAutomator2/Appium） | `tests/framework` 新增 `adb-executor` |
| 熵减扫描（Java 圈复杂度等） | Kotlin 函数复杂度、Composable 重组开销 | `entropy_scan.py` 增加 `.kt` 解析器 |

### 3.2 能力边界（明确不做什么）

为保证范围可控，以下**不在本期范围**：

- ❌ Kotlin Multiplatform（KMP）跨端共享——仅预留探测字段，不实现
- ❌ Flutter/React Native 等跨端框架
- ❌ NDK/C++ 原生开发
- ❌ Android 车载/手表/TV 变体的专属适配（复用手机链路即可）
- ❌ 热修复/插件化运行时框架（RePlugin/Tinker）适配

### 3.3 Android 专属新增能力

| 能力 | 说明 | 载体 |
|---|---|---|
| 协程安全审查 | 检测 `GlobalScope` 滥用、挂起函数上下文切换缺失、Flow 冷流泄漏 | `expert-kotlin` + detekt 规则包 |
| Flow 最佳实践 | `StateFlow`/`SharedFlow` 选型、`flowOn`、`collectAsStateWithLifecycle` | `expert-kotlin` |
| 生命周期集成 | 生成代码自动挂接 `viewModelScope`/`lifecycleScope`，杜绝裸 `launch` | `lifecycle-analyzer` + 代码模板 |
| Compose 规范 | 状态提升、副作用 API（`LaunchedEffect`/`rememberUpdatedState`）、重组性能 | `expert-jetpack` |
| Gradle 体检 | 依赖冲突、版本目录一致性、构建变体配置、KAPT→KSP 迁移检查 | `gradle-inspector` |
| 组件化支持 | 模块依赖图生成、接口下沉检查、跨模块路由声明校验 | `gradle-inspector` |

---

## 4. 模块详细设计

### 4.1 skills 层（4 个新技能）

#### 4.1.1 `expert-kotlin`（Kotlin 语言专家）

`_meta.json` 遵循现有规范（参考 [expert-ruoyi/_meta.json](file:///home/wonder/trae-projects/pdd-skills-v3/skills/expert/expert-ruoyi/_meta.json)）：

```json
{
  "name": "expert-kotlin",
  "version": "1.0.0",
  "description": "Kotlin 语言专家：协程、Flow、空安全、委托、DSL 等语法特性指导与代码审查",
  "triggers": ["/kotlin", "Kotlin", "协程", "coroutine", "Flow", "suspend", "StateFlow"],
  "stack": ["kotlin"],
  "license": "MIT"
}
```

`SKILL.md` 核心内容域：
- 协程结构化并发审查清单（`GlobalScope` / 未捕获异常 / 取消传播）
- Flow 冷/热流选型决策树
- 空安全反模式（`!!` 滥用、平台类型）
- 与 Java 互操作注意事项

#### 4.1.2 `expert-android`（Android 平台专家）

能力域：四大组件生命周期、权限模型（运行时权限）、`AndroidManifest` 配置审查、组件化架构（模块拆分策略）、资源与适配（dimen/多语言/深色模式）。

触发词：`/android`、`Activity`、`Fragment`、`生命周期`、`AndroidManifest`、`组件化`。

#### 4.1.3 `expert-jetpack`（Jetpack/Compose 专家）

能力域：ViewModel/LiveData/StateFlow、Room、WorkManager、Navigation、Compose UI 与状态管理、性能分析（Baseline Profile、重组计数）。

触发词：`/compose`、`Jetpack`、`ViewModel`、`Room`、`Composable`、`重组`。

#### 4.1.4 `expert-android-test`（Android 测试专家）

能力域：JUnit5 + Turbine（Flow 测试）、Compose UI Test、Robolectric、ADB 自动化脚本、Monkey/稳定性测试接入。

### 4.2 能力适配层（lib/android/）

#### 4.2.1 `gradle-inspector`

职责：解析 Android 工程的构建配置，产出结构化工程模型。

接口定义：

```javascript
// lib/android/gradle-inspector/index.js
module.exports = {
  /**
   * 解析工程，返回模型
   * @param {string} rootDir 工程根目录
   * @returns {Promise<GradleProject>}
   * GradleProject = {
   *   modules: [{ name, type: 'app'|'library'|'kotlin',
   *               dependencies: [...], buildVariants: [...] }],
   *   versionCatalog: Map<string,string>,   // libs.versions.toml
   *   agpVersion: string,                    // Android Gradle Plugin 版本
   *   composeEnabled: boolean,
   *   kaptUsage: string[]                    // 仍使用 KAPT 的模块（KSP 迁移候选）
   * }
   */
  async inspect(rootDir) {},

  /** 依赖冲突与版本目录一致性体检报告 */
  async diagnose(model) { /* -> { issues: [...], score: 0~100 } */ }
}
```

实现策略：优先调用 `./gradlew -q :module:dependencies --configuration releaseRuntimeClasspath`（准确）；Gradle 不可用时降级为静态解析 `build.gradle.kts`（快速、离线可用）。两种模式在报告中标明数据来源。

#### 4.2.2 `lifecycle-analyzer`

职责：扫描 Kotlin 源码，识别生命周期组件与路由入口。

```javascript
module.exports = {
  /** 扫描页面/组件，对齐 controller-scanner 的输出契约 */
  async scanRoutes(rootDir) {
    // -> [{ route, componentType: 'activity'|'fragment'|'composable',
    //       file, lifecycleOwner: bool }]
  },

  /** 生命周期安全审查：裸 launch、非 lifecycle 作用域、未取消订阅 */
  async audit(rootDir) {
    // -> [{ file, line, rule: 'GLOBAL_SCOPE'|'BARE_LAUNCH'|'LEAK_RISK', severity }]
  }
}
```

输出契约**刻意对齐** [controller-scanner.js](file:///home/wonder/trae-projects/pdd-skills-v3/lib/dependency-chain/controller-scanner.js) 的返回结构，使上层 `dependency-chain` 无需感知语言差异（多态替换）。

#### 4.2.3 `kotlin-parser`

职责：Kotlin 源码轻量解析（不引入完整编译器），供复杂度统计、导入分析、挂起函数识别使用。基于正则 + 括号匹配的容错解析，与现有 `entropy_scan.py` 的 Java 解析思路一致；后续可无缝替换为 tree-sitter-kotlin。

#### 4.2.4 `contract-bridge`

职责：复用现有 `contract-discovery` 的 OpenAPI 解析结果，将输出目标从 TS 类型扩展为 Kotlin 产物：

```
OpenAPI schema ──┬─→ TS interface（现有，不动）
                 └─→ Kotlin data class + Retrofit interface（新增）
```

生成模板示例：

```kotlin
// 由 pdd contract-bridge 生成，勿手工修改
@JsonClass(generateAdapter = true)
data class UserDTO(
  val id: Long,
  val name: String,
  @Json(name = "avatar_url") val avatarUrl: String? = null
)

interface UserApi {
  @GET("/system/user/{id}")
  suspend fun getUser(@Path("id") id: Long): ApiResult<UserDTO>
}
```

序列化库可选（Moshi / kotlinx.serialization / Gson），通过 `pdd.config` 的 `android.serializer` 字段配置，默认 Moshi。

### 4.3 核心框架层扩展点改造

改造原则：**只加接口，不改语义**。共 4 处：

| # | 位置 | 改造内容 | 兼容性保证 |
|---|---|---|---|
| 1 | `lib/contract-discovery/index.js` | 目录默认值由常量改为从 `project-type/detector` 获取 | Java 工程探测结果与现状逐字节一致 |
| 2 | `scripts/linter/run-linters.js` 注册表 | 新增 `detekt`、`ktlint`、`android-lint` 三个注册项 | 未检测到 Android 工程时不注册、不执行 |
| 3 | `lib/plugin/` | 新增官方插件 `android-toolchain`（plugin.json 声明 `hooks: ["pre-verify","post-generate"]`） | 插件为可选包，缺失时框架行为不变 |
| 4 | `tests/framework/`（Python） | 新增 `adb_executor.py`，与 `action_executor.py` 平级 | 现有 Web 动作链路不引用新模块 |

`android-toolchain` 插件的 plugin.json：

```json
{
  "name": "android-toolchain",
  "version": "1.0.0",
  "description": "Android 工具链插件：Gradle 体检、构建变体感知、ADB 桥接",
  "main": "index.js",
  "hooks": ["pre-verify", "post-generate"],
  "pdd": ">=3.4.0"
}
```

### 4.4 测试框架扩展

在 [tests/framework/](file:///home/wonder/trae-projects/pdd-skills-v3/tests/framework/) 下新增：

| 文件 | 职责 |
|---|---|
| `adb_executor.py` | ADB 命令封装：tap/swipe/input、截图、设备列表、应用启停 |
| `ui_selector.py` | UiAutomator selector 与 YAML 用例 DSL 的映射（复用现有 yaml_loader） |
| `android_run.py` | App 用例执行入口，复用现有用例模型与报告格式 |

用例 DSL 与现有 Web 用例保持同构，差异仅在 action 命名空间：

```yaml
case: 登录页-错误密码提示
steps:
  - action: adb.tap
    selector: { resourceId: "com.demo:id/et_username" }
  - action: adb.input
    text: "testuser"
  - action: ui.assert_text
    selector: { textContains: "密码错误" }
```

---

## 5. 落地实施路径

### 5.1 分阶段计划

| 阶段 | 版本 | 交付物 | 里程碑出口标准 |
|---|---|---|---|
| **P1 探测与解析** | 3.4.0-alpha | `project-type/detector`、`gradle-inspector`（静态解析模式）、`kotlin-parser` 初版 | 3 个示例工程识别准确率 100%；Java 工程回归零差异 |
| **P2 技能与检查** | 3.4.0-beta | 4 个 expert 技能、detekt/ktlint 注册、`lifecycle-analyzer` | 技能触发命中率 ≥90%；linter 在示例工程产出有效报告 |
| **P3 契约与测试** | 3.4.0-rc | `contract-bridge`、ADB 测试框架、`android-toolchain` 插件 | 契约生成代码可编译；ADB 用例在模拟器跑通 |
| **P4 打磨与验收** | 3.4.0 | 文档、示例工程、性能调优、向后兼容审计 | 通过第 6 节全部验收标准 |

### 5.2 测试验证标准

1. **单元测试**：`lib/android/` 与探测器模块，覆盖率 ≥80%（对齐现有 lib 标准）
2. **回归测试**：每次发版执行全量 Java/RuoYi 示例工程链路，`git diff` 对比输出与基线零差异
3. **集成测试**：CI 中跑 Android 模拟器（API 30/34 双版本），执行 10 条 ADB 冒烟用例
4. **契约测试**：同一 OpenAPI 输入，TS 产物与现状一致；Kotlin 产物通过 kotlinc 编译校验

### 5.3 文档配套规范

| 文档 | 位置 | 要求 |
|---|---|---|
| 使用指南 | `docs/android/getting-started.md` | 从零创建 Android 工程到首次生成代码全流程 |
| 迁移指南 | `docs/android/migration-from-java-stack.md` | 面向现有 Java 用户的差异对照 |
| 技能说明 | 各 skill 目录内 `SKILL.md` | 遵循现有 front matter 规范 |
| 插件开发 | `docs/android/plugin-dev.md` | 如何基于 `android-toolchain` 模式扩展 |

### 5.4 示例工程要求

新建 `examples/android-demo/`（不入 npm 发布包，进 `.npmignore`）：

- **单模块 Compose 应用**：登录 + 列表 + 详情三页面，Retrofit 对接公开 API
- **组件化应用**：app + feature-home + feature-user + core-network 四模块，演示路由表生成
- 两份工程均须：detekt/ktlint 零告警通过、pdd 全链路（spec → generate → verify）跑通、附 README 录屏/GIF

---

## 6. 验收标准

### 6.1 功能性

- [ ] `pdd init` 在 Android 工程根目录正确识别类型并生成 Android 版 `.pdd/config`
- [ ] `pdd generate` 输出的 Kotlin 代码（含协程、ViewModel）通过 `./gradlew assembleDebug` 编译
- [ ] 生命周期审查能检出预埋的 8 类反模式（GlobalScope、裸 launch、回调泄漏等），检出率 100%
- [ ] 契约桥接生成的 Retrofit 接口与后端实际返回结构字段级一致

### 6.2 兼容性（红线）

- [ ] 在既有 Spring Boot / RuoYi 测试工程上执行全链路，输出与 3.3.x 版本**逐字节一致**
- [ ] 未安装 Android SDK 的机器上，所有非 Android 命令行为不变、无新增报错
- [ ] npm 包体积增长 ≤15%（Android 大体积资产走按需下载，不进包）

### 6.3 易用性

- [ ] Android 工程首次接入 ≤5 条命令完成
- [ ] 技能触发：输入"帮我写一个 Compose 列表页"自动命中 `expert-jetpack`
- [ ] 报错信息含可操作指引（如缺 SDK 时提示 `sdkmanager` 安装命令）

### 6.4 性能

- [ ] 静态解析模式下，`gradle-inspector` 对 20 模块工程解析 ≤10s
- [ ] `lifecycle-analyzer` 全量扫描 500 个 .kt 文件 ≤15s
- [ ] 增量场景（仅变更 5 个文件）验证链路 ≤5s（复用现有 lib/cache 机制）

### 6.5 稳定性

- [ ] CI 连续 30 次全量构建零 flake
- [ ] ADB 用例在模拟器冷启动场景成功率 ≥95%（含设备就绪等待重试）

---

## 7. Android 工程使用示例

> 本章为方案内嵌示例，3.4.0 发布时拆分为 `docs/android/getting-started.md` 与各技能 `SKILL.md` 的内置示例。
> 所有命令均为 pdd 真实 CLI（见 bin/pdd.js），Android 侧行为为 3.4.0 新增。

### 7.1 场景一：全新 Compose 工程从零接入（对应验收 §6.3「≤5 条命令」）

前置：Android Studio 已创建空 Compose 工程（或从模板 clone），机器已装 JDK 17+ 与 Android SDK。

```bash
cd ~/work/MyComposeApp

# ① 工程识别 + 初始化配置（自动探测 Compose/版本目录/AGP 版本）
pdd init .
# ✔ 检测到 Android 工程 (android-compose)
# ✔ 模块: app (application) | core-network (library) | feature-login (library)
# ✔ AGP 8.5.2 | Kotlin 2.0.21 | Compose Compiler 已启用 | Version Catalog: libs.versions.toml
# ✔ 已生成 .pdd/config（android.serializer=moshi, test.target=adb）
# ✔ 已注册 linter: detekt / ktlint / android-lint

# ② 生成功能规格（或直接对话触发 expert-jetpack）
pdd generate
# ✔ 产出 openspec/changes/add-user-list/（含 Compose 页面拆解建议）

# ③ 实现代码后验证（编译 + 生命周期审查 + linter 一站式）
pdd verify
# ✔ ./gradlew assembleDebug 通过 (42s)
# ✔ lifecycle-analyzer: 0 错误 / 2 警告（见下）
# ✔ detekt: 0 issues | ktlint: 0 issues

# ④ 质量报告
pdd report
```

`pdd verify` 生命周期审查输出示例：

```
android/lifecycle-audit
├─ [ERROR] feature-login/LoginViewModel.kt:31  GLOBAL_SCOPE
│          使用了 GlobalScope.launch —— 请改为 viewModelScope.launch
├─ [WARN]  feature-login/LoginScreen.kt:58     RECOMPOSITION_RISK
│          Composable 参数 stableType 建议使用 @Immutable 标注
└─ 统计: 3 个文件扫描, 1 错误 / 2 警告 (耗时 1.2s, 静态解析模式)
```

### 7.2 场景二：契约桥接（后端 OpenAPI → Kotlin DTO + Retrofit）

Java 后端（Spring Boot）与 Android 客户端共存的混合工程，在仓库根目录执行：

```bash
pdd contract -d .
# 契约发现（自动探测）:
#   后端: server/src/main/java  → 34 个 Controller, 128 个端点
#   移动端: app/src/main/kotlin → 已生成 32 个 DTO, 待同步 2 个端点
#
# 输出: .pdd/contracts/contract-report.json
#   ├─ kotlin/com/example/app/api/dto/UserDTO.kt        (新增)
#   ├─ kotlin/com/example/app/api/UserApi.kt            (新增, 含 suspend 函数)
#   └─ ts/src/api/types.ts                              (既有, 行为不变)
```

生成产物示例（`android.serializer=moshi`）：

```kotlin
// app/src/main/kotlin/com/example/app/api/dto/UserDTO.kt
// 由 pdd contract-bridge 生成，勿手工修改；重新生成: pdd contract -d .
@JsonClass(generateAdapter = true)
data class UserDTO(
  val id: Long,
  val name: String,
  @Json(name = "avatar_url") val avatarUrl: String? = null
)

// app/src/main/kotlin/com/example/app/api/UserApi.kt
interface UserApi {
  @GET("/system/user/{id}")
  suspend fun getUser(@Path("id") id: Long): ApiResult<UserDTO>

  @GET("/system/user/list")
  suspend fun listUsers(@Query("pageNum") page: Int = 1): ApiResult<PageResult<UserDTO>>
}
```

### 7.3 场景三：组件化工程的路由表与影响面分析

组件化工程（app + feature-* + core-*）下：

```bash
# 路由表：扫描 Activity/Fragment/Composable Destination，对齐 RuoYi 菜单表习惯
pdd scan
# 路由清单:
#   main            → MainActivity            (app)
#   login           → LoginActivity           (feature-login)
#   user/detail/:id → UserDetailActivity      (feature-user)  [需要登录态]
#   home/feed       → HomeFeedRoute           (feature-home, Compose Navigation)
# ⚠ ARouter 声明 "/user/detail" 的路径参数缺失 @Named("id") 注解

# 改动影响面：修改 core-network 的 Retrofit 模块前，先看谁依赖它
pdd impact core-network/src/main/kotlin/.../RetrofitModule.kt
# 直接依赖: feature-user(3 文件), feature-home(2 文件), app(1 文件)
# 建议回归: user 相关 ADB 用例 4 条 + 首页信息流用例 2 条
```

### 7.4 场景四：ADB 自动化测试

用例文件与现有 Web 用例同构（复用 yaml_loader），仅 action 命名空间不同：

```yaml
# tests/cases/android/login_error.yaml
case: 登录页-错误密码提示
app: com.example.mycomposeapp
steps:
  - action: adb.launch            # 启动 App 并等待首帧
  - action: adb.tap
    selector: { resourceId: "com.example.mycomposeapp:id/et_username" }
  - action: adb.input
    text: "testuser"
  - action: adb.tap
    selector: { resourceId: "com.example.mycomposeapp:id/btn_login" }
  - action: ui.assert_text        # Compose 语义树断言
    selector: { textContains: "密码错误" }
  - action: adb.screenshot
    save: login_error.png
```

执行（复用现有报告格式）：

```bash
python tests/android_run.py --case tests/cases/android/ --serial emulator-5554
# ✓ login_error        2.3s
# ✓ login_success      3.1s
# 2 passed, 0 failed (设备: emulator-5554, API 34)
```

### 7.5 场景五：技能对话

```text
用户: 帮我写一个 Compose 列表页，数据来自 /system/user/list 接口，支持下拉刷新
命中: expert-jetpack (triggers: Compose/列表) + contract-bridge (识别到 /system/user/list 契约)
产出: UserListScreen.kt (LazyColumn + PullToRefresh + collectAsStateWithLifecycle)
      UserListViewModel.kt (viewModelScope + StateFlow + flowOn(Dispatchers.IO))
      同时复用 §7.2 已生成的 UserApi，不重复造 DTO

用户: 这个 suspend 函数里为什么要 withContext(Dispatchers.IO)？
命中: expert-kotlin (triggers: suspend)
行为: 结合当前文件逐行解释调度器语义，并指出项目中 2 处同类缺失
```

### 7.6 场景六：Gradle 体检（gradle-inspector）

```bash
pdd config --gradle-doctor        # 或由 android-toolchain 插件在 pre-verify 钩子自动执行
# Gradle 体检报告 (静态解析, 6.8s):
#   评分 82/100
#   [HIGH]   module "feature-pay" 依赖 dagger:2.48 仍用 KAPT —— 建议 KSP 迁移 (预计 -18% 构建时间)
#   [MEDIUM] libs.versions.toml 缺少 room-version，3 处 build.gradle.kts 硬编码 2.6.1
#   [MEDIUM] app/buildVariants 存在 dev/prod，但 core-network 未声明 matchingFallbacks
#   [LOW]    2 个传递依赖版本冲突: okhttp 4.12.0 vs 4.11.0 (已被 Gradle 解析为 4.12.0)
```

---

## 8. 迁移指南

### 8.1 现有 Java / RuoYi 工程用户：无感升级

| 事项 | 说明 |
|---|---|
| 升级动作 | `npm update -g pdd-skills-v3` 即可，无需改任何配置 |
| 行为变化 | 无。`.pdd/config` 不需要新增字段；缺省字段按 3.3.x 语义解释 |
| 验证方法 | 升级后在原工程执行 `pdd verify && git diff --stat`，产出应零变更 |
| 回滚 | `npm install -g pdd-skills-v3@3.3.x`，无残留文件 |

### 8.2 混合工程（Java 后端 + Android 客户端）接入

适用：已有 Spring Boot 单体仓库，现在要加 Android 客户端（探测结果 `type: mixed`）。

**目录约定**（无需强制的推荐布局，探测器按信号文件定位，不依赖目录名）：

```
repo-root/
├── server/            # 既有 Spring Boot 工程（原样不动）
│   └── src/main/java/...
├── app/               # 新增 Android 工程（settings.gradle.kts 在此）
│   ├── build.gradle.kts
│   ├── libs.versions.toml
│   └── */src/main/kotlin/...
└── .pdd/config        # init 时生成，含两套 backendDir/mobileDir 指向
```

**步骤**：

1. 在仓库根目录执行 `pdd init .` —— 探测器识别 `mixed`，同时注册 Java 与 Android 两套 linter/契约目标
2. `.pdd/config` 中确认（或手改）两个关键路径：

```jsonc
{
  "backend":  { "dir": "server/src/main/java" },   // 既有语义不变
  "android":  { "dir": "app", "serializer": "moshi", "namespace": "com.example.app" }
}
```

3. `pdd contract` 从此同时产出 TS 与 Kotlin 产物（§7.2）
4. CI 中若暂无 Android 构建环境，可先关闭编译校验：`"android": { "verifyCompile": false }`，其余链路不受影响

**冲突处理**：两端 `pdd generate` 的目标文件不重叠（Java 侧写 `server/`，Kotlin 侧写 `app/`），无需人工仲裁。

### 8.3 纯 Android 团队首次接入 pdd

面向从未用过 pdd 的 Android 团队（跳过 Java 心智，直接以 Android 语境使用）：

1. **装**：`npm install -g pdd-skills-v3`
2. **认**：在 Android Studio 工程根目录 `pdd init .`（识别 android-kotlin / android-compose）
3. **选**：序列化库三选一写入 config（Moshi 默认 / kotlinx.serialization / Gson）；`suspend` 接口风格默认 Retrofit
4. **用**：日常对话直接说 Android 话（"写个 ViewModel"、"审查这段协程"），触发 expert-kotlin / expert-jetpack / expert-android
5. **测**：把现有 Appium/UiAutomator2 脚本可保留；pdd 的 ADB DSL（§7.4）用于冒烟与回归，两套并存不冲突

**概念对照**（Android 团队视角理解 pdd 术语）：

| pdd 术语 | Android 团队可理解为 |
|---|---|
| 规格（spec / openspec change） | 功能的技术方案文档 + 验收清单 |
| `pdd generate` | 按规格产代码（相当于脚手架升级版） |
| `pdd verify` | assembleDebug + detekt/ktlint + 生命周期审查的组合门禁 |
| 契约（contract） | 后端接口的 single source of truth → 自动生成 Retrofit 层 |
| 熵减扫描（scan） | detekt 之外的技术债盘点（复杂度/孤儿代码） |

### 8.4 配置迁移对照表

3.3.x 既有字段全部保留；下表仅列 3.4.0 新增的 Android 可选字段（全部有默认值，可零配置）：

| 字段 | 默认值 | 说明 |
|---|---|---|
| `android.dir` | 探测结果 | Android 工程根目录（mixed 工程必看） |
| `android.serializer` | `moshi` | 契约产物序列化库：moshi / kotlinx-serialization / gson |
| `android.namespace` | 探测结果 | 生成代码的包名前缀 |
| `android.verifyCompile` | `true` | verify 时是否执行 `assembleDebug`（CI 无 SDK 时可关） |
| `android.gradleMode` | `static` | gradle-inspector 解析模式：static（离线）/ dynamic（准确） |
| `test.target` | 探测结果 | 自动化测试目标：`web`（既有）/ `adb`（新增） |

### 8.5 从"手工 AI 规则"迁移

团队若已在 Android 项目里维护 `.cursor/rules`、CLAUDE.md 之类的手工规范，可增量迁移：

1. 将规范中的**代码风格条目**迁入 detekt/ktlint 配置（机器可执行，替代人工描述）
2. 将规范中的**架构约定**（模块依赖方向、禁用 API 清单）迁入 `expert-android` 技能的 SKILL.md，获得对话时的自动注入
3. 原文件保留亦可，pdd 不读取不冲突；建议一个迭代后删除避免双源

---

## 9. 风险与对策

| 风险 | 等级 | 对策 |
|---|---|---|
| Gradle 动态执行解析慢/需网络 | 中 | 静态解析为主，动态模式设为可选增强 |
| AGP 版本碎片化（7.x~8.x API 差异） | 中 | 探测结果携带 agpVersion，模板按版本区间分支 |
| Kotlin 语法解析边界 case | 低 | 解析器标注 confidence，低置信度场景降级为提示而非拦截 |
| 团队无 Android 经验，技能内容质量难保证 | 中 | P2 阶段引入真实 Android 工程试用，收集 badcase 迭代 |

---

## 附录 A：目录结构总览（新增部分）

```
lib/
├── project-type/detector.js          # 工程类型探测（新）
├── android/
│   ├── gradle-inspector/
│   ├── lifecycle-analyzer/
│   ├── kotlin-parser/
│   └── contract-bridge/
├── plugin/android-toolchain/         # 官方插件（新）
skills/expert/
├── expert-kotlin/
├── expert-android/
├── expert-jetpack/
└── expert-android-test/
tests/framework/
├── adb_executor.py
├── ui_selector.py
└── android_run.py
examples/android-demo/                # 示例工程（不进 npm 包）
docs/android/                         # 使用文档
```

## 附录 B：接口定义索引

| 接口 | 文件 | 说明 |
|---|---|---|
| `detect(rootDir)` | lib/project-type/detector.js | 工程类型探测 |
| `inspect(rootDir)` | lib/android/gradle-inspector | Gradle 工程模型 |
| `scanRoutes(rootDir)` | lib/android/lifecycle-analyzer | 路由扫描（对齐 controller-scanner 契约） |
| `audit(rootDir)` | lib/android/lifecycle-analyzer | 生命周期安全审查 |
| `generate(openapi, opts)` | lib/android/contract-bridge | Kotlin 契约产物生成 |
