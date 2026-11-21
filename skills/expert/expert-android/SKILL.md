---
name: expert-android
description: "Android 平台开发专家。当项目涉及四大组件生命周期、运行时权限、AndroidManifest 配置、组件化架构与资源适配时自动触发。支持中文触发：Android、Activity、Fragment、生命周期、AndroidManifest、组件化。"
license: MIT
compatibility: Android API 24+ / AGP 7.x-8.x
metadata:
  author: "neuqik@hotmail.com"
  version: "1.0"
  stack: ["android"]
  triggers:
    - "/android" | "/组件化"
    - "Android" | "Activity" | "Fragment" | "生命周期"
    - "AndroidManifest" | "运行时权限" | "组件化拆分"
---

# Android 平台开发专家 / Android Platform Expert

## 1. 技能概述 / Overview

为 Android 原生工程提供平台级专家指导：组件生命周期、权限模型、Manifest 配置审查、组件化架构与资源适配。语言层问题（协程/Flow）转 `expert-kotlin`，Jetpack 组件与 Compose 转 `expert-jetpack`。

**核心能力**:
- 四大组件生命周期与状态保存
- 运行时权限（API 23+）模型与申请流程
- AndroidManifest 配置审查（导出组件、权限声明、深链）
- 组件化架构（模块拆分、接口下沉、路由治理）
- 资源适配（dimen、多语言、深色模式、屏幕密度）

## 2. 生命周期审查要点

| 组件 | 关键规则 |
|---|---|
| Activity | `onSaveInstanceState` 只存轻量状态；配置变更优先 ViewModel；`finish()` 后勿再操作 UI |
| Fragment | 用 `viewLifecycleOwner`（非 `this`）观察 LiveData/Flow；视图在 `onDestroyView` 置空 |
| Service | 长任务优先 WorkManager；前台服务必须声明 `foregroundServiceType`（API 34+ 强制） |
| BroadcastReceiver | 动态注册必须配对注销；`RECEIVE_BOOT_COMPLETED` 等需显式声明 |
| ContentProvider | `exported` 显式声明（API 31+ 强制，缺失将无法安装） |

## 3. Manifest 审查清单

1. 所有含 intent-filter 的组件必须显式 `android:exported`
2. 敏感权限（CAMERA/LOCATION/RECORD_AUDIO）运行时申请，拒绝后引导设置页
3. `android:allowBackup` 生产环境评估是否关闭
4. 深链（`android:scheme`）必须配 `autoVerify` 与 assetlinks 校验
5. `usesCleartextTraffic` 生产环境应为 false（配 networkSecurityConfig）

## 4. 组件化架构指导

### 4.1 模块拆分原则

```
:app                 # 壳工程：聚合、路由注册、Application
:feature-*           # 业务模块：页面 + 领域逻辑，互相不直接依赖
:core-*              # 基础设施：network / storage / design / common
```

- 依赖方向：`feature-* → core-*`，禁止 feature 互依（需要通信时下沉接口或走路由）
- 接口下沉：跨模块调用抽象到 `core-*/api` 模块，实现由 Hilt/Koin 注入
- 路由：Navigation Component（单模块内）或 ARouter/自定义路由表（跨模块），`pdd scan` 可产出路由清单

### 4.2 组件化改造步骤（存量单模块工程）

1. 抽 `core-*`（design/network/storage），先让壳工程依赖通过
2. 按业务域抽 `feature-*`，页面与其直接依赖一起迁移
3. 建路由表，替换显式 Intent 跨模块跳转
4. 引入版本目录（libs.versions.toml）统一依赖版本
5. 用 `pdd impact` 分析改动影响面，`pdd config --gradle-doctor` 体检构建配置

## 5. 常用生成模板

### 5.1 运行时权限申请（Compose）

```kotlin
val cameraPermission = rememberLauncherForActivityResult(
    ActivityResultContracts.RequestPermission()
) { granted -> if (granted) openCamera() else showRationale() }

Button(onClick = {
    when (ContextCompat.checkSelfPermission(ctx, Manifest.permission.CAMERA)) {
        PackageManager.PERMISSION_GRANTED -> openCamera()
        else -> cameraPermission.launch(Manifest.permission.CAMERA)
    }
}) { Text("拍照") }
```

### 5.2 组件化模块 build.gradle.kts 骨架

```kotlin
plugins {
    id("com.android.library")
    alias(libs.plugins.kotlin.android)
}
android {
    namespace = "com.example.feature.login"
    compileSdk = libs.versions.compileSdk.get().toInt()
    defaultConfig { minSdk = libs.versions.minSdk.get().toInt() }
    buildFeatures { compose = true }
}
```

## 6. 与其他技能协作

- Kotlin 语法/协程细节 → `expert-kotlin`；Compose/Jetpack → `expert-jetpack`
- 路由清单与改动影响面 → `pdd scan` / `pdd impact`
- 自动化验证 → `expert-android-test`
