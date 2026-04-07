"""
PDD Python SDK 基本用法示例

演示 SDK 的核心功能，包括：
- 客户端初始化与配置
- 事件监听
- 规格生成
- 代码生成
- 功能验证
- 错误处理
- 批量操作

运行方式:
    python examples/basic_usage.py

注意: 需要先启动 PDD 服务端（默认 http://localhost:3000）
"""

import asyncio
import sys
import os

# 添加父目录到路径，以便导入 pdd_sdk
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pdd_sdk import (
    PDDClient,
    Events,
    PDDError,
    PDDConnectionError,
    AuthError,
    ValidationError,
    format_table,
    format_json,
    format_duration,
)


def print_section(title: str) -> None:
    """打印分隔线"""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


async def example_basic_client():
    """
    示例 1: 基本客户端初始化和状态检查
    """
    print_section("示例 1: 客户端初始化")

    # 创建客户端实例
    client = PDDClient(
        endpoint="http://localhost:3000",
        api_key="",  # 如果服务端需要认证，填入 API Key
        timeout=30,
        debug=True,  # 开启调试日志
        max_retries=3,
        retry_delay=1.0,
    )

    print(f"客户端信息: {client}")
    print(f"请求统计: {format_json(client.request_stats)}")

    # 同步健康检查
    is_healthy = client.health_check()
    print(f"服务健康状态: {'正常' if is_healthy else '异常'}")

    # 异步获取详细状态
    try:
        status = await client.get_status()
        if status.healthy and status.server_info:
            info = status.server_info
            print(f"\n服务器信息:")
            print(f"  版本: {info.version}")
            print(f"  运行时间: {format_duration(int(info.uptime * 1000))}")
            print(f"  可用技能数: {info.available_skills}")
            print(f"  支持的 API: {', '.join(info.supported_apis[:5])}...")
    except Exception as e:
        print(f"获取状态失败（可能服务未启动）: {e}")

    await client.close()
    return client


async def example_event_system(client: PDDClient):
    """
    示例 2: 事件系统使用
    """
    print_section("示例 2: 事件监听")

    # 注册请求完成事件监听器
    def on_request_end(event_data: dict):
        method = event_data.get("method", "")
        path = event_data.get("path", "")
        duration = event_data.get("duration_ms", 0)
        success = event_data.get("success", False)
        status_icon = "OK" if success else "FAIL"
        print(f"  [事件] {method} {path} -> {status_icon} ({duration}ms)")

    # 注册请求错误事件监听器
    def on_request_error(event_data: dict):
        error = event_data.get("error", "未知错误")
        print(f"  [事件] 请求失败: {error}")

    # 注册重试事件监听器
    def on_retry(event_data: dict):
        attempt = event_data.get("attempt", 0)
        print(f"  [事件] 正在进行第 {attempt} 次重试...")

    # 绑定事件处理器
    client.on(Events.REQUEST_END, on_request_end)
    client.on(Events.REQUEST_ERROR, on_request_error)
    client.on(Events.RETRY, on_retry)

    # 使用 once 监听一次性事件
    client.once("request:end", lambda e: print("  [一次性事件] 首次请求完成！"))

    print("已注册以下事件监听器:")
    for event_name in client.events.event_names():
        count = client.events.listener_count(event_name)
        print(f"  - {event_name}: {count} 个监听器")


async def example_generate_spec(client: PDDClient):
    """
    示例 3: 从 PRD 生成开发规格
    """
    print_section("示例 3: 规格生成")

    # 注意: 此处需要实际的 PRD 文件路径
    prd_path = "./docs/sample.prdx"

    # 先检查文件是否存在（模拟，实际使用时需要真实文件）
    if not os.path.exists(prd_path):
        print(f"[提示] PRD 文件 '{prd_path' 不存在，跳过实际调用")
        print("\n预期调用方式:")
        print("""
    result = await client.generate_spec(
        prd_path="./docs/requirements.prdx",
        template="standard",
        output_dir="./specs"
    )

    if result.success:
        print(f"规格 ID: {result.spec_id}")
        print(f"规格路径: {result.spec_path}")
        print(f"提取了 {result.feature_count} 个功能点:")
        for feature in result.features[:5]:
            print(f"  - [{feature['id']}] {feature['name']}")

        if result.warnings:
            print(f"\n警告 ({len(result.warnings)} 条):")
            for w in result.warnings:
                print(f"  ! {w}")
        """)
        return None

    try:
        result = await client.generate_spec(
            prd_path=prd_path,
            template="standard",
            output_dir="./specs",
            dry_run=False
        )

        print(f"生成结果: {'成功' if result.success else '失败'}")
        print(f"规格 ID: {result.spec_id}")
        print(f"规格路径: {result.spec_path}")
        print(f"耗时: {format_duration(result.duration_ms)}")
        print(f"\n功能点列表 (共 {result.feature_count} 个):")

        # 格式化输出功能点表格
        feature_rows = []
        for f in result.features[:10]:
            feature_rows.append({
                "ID": f.get("id", ""),
                "名称": f.get("name", ""),
                "描述": f.get("description", "")[:40],
            })
        if feature_rows:
            print(format_table(feature_rows))

        return result

    except ValidationError as e:
        print(f"参数验证失败: {e}")
    except PDDConnectionError as e:
        print(f"连接失败: {e}")
    except AuthError as e:
        print(f"认证失败: {e}")
    except PDDError as e:
        print(f"PDD 错误: {e}")

    return None


