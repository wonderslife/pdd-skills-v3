---
name: expert-android-test
description: "Android 测试专家。当项目涉及 Android 单元测试（JUnit5/Turbine）、Compose UI Test、Robolectric、ADB 自动化用例与 Monkey 稳定性测试时自动触发。支持中文触发：Android测试、Compose测试、ADB、单元测试、UI测试。"
license: MIT
compatibility: JUnit5 / Turbine / Robolectric 4.x / Compose UI Test
metadata:
  author: "neuqik@hotmail.com"
  version: "1.0"
  stack: ["android", "testing"]
  triggers:
    - "/android-test" | "/测试"
    - "Android测试" | "Compose测试" | "ADB" | "单元测试" | "UI测试" | "Monkey"
---

# Android 测试专家 / Android Testing Expert

## 1. 技能概述 / Overview

为 Android 工程提供测试体系指导：单元测试（JUnit5 + Turbine）、Compose UI Test、Robolectric 本地化测试、ADB 自动化冒烟（pdd tests/framework 的 adb DSL）与 Monkey 稳定性测试。

**核心能力**:
- ViewModel/Flow 单元测试（Turbine）
- Compose 语义树 UI 测试
- ADB YAML 用例编写（复用 pdd 现有用例模型与报告格式）
- 测试金字塔分层与 CI 接入

## 2. 测试分层

| 层 | 工具 | 运行环境 | 占比 |
|---|---|---|---|
| 单元测试 | JUnit5 + Turbine + MockK | JVM（快） | ~70% |
| 本地化 UI | Robolectric / Compose UI Test | JVM / 设备 | ~20% |
| 端到端 | ADB DSL（pdd） / Appium | 真机/模拟器 | ~10% |

## 3. 常用模板

### 3.1 Flow/ViewModel 测试（Turbine）

```kotlin
@Test
fun `load emits Success after fetch`() = runTest {
    coEvery { repo.fetchUsers() } returns testUsers
    val vm = UserListViewModel(repo)

    vm.state.test {
        assertEquals(UserListState.Loading, awaitItem())
        val item = awaitItem()
        assertTrue(item is UserListState.Success)
        cancelAndIgnoreRemainingEvents()
    }
}
```

### 3.2 Compose UI 测试

```kotlin
@get:Rule val composeRule = createComposeRule()

@Test
fun errorStateShowsRetry() {
    composeRule.setContent { UserListScreen(UserListState.Error("boom"), {}, {}) }
    composeRule.onNodeWithText("boom").assertIsDisplayed()
    composeRule.onNodeWithContentDescription("retry").assertHasClickAction()
}
```

### 3.3 pdd ADB DSL 用例

与 Web 用例同构，仅 action 命名空间为 `adb.*`；由 `tests/framework/android_run.py` 执行：

```yaml
case: 登录页-错误密码提示
app: com.example.mycomposeapp
steps:
  - action: adb.launch
  - action: adb.tap
    selector: { resourceId: "com.example.mycomposeapp:id/et_username" }
  - action: adb.input
    text: "testuser"
  - action: ui.assert_text
    selector: { textContains: "密码错误" }
  - action: adb.screenshot
    save: login_error.png
```

执行：`python tests/framework/android_run.py --case tests/cases/android/ --serial emulator-5554`

selector 说明：`resourceId`/`text`/`textContains`/`content-desc`/`class`；Compose 需在节点上配置 `semantics { testTagsAsResourceId = true }` 方可用 resourceId 定位。

## 4. Monkey 稳定性测试

```bash
adb shell monkey -p com.example.mycomposeapp --throttle 300 -s 42 -v 5000
```

- 固定 `-s` 种子保证可复现；崩溃后用 `adb logcat -b crash` 取栈
- 建议纳入 CI 夜间任务，配合 pdd ADB 冒烟用例作回归门禁

## 5. CI 接入建议

1. PR 门禁：单元测试 + Robolectric（无模拟器依赖，秒级）
2. 合并门禁：模拟器（API 30/34）跑 pdd ADB 冒烟 10 条
3. 夜间：Monkey 30 分钟 + pdd 全量 verify（含 assembleDebug + detekt/ktlint）

## 6. 与其他技能协作

- 用例所测的界面规范 → `expert-jetpack`；路由清单辅助圈定回归范围 → `pdd impact`
- 报告格式与 Web 用例共用 `tests/reports/` 输出
