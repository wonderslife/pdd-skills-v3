# PDD Python SDK

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/pdd-skills/pdd-python-sdk)
[![Python](https://img.shields.io/badge/python-3.8%2B-green.svg)](https://www.python.org/)
[![License](https://img.shields.io/badge/license-MIT-orange.svg)](LICENSE)

**PRD 驱动开发 (PDD) 的 Python 工具包** - 纯标准库实现，零第三方依赖。

提供与 PDD 服务端交互的完整能力：规格生成、代码生成、功能验证、代码审查等。

## 特性

- **零依赖**: 仅使用 Python 标准库 (stdlib)，无需 `pip install`
- **异步优先**: 基于 `asyncio` 的原生异步 API
- **类型安全**: 完整的 PEP 484 类型注解
- **事件驱动**: 内置事件系统，可监听请求生命周期
- **自动重试**: 可配置的指数退避重试机制
- **内存缓存**: 基于 TTL 的响应缓存
- **中文文档**: 完整的中文 docstring 和注释

## 安装

### 无需安装

本 SDK 纯基于标准库，**无需安装任何依赖**。

只需将 `sdk-python/` 目录添加到你的 Python 路径即可：

```python
import sys
sys.path.append("./lib/sdk-python")

from pdd_sdk import PDDClient
```

### 或者直接使用

```bash
# 将 SDK 目录复制到项目中
cp -r lib/sdk-python/pdd_sdk ./your_project/

# 在你的代码中导入
from pdd_sdk import PDDClient
```

## 快速开始

### 5 分钟上手

```python
import asyncio
from pdd_sdk import PDDClient, Events

async def main():
    # 1. 创建客户端
    client = PDDClient(
        endpoint="http://localhost:3000",  # PDD 服务端地址
        debug=True                          # 开启调试日志
    )

    # 2. 监听事件（可选）
    client.on(Events.REQUEST_END, lambda e: print(
        f"完成: {e['method']} {e['path']} ({e['duration_ms']}ms)"
    ))

    # 3. 从 PRD 生成开发规格
    spec = await client.generate_spec(
        prd_path="./docs/requirements.prdx",
        output_dir="./specs"
    )
    print(f"提取了 {spec.feature_count} 个功能点")

    # 4. 根据规格生成代码
    for feature in spec.features[:3]:
        code = await client.generate_code(
            spec_path=spec.spec_path,
            feature_id=feature["id"],
            output_dir="./src"
        )
        print(f"  -> 生成了 {code.file_count} 个文件")

    # 5. 验证功能实现
    verify = await client.verify_feature(
        spec_path=spec.spec_path,
        source_dir="./src"
    )
    print(f"覆盖率: {verify.coverage_percent}%")

# 运行
asyncio.run(main())
```

### 使用上下文管理器（推荐）

```python
async with PDDClient(endpoint="http://localhost:3000") as client:
    result = await client.generate_spec(prd_path="./docs/prd.prdx")
    # ... 使用客户端 ...
# 自动清理资源
```

## API 参考

### 核心类: PDDClient

#### 构造函数

```python
client = PDDClient(
    endpoint="http://localhost:3000",  # API 端点（必需）
    api_key="",                        # API 密钥（可选）
    timeout=30,                        # 超时时间（秒）
    debug=False,                       # 调试模式
    max_retries=3,                     # 最大重试次数
    retry_delay=1.0,                   # 重试初始延迟（秒）
    enable_cache=True,                 # 启用缓存
    cache_ttl=300                      # 缓存有效期（秒）
)
```

#### 核心 API 方法

| 方法 | 说明 | 返回类型 |
|------|------|----------|
| `generate_spec()` | 从 PRD 生成开发规格 | `SpecResult` |
| `generate_code()` | 根据规格生成代码 | `CodeResult` |
| `verify_feature()` | 验证功能实现 | `VerifyResult` |
| `code_review()` | 执行代码审查 | `ReviewResult` |
| `list_skills()` | 获取可用技能列表 | `List[SkillInfo]` |
| `get_status()` | 获取服务状态 | `StatusResult` |

#### 批量操作方法

| 方法 | 说明 | 返回类型 |
|------|------|----------|
| `batch_generate_specs()` | 批量生成规格 | `List[SpecResult]` |
| `batch_verify()` | 批量验证功能 | `List[VerifyResult]` |

#### 会话管理方法

| 方法 | 说明 | 返回类型 |
|------|------|----------|
| `create_session()` | 创建开发会话 | `Session` |
| `get_session()` | 获取会话详情 | `Session` |
| `list_sessions()` | 列出所有会话 | `List[Session]` |

#### 工具方法

| 方法 | 说明 | 返回类型 |
|------|------|----------|
| `health_check()` | 同步健康检查 | `bool` |
| `get_server_info()` | 获取服务器信息 | `ServerInfo` 或 `None` |
| `close()` | 关闭客户端释放资源 | `None` |

### 详细 API 文档

#### generate_spec()

从 PRD 文档生成开发规格。

```python
result = await client.generate_spec(
    prd_path="./docs/requirements.prdx",   # PRD 文件路径
    template="standard",                    # 可选模板
    output_dir="./specs",                   # 输出目录
    dry_run=False                           # 是否仅预览
)

# 结果属性
result.success          # 是否成功 (bool)
result.spec_id          # 规格 ID (str)
result.spec_path        # 规格文件路径 (str)
result.features         # 功能点列表 (List[Dict])
result.warnings         # 警告列表 (List[str])
result.errors           # 错误列表 (List[str])
result.duration_ms      # 执行耗时 (int)
result.feature_count    # 功能点数量 (property)
```

#### generate_code()

根据开发规格生成代码。

```python
result = await client.generate_code(
    spec_path="./specs/user.spec.json",     # 规格文件路径
    feature_id="F001",                      # 功能点 ID（可选）
    output_dir="./src",                     # 输出目录
    dry_run=False                           # 是否仅预览
)

# 结果属性
result.success           # 是否成功
result.feature_id        # 功能点 ID
result.files_generated   # 生成的文件列表 (List[GeneratedFile])
result.lines_of_code     # 总代码行数
result.file_count        # 文件数量 (property)
result.file_paths        # 文件路径列表 (property)
```

#### verify_feature()

验证功能实现是否符合验收标准。

```python
result = await client.verify_feature(
    spec_path="./specs/user.spec.json",     # 规格文件路径
    source_dir="./src",                    # 源代码目录
    format="json"                          # 输出格式: json/table/markdown
)

# 结果属性
result.success             # 是否通过验证
result.coverage_percent    # 覆盖率百分比 (float)
result.criteria_passed     # 通过的标准列表
result.criteria_failed     # 未通过的标准列表
result.issues              # 问题列表 (List[VerifyIssue])
result.total_criteria      # 总标准数 (property)
result.issue_count         # 问题总数 (property)
result.error_count         # 严重问题数 (property)
```

#### code_review()

执行静态代码审查。

```python
result = await client.code_review(
    source_dir="./src",                     # 源代码目录
    rules=["complexity", "security"],       # 应用规则集（可选）
    format="table"                          # 输出格式
)

# 结果属性
result.score               # 综合评分 (0-100)
result.grade               # 等级 (A/B/C/D/F)
result.findings            # 发现的问题列表 (List[ReviewFinding])
result.finding_count       # 问题总数
result.critical_count      # 严重问题数
```

### 事件系统

SDK 内置事件发射器，可监听请求生命周期：

```python
from pdd_sdk import Events

# 注册监听器
client.on(Events.REQUEST_START, lambda e: print("请求开始..."))
client.on(Events.REQUEST_END, lambda e: print(f"完成 ({e['duration_ms']}ms)"))
client.on(Events.REQUEST_ERROR, lambda e: print(f"错误: {e['error']}"))
client.on(Events.RETRY, lambda e: print(f"正在重试第 {e['attempt']} 次"))

# 一次性监听
client.once(Events.SESSION_CREATED, lambda e: print("新会话已创建!"))

# 移除监听器
client.off(Events.REQUEST_END, my_handler)  # 移除特定处理器
client.off(Events.REQUEST_END)              # 移除所有处理器
```

#### 预定义事件常量

| 常量 | 说明 | 数据 |
|------|------|------|
| `Events.REQUEST_START` | 请求开始 | method, path, payload |
| `Events.REQUEST_END` | 请求成功 | method, path, duration_ms, success |
| `Events.REQUEST_ERROR` | 请求错误 | method, path, error, duration_ms |
| `Events.RETRY` | 正在重试 | attempt, error |
| `Events.CACHE_HIT` | 缓存命中 | key |
| `Events.CACHE_MISS` | 缓存未命中 | key |
| `Events.BATCH_START` | 批量操作开始 | total, type |
| `Events.BATCH_PROGRESS` | 批量进度更新 | current, total |
| `Events.BATCH_COMPLETE` | 批量操作完成 | total, duration_ms |
| `Events.SESSION_CREATED` | 会话创建 | session_id, name |

### 异常处理

SDK 提供层次化的异常体系：

```python
from pdd_sdk import (
    PDDError,
    PDDConnectionError,
    AuthError,
    ValidationError,
    ServerError,
    PDDTimeoutError,
    RateLimitError
)

try:
    result = await client.generate_spec(prd_path="./invalid.prdx")
except ValidationError as e:
    print(f"参数错误: {e}")
    print(f"详情: {e.details}")
except AuthError as e:
    print(f"认证失败: {e.code}")
except PDDConnectionError as e:
    print(f"连接失败: {e.message}")
except ServerError as e:
    print(f"服务端错误: {e.to_dict()}")
except PDDTimeoutError as e:
    print(f"请求超时")
except RateLimitError as e:
    print(f"限流: 请稍后重试")
except PDDError as e:
    print(f"PDD 错误: {e}")
```

### 异常类层次

```
PDDError (基类)
├── ConnectionError      - 连接失败
├── AuthError            - 认证失败 (401)
├── ValidationError      - 参数验证失败 (400)
├── ServerError          - 服务端错误 (5xx)
├── TimeoutError         - 超时
└── RateLimitError       - 限流 (429)
```

## 配置选项表

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `endpoint` | str | `"http://localhost:3000"` | PDD 服务端 URL |
| `api_key` | str | `""` | API 认证密钥 |
| `timeout` | int | `30` | HTTP 超时时间（秒） |
| `debug` | bool | `False` | 是否输出详细日志 |
| `max_retries` | int | `3` | 失败时最大重试次数 |
| `retry_delay` | float | `1.0` | 重试初始延迟（秒） |
| `enable_cache` | bool | `True` | 是否启用内存缓存 |
| `cache_ttl` | int | `300` | 缓存有效期（秒） |

## 与 JS SDK 对比

| 特性 | Python SDK | JS SDK |
|------|------------|--------|
| 语言 | Python 3.8+ | Node.js 14+ |
| 依赖 | 零依赖 | 零依赖 |
| 编程范式 | async/await | Promise/then |
| 类型注解 | PEP 484 (dataclass) | JSDoc / TypeScript |
| 事件系统 | EventEmitter 类 | on/off/emit 方法 |
| 重试机制 | @retry 装饰器 | 内置配置 |
| 缓存 | MemoryCache + @cache | cacheTTL 配置 |
| 批量操作 | batch_* 方法 | batchGenerate 等 |
| 上下文管理 | async with | N/A |

## 异步编程最佳实践

### 1. 并发执行多个独立任务

```python
import asyncio

# 方式一: asyncio.gather 并发
spec_task = client.generate_spec(prd_path="./prd1.prdx")
status_task = client.get_status()

results = await asyncio.gather(spec_task, status_task)
spec_result, status_result = results

# 方式二: asyncio.create_task 显式创建任务
task1 = asyncio.create_task(client.generate_spec(prd_path="./prd1.prdx"))
task2 = asyncio.create_task(client.generate_spec(prd_path="./prd2.prdx"))

# 继续其他工作...
await some_other_work()

# 等待两个任务完成
result1, result2 = await asyncio.gather(task1, task2)
```

### 2. 限制并发数量

```python
import asyncio

async def process_many_features(features, max_concurrent=5):
    """限制并发数量的批量处理"""
    semaphore = asyncio.Semaphore(max_concurrent)

    async def process_one(feature):
        async with semaphore:
            return await client.generate_code(
                spec_path="./specs/main.spec.json",
                feature_id=feature["id"]
            )

    tasks = [process_one(f) for f in features]
    return await asyncio.gather(*tasks)
```

### 3. 设置超时

```python
import asyncio

try:
    # 为单个操作设置超时
    result = await asyncio.wait_for(
        client.generate_spec(prd_path="./large-prd.prdx"),
        timeout=120.0  # 120 秒超时
    )
except asyncio.TimeoutError:
    print("操作超时!")
```

### 4. 错误处理和重试

```python
import asyncio
from pdd_sdk import PDDError

async def robust_generate(prd_path, max_attempts=5):
    """带指数退避的重试逻辑"""
    delay = 1.0
    for attempt in range(max_attempts):
        try:
            return await client.generate_spec(prd_path=prd_path)
        except PDDConnectionError as e:
            if attempt == max_attempts - 1:
                raise
            print(f"连接失败，{delay:.1f}秒后重试...")
            await asyncio.sleep(delay)
            delay *= 2  # 指数退避
```

### 5. 资源清理

```python
# 推荐: 使用上下文管理器
async with PDDClient(endpoint="http://localhost:3000") as client:
    # 所有操作...
    pass
# 自动调用 client.close()

# 手动管理
client = PDDClient(endpoint="http://localhost:3000")
try:
    result = await client.generate_spec(prd_path="./prd.prdx")
finally:
    await client.close()  # 确保资源释放
```

## 项目结构

```
sdk-python/
├── pdd_sdk/
│   ├── __init__.py      # 包初始化和公共导出
│   ├── client.py        # 核心客户端类 (~350 行)
│   ├── models.py        # 数据模型定义 (~200 行)
│   ├── exceptions.py    # 异常体系 (~50 行)
│   ├── events.py        # 事件系统 (~80 行)
│   └── utils.py         # 工具函数 (~100 行)
├── examples/
│   └── basic_usage.py   # 基本用法示例 (~60 行)
└── README.md            # 本文档
```

## 示例脚本

运行基本用法示例：

```bash
cd sdk-python
python examples/basic_usage.py
```

示例包含以下演示：
1. 客户端初始化和状态检查
2. 事件系统注册和监听
3. PRD 规格生成
4. 代码生成
5. 功能验证
6. 批量操作
7. 会话管理
8. 异步上下文管理器用法

## 常见问题

### Q: 如何在没有服务端的情况下测试？

SDK 包含完整的类型定义和数据模型，可以用于构建 mock 测试：

```python
from pdd_sdk import SpecResult, CodeResult, VerifyResult

# 创建模拟结果
mock_spec = SpecResult(
    success=True,
    spec_id="test-spec-001",
    spec_path="./mock/spec.json",
    features=[
        {"id": "F001", "name": "用户登录"},
        {"id": "F002", "name": "用户注册"},
    ]
)
print(mock_spec.feature_count)  # 输出: 2
```

### Q: 如何自定义日志格式？

```python
from pdd_sdk.utils import get_logger

logger = get_logger("my_app", level=10)  # DEBUG 级别
logger.info("自定义日志消息")
```

### Q: 支持哪些 Python 版本？

Python 3.8 及以上版本。主要使用了：
- `dataclasses` (3.7+)
- `typing` 模块的完整支持 (3.8+ 最佳体验)
- `asyncio` (3.5+, 3.8+ 有显著改进)

## 版本历史

### v1.0.0 (当前版本)

- 初始版本发布
- 核心功能: 规格/代码/验证/审查
- 事件系统
- 重试机制
- 内存缓存
- 批量操作
- 会话管理
- 完整的类型注解和中文文档

## 许可证

MIT License

## 贡献指南

欢迎提交 Issue 和 Pull Request！

请确保：
1. 代码符合 PEP 8 规范
2. 添加适当的类型注解
3. 更新相关文档
4. 保持零第三方依赖的原则