async def example_generate_code(client: PDDClient, spec_result=None):
    """
    示例 4: 根据规格生成代码
    """
    print_section("示例 4: 代码生成")

    if not spec_result:
        print("[提示] 跳过代码生成（无可用规格）")
        print("\n预期调用方式:")
        print("""
    code_result = await client.generate_code(
        spec_path="./specs/user-system.spec.json",
        feature_id="F001",  # 可选，不指定则生成全部
        output_dir="./src"
    )

    if code_result.success:
        print(f"功能点: {code_result.feature_id}")
        print(f"生成文件数: {code_result.file_count}")
        print(f"总代码行数: {code_result.lines_of_code}")
        print(f"\n生成的文件:")
        for f in code_result.files_generated:
            size_str = format_bytes(f.size_bytes) if f.size_bytes else ""
            print(f"  - {f.path} ({f.lines_of_code} 行) {size_str}")
        """)
        return

    # 对前 3 个功能点生成代码
    features_to_generate = spec_result.features[:3]

    for feature in features_to_generate:
        feature_id = feature.get("id", "unknown")
        feature_name = feature.get("name", "未知功能")

        print(f"\n正在生成代码: [{feature_id}] {feature_name}")

        try:
            code_result = await client.generate_code(
                spec_path=spec_result.spec_path,
                feature_id=feature_id,
                output_dir=f"./src/{feature_id.lower()}",
                dry_run=True  # 仅预览模式
            )

            if code_result.success:
                print(f"  状态: 成功")
                print(f"  文件数: {code_result.file_count}")
                print(f"  代码行数: {code_result.lines_of_code}")
                if code_result.files_generated:
                    for f in code_result.files_generated[:5]:
                        print(f"    - {f.path}")
            else:
                print(f"  状态: 失败")
                if code_result.errors:
                    for err in code_result.errors:
                        print(f"    错误: {err}")

        except PDDError as e:
            print(f"  生成出错: {e}")


async def example_verify_feature(client: PDDClient, spec_result=None):
    """
    示例 5: 功能验证
    """
    print_section("示例 5: 功能验证")

    if not spec_result:
        print("[提示] 跳过验证（无可用规格）")
        print("\n预期调用方式:")
        print("""
    verify_result = await client.verify_feature(
        spec_path="./specs/user-system.spec.json",
        source_dir="./src",
        format="json"
    )

    print(f"验证结果: {'通过' if verify_result.success else '未通过'}")
    print(f"覆盖率: {verify_result.coverage_percent:.1f}%")
    print(f"通过标准: {len(verify_result.criteria_passed)} / {verify_result.total_criteria}")

    if verify_result.issues:
        print(f"\n发现的问题 ({len(verify_result.issues)} 个):")
        for issue in verify_result.issues[:10]:
            severity_icon = {"error": "[X]", "warn": "[!]", "info": "[i]"}
            icon = severity_icon.get(issue.severity.value, "[?]")
            print(f"  {icon} {issue.file_path}:{issue.line_number or '?'} - {issue.message}")
        """)
        return

    try:
        verify_result = await client.verify_feature(
            spec_path=spec_result.spec_path,
            source_dir="./src",
            format="json"
        )

        print(f"验证结果: {'通过' if verify_result.success else '未通过'}")
        print(f"覆盖率: {verify_result.coverage_percent:.1f}%")
        print(f"总验收标准: {verify_result.total_criteria}")
        print(f"  通过: {len(verify_result.criteria_passed)}")
        print(f"  未通过: {len(verify_result.criteria_failed)}")

        if verify_result.summary:
            print(f"\n摘要: {verify_result.summary}")

        if verify_result.issues:
            print(f"\n问题列表 (共 {verify_result.issue_count} 个, "
                  f"其中 {verify_result.error_count} 个严重):")

            issue_rows = []
            for issue in verify_result.issues[:15]:
                issue_rows.append({
                    "文件": issue.file_path[-30:],
                    "行号": str(issue.line_number or "-"),
                    "级别": issue.severity.value,
                    "描述": issue.message[:50],
                })
            print(format_table(issue_rows))

    except PDDError as e:
        print(f"验证出错: {e}")


async def example_batch_operations(client: PDDClient):
    """
    示例 6: 批量操作
    """
    print_section("示例 6: 批量操作")

    print("批量操作可以并发执行多个任务，显著提升效率。")
    print("\n批量生成规格示例:")

    batch_specs = [
        {"prd_path": "./docs/module-a.prdx"},
        {"prd_path": "./docs/module-b.prdx"},
        {"prd_path": "./docs/module-c.prdx"},
    ]

    print(f"""
    # 定义批量任务列表
    batch_specs = [
        {{"prd_path": "./docs/module-a.prdx"}},
        {{"prd_path": "./docs/module-b.prdx"}},
        {{"prd_path": "./docs/module-c.prdx"}},
    ]

    # 并发执行所有任务
    results = await client.batch_generate_specs(batch_specs)

    # 统计结果
    success_count = sum(1 for r in results if r.success)
    print(f"成功: {{success_count}}/{{len(results)}}")

    for i, result in enumerate(results):
        status = "OK" if result.success else "FAIL"
        print(f"  [{{i+1}}] {{status}} - {{result.feature_count}} 个功能点")
    """)

    print("\n批量验证示例:")
    print("""
    batch_features = [
        {"spec_path": "./specs/a.spec.json", "source_dir": "./src/a"},
        {"spec_path": "./specs/b.spec.json", "source_dir": "./src/b"},
    ]

    verify_results = await client.batch_verify(batch_features)
    """)


async def example_session_management(client: PDDClient):
    """
    示例 7: 会话管理
    """
    print_section("示例 7: 会话管理")

    print("会话用于组织相关的开发任务。")
    print("""
    # 创建新会话
    session = await client.create_session(name="用户模块 v2.0 开发")
    print(f"会话 ID: {session.session_id}")
    print(f"创建时间: {session.created_at}")

    # 获取会话详情
    session_detail = await client.get_session(session.session_id)

    # 列出所有会话
    sessions = await client.list_sessions()
    for s in sessions:
        print(f"- {s.name} ({s.status.value})")
    """)


async def example_context_manager():
    """
    示例 8: 异步上下文管理器使用
    """
    print_section("示例 8: 异步上下文管理器")

    print("推荐使用 async with 语法自动管理资源:")
    print("""
    async with PDDClient(endpoint="http://localhost:3000") as client:
        # 在此块中使用 client
        result = await client.generate_spec(prd_path="./docs/prd.prdx")
        print(result.feature_count)

    # 离开上下文时自动清理资源
    """)


async def main():
    """
    主函数：运行所有示例
    """
    print("=" * 60)
    print("  PDD Python SDK 基本用法示例")
    print("=" * 60)
    print()
    print("本示例展示 SDK 的核心功能和典型用法。")
    print("注意: 需要启动 PDD 服务端才能执行实际 API 调用。")
    print()

    # 示例 1: 客户端初始化
    client = await example_basic_client()

    # 示例 2: 事件系统
    await example_event_system(client)

    # 示例 3-5: 需要 PDD 服务端运行的核心功能
    spec_result = await example_generate_spec(client)
    await example_generate_code(client, spec_result)
    await example_verify_feature(client, spec_result)

    # 示例 6-8: 高级功能演示
    await example_batch_operations(client)
    await example_session_management(client)
    await example_context_manager()

    print_section("运行完成")
    print("所有示例执行完毕。")
    print()
    print("提示:")
    print("  - 启动 PDD 服务端后重新运行此脚本以查看完整输出")
    print("  - 查看 README.md 了解更多高级用法")
    print("  - 查看 client.py 了解完整的 API 文档")


if __name__ == "__main__":
    # 运行主程序
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n用户中断，程序退出。")
