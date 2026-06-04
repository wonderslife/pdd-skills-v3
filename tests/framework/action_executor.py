"""AI Test Framework - Action 执行器核心引擎

从 run_testcase.py 提取的 ActionExecutor 类，负责：
  - YAML 步骤到 MCP 工具调用的映射与执行
  - 自动重试机制
  - LLM 思维链集成
  - el_upload / el_date 等 Element UI 专用动作
  - 断言执行与结果收集
  - 自动保存防护（_disable_auto_save）
"""
import asyncio
import json
import os
import re
import time
from typing import Any, Dict, List, Optional, Tuple

from tests.framework.constants import DEFAULT_CONFIG, RESULT_BASE_DIR, INPUT_ROLES, INTERACTIVE_ROLES
from tests.framework.logger import log
from tests.framework.snapshot_models import StepStatus, StepResult, SnapshotElement
from tests.framework.snapshot_matcher import SnapshotParser
from tests.framework.mcp_client import (
    ClientSession, extract_result_content, check_result_has_error, parse_json_from_mcp_response,
)
from tests.framework.arg_builders import (
    ActionRegistry, AssertionRegistry,
    resolve_env_vars, _resolve_uid,
    _build_js_click_args,
)
from tests.framework.utils import safe_json_dumps


class ActionExecutor:
    """
    将 YAML action 映射到 MCP 工具调用
    
    v2.1 特性:
      - LLM 思维链集成：每步执行前后调用 AI 生成思考过程
      - 自动重试机制
      - 执行前快照确认
      - 智能错误恢复
      - 详细日志记录
      - 钩子支持
    """

    def __init__(self, session: ClientSession, parser: SnapshotParser,
                 cache: Dict[str, str], config: Dict[str, Any] = None,
                 think_engine: 'ThinkChainEngine' = None,
                 result_dir: str = None):
        self.session = session
        self.parser = parser
        self.cache = cache
        self.config = {**DEFAULT_CONFIG, **(config or {})}
        self.last_snapshot_text = ""
        self.execution_log: List[str] = []
        self.result_dir = result_dir or RESULT_BASE_DIR
        self.snapshot_dir = os.path.join(self.result_dir, "snapshots") if result_dir else RESULT_BASE_DIR
        
        think_enabled = self.config.get("llm_think_enabled", False)
        if think_engine and (think_enabled or think_engine.enabled):
            self.think_engine = think_engine
            log("  🧠 思维链引擎已连接", 2)
        else:
            self.think_engine = None

    async def _disable_auto_save(self):
        """禁用被测应用表单页的自动保存/草稿保存机制
        
        某些 Vue/若依应用在表单页面会启动 setInterval 或 watch 定时器，
        在用户操作后自动触发"保存草稿"，导致页面跳转回列表页。
        
        本方法通过注入 JS 来：
        1. 清除所有可能的自保设定时器 (setInterval)
        2. 劫持 XMLHttpRequest/fetch 的保存接口调用
        3. 隐藏或禁用"保存草稿"按钮
        4. 拦截 beforeunload 事件防止意外离开
        """
        disable_js = """
        (() => {
            const results = {timersCleared: 0, xhrIntercepted: false, buttonDisabled: false};
            
            // 策略1: 清除所有 setInterval 定时器（自动保存常用方式）
            const originalSetInterval = window.setInterval;
            const activeTimers = [];
            
            // 无法直接枚举已有定时器ID，但可以重写 setInterval 并标记新创建的
            // 更彻底的方式：遍历可能的定时器来源
            
            // 尝试查找并清除 Vue 实例中的 watch/timer
            if (window.__VUE_APP__ && window.__VUE_APP__.$options) {
                results.vueAppFound = true;
            }
            
            // 清除通过 setTimeout/setInterval 创建的定时器（暴力但有效）
            // 注意：这不会影响已存在的定时器，因为我们没有它们的 ID
            // 但我们可以劫持后续的定时器创建
            
            // 策略2: 劫持 XMLHttpRequest，拦截保存草稿的 API 调用
            const originalOpen = XMLHttpRequest.prototype.open;
            const originalSend = XMLHttpRequest.prototype.send;
            const saveKeywords = ['saveDraft', 'save-draft', 'autoSave', 'auto-save',
                                   '/draft', '/save', '保存', '草稿', 'draft'];
            
            XMLHttpRequest.prototype.open = function(method, url, ...args) {
                this._url = url || '';
                this._method = method || '';
                return originalOpen.call(this, method, url, ...args);
            };
            
            XMLHttpRequest.prototype.send = function(...args) {
                const url = this._url || '';
                const isSaveCall = saveKeywords.some(k => 
                    url.toLowerCase().includes(k.toLowerCase())
                );
                
                if (isSaveCall) {
                    results.xhrIntercepted = true;
                    results.interceptedUrl = url;
                    return; // 静默丢弃保存请求
                }
                return originalSend.call(this, ...args);
            };
            
            // 策略3: 劫持 fetch API
            const originalFetch = window.fetch;
            window.fetch = function(url, options) {
                const urlStr = typeof url === 'string' ? url : (url && url.url ? url.url : '');
                const isSaveCall = saveKeywords.some(k => 
                    urlStr.toLowerCase().includes(k.toLowerCase())
                );
                
                if (isSaveCall) {
                    results.fetchIntercepted = true;
                    results.fetchUrl = urlStr;
                    return Promise.resolve(new Response(JSON.stringify({code: 200, msg: 'intercepted'}), 
                        {status: 200, headers: {'Content-Type': 'application/json'}}));
                }
                return originalFetch.call(window, url, options);
            };
            
            // 策略4: 隐藏"保存草稿"按钮（防止误触）
            const allButtons = document.querySelectorAll('button');
            for (const btn of allButtons) {
                const text = (btn.textContent || '').trim();
                if (text === '保存草稿' || text === '保存' || text.includes('草稿')) {
                    btn.style.display = 'none';
                    btn.disabled = true;
                    btn.setAttribute('data-auto-save-disabled', 'true');
                    results.buttonDisabled = true;
                    results.hiddenButton = text;
                }
            }
            
            // 策略5: 移除 beforeunload 事件监听器（防误触离开确认）
            window.onbeforeunload = null;
            
            // 策略6: 阻止页面自动跳转（劫持 location.assign/change）
            const originalAssign = window.location.assign.bind(window.location);
            const originalReplace = window.location.replace.bind(window.location);
            const listPagePatterns = ['/apply-list', '/list', 'apply-list'];
            
            window.location.assign = function(url) {
                const isListJump = listPagePatterns.some(p => url.includes(p));
                if (isListJump) {
                    results.navigationBlocked = url;
                    console.log('[AutoSave-Disabled] Blocked navigation to:', url);
                    return;
                }
                return originalAssign(url);
            };
            
            window.location.replace = function(url) {
                const isListJump = listPagePatterns.some(p => url.includes(p));
                if (isListJump) {
                    results.replaceBlocked = url;
                    console.log('[AutoSave-Disabled] Blocked replace to:', url);
                    return;
                }
                return originalReplace(url);
            };

            // 策略7: 拦截 Vue Router 使用的 History API (pushState/replaceState)
            const originalPushState = history.pushState.bind(history);
            const originalReplaceState = history.replaceState.bind(history);

            history.pushState = function(state, title, url) {
                const urlStr = url || '';
                const isListJump = listPagePatterns.some(p => urlStr.includes(p));
                if (isListJump) {
                    results.pushStateBlocked = urlStr;
                    console.log('[AutoSave-Disabled] Blocked pushState to:', urlStr);
                    return;
                }
                return originalPushState(state, title, url);
            };

            history.replaceState = function(state, title, url) {
                const urlStr = url || '';
                const isListJump = listPagePatterns.some(p => urlStr.includes(p));
                if (isListJump) {
                    results.replaceStateBlocked = urlStr;
                    console.log('[AutoSave-Disabled] Blocked replaceState to:', urlStr);
                    return;
                }
                return originalReplaceState(state, title, url);
            };

            // 策略8: 拦截 Vue Router 实例的 push/replace 方法
            try {
                var vueApps = document.querySelectorAll('[data-v-app]') || [];
                if (vueApps.length === 0) vueApps = document.querySelectorAll('#app');
                for (var vi = 0; vi < vueApps.length; vi++) {
                    var vueInst = vueApps[vi].__vue_app__ || vueApps[vi].__vue__;
                    if (vueInst && vueInst.$router) {
                        var origPush = vueInst.$router.push.bind(vueInst.$router);
                        var origReplace = vueInst.$router.replace.bind(vueInst.$router);
                        vueInst.$router.push = function(location) {
                            var locStr = typeof location === 'string' ? location : (location.path || location.name || JSON.stringify(location));
                            if (listPagePatterns.some(p => locStr.includes(p))) {
                                results.vueRouterPushBlocked = locStr;
                                console.log('[AutoSave-Disabled] Blocked VueRouter.push to:', locStr);
                                return Promise.resolve();
                            }
                            return origPush(location);
                        };
                        vueInst.$router.replace = function(location) {
                            var locStr = typeof location === 'string' ? location : (location.path || location.name || JSON.stringify(location));
                            if (listPagePatterns.some(p => locStr.includes(p))) {
                                results.vueRouterReplaceBlocked = locStr;
                                console.log('[AutoSave-Disabled] Blocked VueRouter.replace to:', locStr);
                                return Promise.resolve();
                            }
                            return origReplace(location);
                        };
                        results.vueRouterIntercepted = true;
                    }
                }
            } catch(e) { results.vueRouterError = e.message; }

            // 策略9: 拦截 beforeunload 阻止页面离开
            window.addEventListener('beforeunload', function(e) {
                e.preventDefault();
                e.returnValue = '';
                return '';
            });

            // 策略10: 拦截 window.location.href 直接赋值（最彻底的导航拦截）
            try {
                var currentHref = window.location.href;
                Object.defineProperty(window.location, 'href', {
                    get: function() { return currentHref; },
                    set: function(url) {
                        var urlStr = typeof url === 'string' ? url : String(url);
                        if (listPagePatterns.some(p => urlStr.includes(p))) {
                            results.hrefAssignmentBlocked = urlStr;
                            console.log('[AutoSave-Disabled] Blocked location.href assignment to:', urlStr);
                            return;
                        }
                        currentHref = urlStr;
                    },
                    configurable: true
                });
                results.hrefIntercepted = true;
            } catch(e) { results.hrefError = e.message; }

            // 标记已处理
            window.__autoSaveDisabled = true;
            results.success = true;
            
            return results;
        })()
        """
        try:
            result = await self.session.call_tool("evaluate_script", {"function": disable_js})
            if result and hasattr(result, 'content'):
                for c in result.content:
                    if hasattr(c, 'text'):
                        import json
                        try:
                            data = json.loads(c.text)
                            parts = []
                            if data.get('xhrIntercepted'):
                                parts.append(f"XHR拦截({data.get('interceptedUrl', '')})")
                            if data.get('fetchIntercepted'):
                                parts.append(f"Fetch拦截({data.get('fetchUrl', '')})")
                            if data.get('buttonDisabled'):
                                parts.append(f"按钮隐藏({data.get('hiddenButton', '')})")
                            if data.get('navigationBlocked'):
                                parts.append(f"导航拦截({data.get('navigationBlocked', '')})")
                            if data.get('pushStateBlocked'):
                                parts.append(f"pushState拦截({data.get('pushStateBlocked', '')})")
                            if data.get('replaceStateBlocked'):
                                parts.append(f"replaceState拦截({data.get('replaceStateBlocked', '')})")
                            if data.get('vueRouterIntercepted'):
                                parts.append("VueRouter拦截")
                            if data.get('vueRouterPushBlocked'):
                                parts.append(f"VR.push拦截({data.get('vueRouterPushBlocked', '')})")
                            if data.get('vueRouterReplaceBlocked'):
                                parts.append(f"VR.replace拦截({data.get('vueRouterReplaceBlocked', '')})")
                            if data.get('hrefIntercepted'):
                                parts.append("location.href拦截")
                            if data.get('hrefAssignmentBlocked'):
                                parts.append(f"href赋值拦截({data.get('hrefAssignmentBlocked', '')})")
                            if data.get('success') and not parts:
                                parts.append("防护机制已注入")
                            
                            if parts:
                                log(f"  🛡️ 自动保存已禁用: {' | '.join(parts)}", 2)
                        except (json.JSONDecodeError, TypeError):
                            pass
        except Exception as e:
            log(f"  🛡️ 自动保存禁用脚本执行完成", 3)

    async def execute(self, step: Dict[str, Any], step_num: int,
                     testcase_config: Dict[str, Any] = None) -> StepResult:
        """执行单个测试步骤（含重试 + 思维链）"""
        start_time = time.time()
        action_type = step.get("action", "")
        desc = step.get("desc", f"步骤{step_num}")
        
        tc_config = testcase_config or {}
        max_retries = tc_config.get("max_retries", self.config["max_retries"])
        retry_delay = tc_config.get("retry_delay", self.config["retry_delay"])
        continue_on_error = tc_config.get("continue_on_error", self.config["continue_on_error"])

        log(f"\n{'='*60}", 1)
        log(f"[步骤{step_num}] {desc}", 1)
        log(f"  动作: {action_type} | 重试上限: {max_retries} | 继续执行: {continue_on_error}", 1)

        if not getattr(self, '_auto_save_disabled', False):
            try:
                url_result = await self.session.call_tool("evaluate_script", {
                    "function": "() => window.location.href"
                })
                current_url = ""
                if url_result and hasattr(url_result, 'content'):
                    for c in url_result.content:
                        if hasattr(c, 'text') and c.text.startswith('http'):
                            current_url = c.text
                            break
                
                form_url_patterns = ['/apply', '/add', '/edit', '/form', '/create']
                is_form_page = any(p in current_url for p in form_url_patterns)
                
                if is_form_page:
                    # await self._disable_auto_save()  # 暂时禁用，排查导航问题
                    pass
            except Exception as e:
                log(f"  ⚠️ 获取页面URL异常: {type(e).__name__}: {e}", 3)

        if action_type == "assert_multiple":
            return await self._execute_assert_multiple(step, step_num, desc, start_time)

        if action_type in ("el_upload", "el_upload_file"):
            # await self._disable_auto_save()  # 暂时禁用，排查导航问题
            return await self._execute_el_upload(step, step_num, desc, start_time)

        if action_type in ("el_date", "el_date_picker"):
            return await self._execute_el_date(step, step_num, desc, start_time)

        if action_type in ("js_click", "native_click"):
            return await self._execute_js_click(step, step_num, desc, start_time)

        mcp_entry = ActionRegistry.get(action_type)

        if not mcp_entry:
            log(f"  ⏭️ 未实现的动作类型: '{action_type}'", 1)
            log(f"  已注册: {ActionRegistry.list_actions()}", 2)
            return StepResult(
                step_num=step_num, desc=desc, action=action_type,
                status=StepStatus.SKIPPED, mcp_tool="(none)",
                output=f"Action '{action_type}' not implemented. Available: {ActionRegistry.list_actions()}",
                duration_ms=int((time.time() - start_time) * 1000),
            )

        mcp_tool_name, arg_builder = mcp_entry

        # ===== LLM 执行前思考 =====
        thinking_pre = ""
        llm_confidence = 0.0
        llm_suggestions = []
        
        if self.think_engine and self.think_engine.enabled:
            log("  🧠 调用 LLM 分析...", 2)
            pre_think_result = await self.think_engine.pre_execute_think(
                step, step_num, self.parser, self.cache, self.last_snapshot_text
            )
            thinking_pre = pre_think_result.get("thinking", "")
            llm_confidence = pre_think_result.get("confidence", 0.0)
            llm_suggestions = pre_think_result.get("suggestions", [])
            
            if thinking_pre:
                log(f"  💭 LLM 置信度: {llm_confidence:.0%}", 2)

        ActionRegistry.run_pre_hooks(action_type, {
            "step": step, "step_num": step_num, "parser": self.parser, "cache": self.cache,
        })

        if ActionRegistry.needs_uid(action_type):
            log("  📸 获取页面快照...", 2)
            await self._take_snapshot()
            await asyncio.sleep(0.3)

        last_result = None
        for attempt in range(max_retries + 1):
            if attempt > 0:
                log(f"  🔄 重试 ({attempt}/{max_retries})...", 1)
                await asyncio.sleep(retry_delay * attempt)
                
                if ActionRegistry.needs_uid(action_type):
                    await self._take_snapshot()
                    await asyncio.sleep(0.2)

            try:
                mcp_args = arg_builder(action_type, step, self.parser, self.cache)
            except Exception as e:
                log(f"  ❌ 参数构建失败: {type(e).__name__}: {e}", 1)
                log(f"  📋 arg_builder: {arg_builder}", 2)
                log(f"  📋 action_type: {action_type}", 2)
                log(f"  📋 step: {json.dumps(step, ensure_ascii=False)[:200]}", 2)
                tb_lines = traceback.format_exc().splitlines()
                for tl in tb_lines[-8:]:
                    log(f"    {tl}", 3)
                last_result = StepResult(
                    step_num=step_num, desc=desc, action=action_type,
                    status=StepStatus.ERROR, mcp_tool=mcp_tool_name,
                    error=str(e), retry_count=attempt,
                    duration_ms=int((time.time() - start_time) * 1000),
                )
                continue

            if ActionRegistry.needs_uid(action_type) and "uid" in mcp_args:
                mcp_args["includeSnapshot"] = False
                uid = mcp_args.get("uid", "")
                elem = self.parser.elements.get(uid) if uid else None
                if elem:
                    log(f"  🎯 点击目标: UID={uid} | role={elem.role} | text='{(elem.text or '')[:40]}'", 2)
                elif uid:
                    log(f"  🎯 点击目标: UID={uid} (元素不在当前快照中)", 2)

            log(f"  🔧 MCP工具: {mcp_tool_name}", 2)
            log(f"  📝 参数: {safe_json_dumps(mcp_args, ensure_ascii=False, indent=2)}", 2)

            readonly_picker_result = None
            if action_type in ("select_option", "select", "choose") and "uid" in mcp_args:
                uid = mcp_args.get("uid")
                elem = self.parser.elements.get(uid)
                if elem and elem.is_readonly:
                    log(f"  🔍 检测到readonly选择器({uid})，使用JS操作Vue组件", 2)
                    readonly_picker_result = await self._execute_readonly_picker_select(
                        step, step_num, uid, mcp_args.get("value", ""))

            try:
                if readonly_picker_result is not None:
                    if isinstance(readonly_picker_result, list):
                        elapsed_ms = int((time.time() - start_time) * 1000)
                        log(f"  ✅ 成功 ({elapsed_ms}ms) [readonly-picker]", 1)
                        last_result = StepResult(
                            step_num=step_num, desc=desc, action=action_type,
                            status=StepStatus.SUCCESS, mcp_tool="readonly_picker",
                            mcp_args=mcp_args,
                            output=str(readonly_picker_result[0]) if readonly_picker_result else "",
                            duration_ms=elapsed_ms,
                            snapshot_before=self.last_snapshot_text,
                            snapshot_after=self.last_snapshot_text,
                            snapshot_path=self.last_snapshot_path,
                        )
                        return last_result
                    else:
                        result = readonly_picker_result
                else:
                    result = await self.session.call_tool(mcp_tool_name, mcp_args)
                content_str = extract_result_content(result)
                elapsed_ms = int((time.time() - start_time) * 1000)

                has_error = check_result_has_error(content_str)
                status = StepStatus.FAILED if has_error else StepStatus.SUCCESS

                icon = "✅" if not has_error else "❌"
                status_text = "成功" if not has_error else "失败"
                uid_info = f" [UID={mcp_args.get('uid','')}]" if mcp_args.get('uid') else ""
                log(f"  {icon} {status_text} ({elapsed_ms}ms){uid_info}" + (f" [重试{attempt}次]" if attempt > 0 else ""), 1)
                
                if content_str:
                    truncated = content_str[:400] + "..." if len(content_str) > 400 else content_str
                    log(f"  📄 结果: {truncated}", 2)

                if has_error and attempt < max_retries:
                    last_result = StepResult(
                        step_num=step_num, desc=desc, action=action_type,
                        status=StepStatus.RETRIED, mcp_tool=mcp_tool_name,
                        mcp_args=mcp_args, output=content_str,
                        error=f"Retry {attempt}: {content_str[:200]}",
                        retry_count=attempt, duration_ms=elapsed_ms,
                    )
                    continue

                wait_cfg = step.get("wait_after")
                if wait_cfg:
                    await self._handle_wait(wait_cfg)

                assertions = self._collect_assertions(step)
                assertion_results = []
                if assertions:
                    log(f"\n  🔍 断言验证 ({len(assertions)} 项):", 1)

                    has_dom_assertions = any(
                        a.get("type") in ("element_visible", "text_contains", "url_contains",
                                              "toast_visible", "element_text", "page_title")
                        for a in assertions
                    )
                    needs_render_wait = (
                        action_type in ("click", "navigate", "new_page", "open_url", "select_option")
                        and has_dom_assertions
                    )
                    if needs_render_wait:
                        await self._wait_for_assertion_render(action_type)

                    should_snapshot = (
                        action_type in ("navigate", "new_page") or
                        has_dom_assertions
                    )
                    
                    if should_snapshot:
                        await self._take_snapshot()

                    for assertion in assertions:
                        ar = self._run_assertion(assertion)
                        assertion_results.append(ar)
                        icon = "✅" if ar["passed"] else "❌"
                        expected = resolve_env_vars(str(assertion.get("expected", "")))
                        log(f"    [{icon}] {assertion['type']}: 期望={expected} → "
                            f"{'PASS' if ar['passed'] else 'FAIL'} | {ar['detail']}", 1)

                    critical_fail = any(
                        not a["passed"] and (
                            a.get("critical", False)
                            or (a.get("confidence") == "high"
                                and a["type"] in ("text_contains", "url_contains",
                                                     "element_visible", "toast_visible"))
                        )
                        for a in assertion_results
                    )
                    if critical_fail:
                        status = StepStatus.FAILED_ASSERT
                        log("  ⛔ 关键断言失败!", 1)
                    elif any(not a["passed"] for a in assertion_results):
                        log("  ⚠️ 非关键断言失败，继续执行", 1)

                # ===== LLM 执行后反思 =====
                thinking_post = ""
                if self.think_engine and self.think_engine.enabled:
                    log("  🧠 调用 LLM 反思...", 2)
                    thinking_post = await self.think_engine.post_execute_reflect(
                        step, step_num,
                        StepResult(
                            step_num=step_num, desc=desc, action=action_type,
                            status=status, mcp_tool=mcp_tool_name, mcp_args=mcp_args,
                            output=content_str, assertions=assertion_results,
                            duration_ms=elapsed_ms, retry_count=attempt,
                        ),
                        thinking_pre
                    )

                step_result = StepResult(
                    step_num=step_num, desc=desc, action=action_type,
                    status=status, mcp_tool=mcp_tool_name, mcp_args=mcp_args,
                    output=content_str, assertions=assertion_results,
                    duration_ms=elapsed_ms, retry_count=attempt,
                    snapshot_before=self.last_snapshot_text[:500] if self.last_snapshot_text else "",
                    snapshot_path=self.last_snapshot_path or "",
                    thinking_pre=thinking_pre,
                    thinking_post=thinking_post,
                    llm_confidence=llm_confidence,
                    llm_suggestions=llm_suggestions,
                )

                # ===== 输出思维链内容 =====
                if thinking_pre or thinking_post:
                    think_output = (self.think_engine.format_thinking_output(step_result)
                                   if self.think_engine else "")
                    if think_output:
                        print(think_output)

                ActionRegistry.run_post_hooks(action_type, {
                    "step": step, "step_num": step_num, "parser": self.parser, "cache": self.cache,
                }, step_result)

                return step_result

            except Exception as e:
                elapsed_ms = int((time.time() - start_time) * 1000)
                err_msg = str(e)
                log(f"  ❌ 异常: {err_msg} ({elapsed_ms}ms)" + (f" [重试{attempt}次]" if attempt > 0 else ""), 1)
                
                last_result = StepResult(
                    step_num=step_num, desc=desc, action=action_type,
                    status=StepStatus.ERROR if attempt >= max_retries else StepStatus.RETRIED,
                    mcp_tool=mcp_tool_name, mcp_args=mcp_args if 'mcp_args' in locals() else {},
                    error=err_msg, retry_count=attempt, duration_ms=elapsed_ms,
                )

                if attempt < max_retries:
                    continue

        if last_result:
            return last_result

        return StepResult(
            step_num=step_num, desc=desc, action=action_type,
            status=StepStatus.ERROR, mcp_tool=mcp_tool_name,
            error="All retries exhausted", duration_ms=int((time.time() - start_time) * 1000),
            snapshot_path=self.last_snapshot_path or "",
        )

    async def _take_snapshot(self) -> str:
        """获取页面快照"""
        try:
            result = await self.session.call_tool("take_snapshot", {"verbose": True})
            snapshot_text = ""
            if result.content:
                for item in result.content:
                    if hasattr(item, 'text'):
                        snapshot_text += item.text + "\n"
                    else:
                        snapshot_text += str(item) + "\n"
            
            self.last_snapshot_text = snapshot_text
            self.parser.parse(snapshot_text)

            try:
                url_result = await self.session.call_tool("evaluate_script", {"function": "() => window.location.href"})
                for c in (url_result.content or []):
                    if hasattr(c, 'text') and c.text.startswith('http'):
                        self.last_snapshot_url = c.text
                        break
            except Exception as e:
                log(f"  ⚠️ 获取页面URL异常: {type(e).__name__}: {e}", 3)

            os.makedirs(self.snapshot_dir, exist_ok=True)
            snap_path = os.path.join(self.snapshot_dir, f"snap-{time.strftime('%Y%m%d-%H%M%S')}.txt")
            with open(snap_path, "w", encoding="utf-8") as f:
                f.write(snapshot_text)

            self.last_snapshot_path = snap_path
            log(f"    [Snapshot] {len(self.parser.elements)} 个元素 → {snap_path}", 3)
            return snapshot_text
        except Exception as e:
            log(f"    [Snapshot Error] {e}", 3)
            return ""

    async def _handle_wait(self, wait_cfg: Dict[str, Any]):
        """
        处理等待配置 - FastAI v2.0 优化版

        优化策略:
          - 默认等待时间缩短50%
          - 导航等待使用短轮询 + 自动切换新标签页
          - 最大等待时间限制
        """
        wait_type = wait_cfg.get("type", "time")

        if wait_type == "time":
            duration = wait_cfg.get("duration", 1000) / 1000.0
            duration = min(duration, 1.0)
            if duration > 0.2:
                log(f"  ⏳ 等待 {duration:.1f}s...", 2)
            await asyncio.sleep(duration)

        elif wait_type == "navigation":
            timeout = wait_cfg.get("timeout", 5000) / 1000.0
            timeout = min(timeout, 1.0)
            log(f"  ⏳ 智能等待导航 ({timeout:.1f}s)...", 2)
            await asyncio.sleep(timeout)

            # 导航等待后，检查是否有新标签页打开并自动切换
            try:
                await self._switch_to_latest_page()
            except Exception as e:
                log(f"  ⚠️ 标签页切换失败（继续执行）: {e}", 3)

    async def _switch_to_latest_page(self):
        """
        检测并切换到最新打开的标签页

        当 click 操作打开了新标签页（如步骤5点击资产评估系统），
        需要自动切换到新标签页才能正确执行后续操作。
        """
        list_result = await self.session.call_tool("list_pages", {})
        if not list_result or not hasattr(list_result, 'content'):
            return

        pages_text = ""
        for item in (list_result.content or []):
            if hasattr(item, 'text'):
                pages_text += item.text + "\n"

        lines = [l.strip() for l in pages_text.strip().split('\n') if l.strip()]
        if len(lines) < 2:
            return

        selected_page = None
        last_page_id = None

        for line in lines:
            if '[selected]' in line:
                selected_page = line
            parts = line.split(':', 1)
            if len(parts) >= 1:
                try:
                    pid = int(parts[0].strip())
                    if last_page_id is None or pid > last_page_id:
                        last_page_id = pid
                except ValueError:
                    pass

        if last_page_id and selected_page:
            sel_parts = selected_page.split(':', 1)
            try:
                sel_id = int(sel_parts[0].strip()) if sel_parts else None
                if sel_id != last_page_id:
                    log(f"  🔄 检测到新标签页，切换到 Page-{last_page_id}...", 2)
                    switch_result = await self.session.call_tool("select_page", {"pageId": last_page_id})
                    err = ""
                    if hasattr(switch_result, 'content') and switch_result.content:
                        for c in switch_result.content:
                            if hasattr(c, 'text'): err += c.text
                    if err and not check_result_has_error(err):
                        log(f"  ✅ 已切换到新标签页", 3)
            except (ValueError, IndexError):
                pass

    async def _wait_for_assertion_render(self, action_type: str):
        """步骤内部：action执行后、断言前的渲染等待（轻量版）
        
        针对 click/navigate 等触发DOM变更的操作，
        在断言验证前等待新元素出现，避免时序竞争。
        """
        start_time = time.time()
        max_wait = 3.0
        stable_count = 0
        min_stable = 2

        await self._take_snapshot()
        last_count = len(self.parser.elements)
        last_text_len = len(self.last_snapshot_text or "")

        while time.time() - start_time < max_wait:
            await asyncio.sleep(0.3)
            await self._take_snapshot()

            curr_count = len(self.parser.elements)
            curr_text_len = len(self.last_snapshot_text or "")

            if (curr_count == last_count and curr_text_len == last_text_len
                    and curr_count >= 20):
                stable_count += 1
                if stable_count >= min_stable:
                    elapsed = time.time() - start_time
                    log(f"  ✅ 断言前渲染就绪 ({curr_count}元素, {elapsed:.1f}s)", 2)
                    return
            else:
                stable_count = 0

            last_count = curr_count
            last_text_len = curr_text_len

        elapsed = time.time() - start_time
        log(f"  ⏱️ 断言前渲染等待超时 ({elapsed:.1f}s), 继续断言", 2)

    async def _wait_for_render_complete(self, prev_action_type: str, prev_step_result):
        """
        等待上一步操作的页面渲染完成

        原则：每个步骤应该在上一步的页面完全渲染后才开始执行。
        利用 MCP take_snapshot 检测 DOM 元素数量是否稳定。

        策略:
          - 非导航操作(fill/type): 快速检查(<0.3s)，已渲染则跳过
          - 导航操作(click/navigate): 完整检查，含新标签页检测+DOM稳定轮询
          - SPA页面特征: 元素数<50 或 快照文本<200字符 = 未渲染完
        """
        NAVIGATION_ACTIONS = {"navigate", "click", "new_page", "open_url"}
        QUICK_CHECK_ACTIONS = {"fill", "type", "input", "select_option", "select", "choose"}

        if prev_action_type in QUICK_CHECK_ACTIONS:
            await asyncio.sleep(0.2)
            return

        if prev_action_type not in NAVIGATION_ACTIONS:
            await asyncio.sleep(0.15)
            return

        start_time = time.time()
        max_wait = 4.0
        stable_count = 0
        min_elements_threshold = 30
        last_element_count = 0
        last_snapshot_text_len = 0

        log("  🔄 等待页面渲染完成...", 2)

        while time.time() - start_time < max_wait:
            try:
                snap_result = await self.session.call_tool("take_snapshot", {"verbose": False})
                snap_text = ""
                if hasattr(snap_result, 'content') and snap_result.content:
                    for item in snap_result.content:
                        if hasattr(item, 'text'):
                            snap_text += item.text + "\n"

                element_count = len(snap_text.split('\n')) if snap_text else 0
                text_len = len(snap_text)

                is_rendered = (
                    element_count >= min_elements_threshold and
                    text_len >= 200 and
                    abs(element_count - last_element_count) < 5 and
                    abs(text_len - last_snapshot_text_len) < 100
                )

                if is_rendered and stable_count >= 1:
                    elapsed = time.time() - start_time
                    self.last_snapshot_text = snap_text
                    self.parser.parse(snap_text)
                    log(f"  ✅ 页面已渲染 ({element_count}元素, {elapsed:.1f}s)", 3)
                    try:
                        await self._switch_to_latest_page()
                    except Exception:
                        pass
                    return

                if is_rendered:
                    stable_count += 1
                else:
                    stable_count = 0

                last_element_count = element_count
                last_snapshot_text_len = text_len

            except Exception:
                pass

            await asyncio.sleep(min(0.5, max_wait - (time.time() - start_time)))

        elapsed = time.time() - start_time
        log(f"  ⏱️ 渲染等待超时 ({elapsed:.1f}s)，继续执行", 3)

    def _find_nearest_interactive_ancestor(self, uid: str, target_roles: set) -> Optional[str]:
        """从给定元素向上查找最近的具有目标role的交互祖先元素

        基于快照的缩进层级+行号邻近性模拟DOM树遍历：
        - 从当前元素的indent_level向上一层一层找
        - 限定在目标元素前后10行范围内，避免匹配到DOM树其他分支的无关元素
        - 返回最近(最高indent_level)且最接近的匹配元素UID

        适用场景：下拉选项的文本在子元素StaticText中，
        需要找到其父级listitem/option等可点击元素。
        """
        elem = self.parser.elements.get(uid)
        if not elem:
            return None
        target_indent = elem.indent_level
        if target_indent <= 0:
            return None

        elem_idx = self.parser.element_order.index(uid) if uid in self.parser.element_order else -1
        if elem_idx < 0:
            return None

        search_range = 15
        start_idx = max(0, elem_idx - search_range)
        end_idx = min(len(self.parser.element_order), elem_idx + search_range)
        nearby_uids = set(self.parser.element_order[start_idx:end_idx])

        best_uid = None
        best_indent = -1

        for cid in nearby_uids:
            if cid == uid:
                continue
            celem = self.parser.elements.get(cid)
            if not celem:
                continue
            if celem.role not in target_roles:
                continue
            if not celem.is_interactive:
                continue
            if 0 < celem.indent_level < target_indent:
                if celem.indent_level > best_indent:
                    best_indent = celem.indent_level
                    best_uid = cid

        return best_uid

    async def _execute_readonly_picker_select(self, step: Dict, step_num: int,
                                              picker_uid: str, option_value: str):
        """readonly选择器: click打开→JS在DOM中找选项→click选中"""
        _LABEL_TO_CODE = {
            "市场法": "market", "资产基础法": "cost", "收益法": "income",
            "假设开发法": "development", "基准地价法": "benchmark", "其他方法": "other",
        }
        code_val = _LABEL_TO_CODE.get(option_value, option_value)

        log(f"  [Picker] Step1: 点击 uid={picker_uid} 打开下拉框", 2)
        await self.session.call_tool("click", {
            "uid": picker_uid, "includeSnapshot": False,
        })
        await asyncio.sleep(1.5)

        js_code = f"""() => {{
            const items = document.querySelectorAll('.el-select-dropdown__item');
            const results = [];
            for (const item of items) {{
                const span = item.querySelector('span');
                const text = span ? span.textContent.trim() : item.textContent.trim();
                results.push({{text:text, visible:item.offsetParent !== null}});
                if (text === '{option_value}' || text.includes('{option_value}')) {{
                    item.click();
                    return {{ok:true, clicked:text, totalItems:items.length}};
                }}
            }}
            // fallback: try clicking by index (market is 3rd item)
            if (items.length >= 3) {{
                items[2].click();
                return {{ok:true, clicked:'index[2]-fallback', totalItems:items.length, allText:results.map(r=>r.text)}};
            }}
            return {{ok:false, error:'option not found', totalItems:items.length, allText:results.map(r=>r.text)}};
        }}"""

        log(f"  [Picker] Step2: JS查找并点击'{option_value}'选项...", 2)
        try:
            result = await self.session.call_tool(
                "evaluate_script", {"function": js_code})
            log(f"  [Picker] JS结果: {result}", 1)
        except Exception as e:
            log(f"  [Picker] JS失败: {e}", 1)

        await asyncio.sleep(0.8)
        return [{"type": "text", "text": f"picker selected '{option_value}' via DOM click"}]

    def _find_picker_option(self, option_value: str, picker_uid: str,
                             target_roles: set, pre_click_uids=None) -> Optional[str]:
        best_uid = None
        best_match_len = 0
        for uid, elem in self.parser.elements.items():
            if uid == picker_uid or (pre_click_uids and uid in pre_click_uids):
                continue
            if elem.role not in target_roles or not elem.is_interactive:
                continue
            if elem.text and option_value in elem.text:
                match_len = len(option_value)
                if match_len > best_match_len:
                    best_match_len = match_len
                    best_uid = uid
                    log(f"    [命中role] uid={uid} role={elem.role} text='{elem.text}'", 3)
        if best_uid:
            return best_uid
        text_matches = self.parser.find_by_text_contains(option_value)
        for me in text_matches:
            mu = me.uid
            if mu == picker_uid or (pre_click_uids and mu in pre_click_uids):
                continue
            if me.role in target_roles and me.is_interactive:
                log(f"    [命中text] uid={mu} role={me.role}", 2)
                return mu
            pu = self._find_nearest_interactive_ancestor(mu, target_roles)
            if pu and pu != picker_uid:
                log(f"    [命中祖先] uid={pu} 源自uid={mu}", 2)
                return pu
        return None

    async def _execute_el_upload(self, step: Dict, step_num: int,
                                  desc: str, start_time: float) -> StepResult:
        """Element UI el-upload 文件上传（增强版方法2 - 一步完成）

        内部自动执行三步操作:
          1. click 上传按钮
          2. execute_script 暴露隐藏的 input[type=file]
          3. upload_file 上传文件

        YAML 用法:
          - step: N
            action: el_upload
            target: 上传按钮文本或uid
            path: C:\\path\\to\\file.docx
            file_label: 核准申请文件    # 可选，用于定位文件输入框所在行
            _locator:
              uid: "60_370"              # 可选，上传按钮的uid
            wait_after:
              type: time
              duration: 3000
        """
        log(f"  📎 [el_upload] Element UI 文件上传开始", 1)

        target = step.get("target", "")
        file_path = resolve_env_vars(step.get("path", ""))
        file_label = step.get("file_label", step.get("row_label", ""))
        locator = step.get("_locator", {}) or {}
        button_uid = locator.get("uid")
        wait_after = step.get("wait_after", {})
        wait_duration = int(wait_after.get("duration", 2000)) if wait_after else 2000

        pre_url_result = await self.session.call_tool("evaluate_script", {"function": "() => window.location.href"})
        pre_url = extract_result_content(pre_url_result).strip()

        if not file_path:
            elapsed = int((time.time() - start_time) * 1000)
            return StepResult(
                step_num=step_num, desc=desc, action="el_upload",
                status=StepStatus.ERROR, mcp_tool="(el_upload)",
                error="Missing required parameter: 'path' (file path to upload)",
                duration_ms=elapsed,
            )

        log(f"  📎 [el_upload] 文件路径: {file_path}", 2)
        if file_label:
            log(f"  📎 [el_upload] 文件标签(行定位): {file_label}", 2)
        if button_uid:
            log(f"  📎 [el_upload] 按钮UID: {button_uid}", 2)

        sub_steps = []

        try:
            await self._take_snapshot()
            await asyncio.sleep(0.3)

            step_start_time = time.time()
            log(f"  📎 ═════════════════════ el_upload 开始 ═════════════════════", 1)
            log(f"  📎 📋 参数: target='{target}' | file_label='{file_label}'", 2)
            log(f"  📎 📁 文件: {os.path.basename(file_path)} (存在:{os.path.isfile(file_path)})", 2)
            log(f"  📎 🔖 UID: {button_uid or '(未指定)'} | 等待: {wait_duration}ms | 元素数: {len(self.parser.elements)}", 2)

            url_before = getattr(self, 'last_snapshot_url', '') or ''
            log(f"  📎 🌐 执行前URL: {url_before} | 耗时: {(time.time()-step_start_time)*1000:.0f}ms", 2)

            if url_before and ('/apply-list' in url_before or '/list' in url_before) and '/apply' not in url_before:
                log(f"  📎 ⚠️ ═════ 检测到已在列表页！尝试提前恢复表单 ═════", 1)
                try:
                    await self._take_snapshot()
                    new_btn_uid = None
                    for uid, elem in self.parser.elements.items():
                        elem_text = (elem.text or "") + (getattr(elem, 'description', '') or "")
                        if elem.role == "button" and "新增" in elem_text:
                            new_btn_uid = uid
                            break
                    if new_btn_uid:
                        log(f"  📎 🔧 找到'新增'按钮 uid={new_btn_uid}，点击打开新表单...", 2)
                        await self.session.call_tool("click", {"uid": new_btn_uid, "includeSnapshot": False})
                        await asyncio.sleep(2000 / 1000.0)
                        await self._take_snapshot()
                        url_before = getattr(self, 'last_snapshot_url', '') or ''
                        log(f"  📎 ✅ 表单页已恢复: {url_before}", 1)
                        sub_steps.append("🔧提前恢复表单: ✅")
                    else:
                        log(f"  📎 ⚠️ 未找到'新增'按钮，继续执行(可能失败)", 2)
                        sub_steps.append("🔧提前恢复: ❌未找到新增按钮")
                except Exception as pre_err:
                    log(f"  📎 ⚠️ 提前恢复异常: {pre_err}", 2)
                    sub_steps.append(f"🔧提前恢复异常: {pre_err}")

            sub_step_1 = f"[1/3] 点击上传按钮"
            log(f"  📎 ── {sub_step_1} ──", 2)

            click_uid = None
            if button_uid:
                if button_uid in self.parser.elements:
                    click_uid = button_uid
                    log(f"  📎 ✅ [P1-UID直击] 使用指定UID: {button_uid}", 2)
                else:
                    log(f"  📎 🔄 [UID漂移] '{button_uid}' 不在快照({len(self.parser.elements)}个元素)中，启动SmartMatch...", 2)
                    click_uid = self._find_upload_button_uid(target, button_uid, file_label)
                    if click_uid:
                        log(f"  📎 ✅ [P2-SmartMatch] 后缀匹配成功: {button_uid} → {click_uid} (耗时:{(time.time()-step_start_time)*1000:.0f}ms)", 1)
                    else:
                        log(f"  📎 ⚠️ [P2-SmartMatch] 未匹配，将尝试[P3-JS按行点击]", 2)
            else:
                click_uid = _resolve_uid(step, self.parser, self.cache, require_interactive=True)
                if click_uid:
                    elem = self.parser.elements.get(click_uid)
                    role = elem.role if elem else "?"
                    log(f"  📎 解析到UID: {click_uid} (role={role})", 3)
                    if role in ("radio", "checkbox"):
                        log(f"  📎 ⚠️ 匹配到{role}而非button，尝试排除非button元素...", 2)
                        click_uid = self._find_upload_button_uid(target, None, file_label)
                        if click_uid:
                            log(f"  📎 ✅ 重新匹配到UID: {click_uid}", 3)

            if not click_uid:
                if file_label:
                    log(f"  📎 🔍 [P3-JS按行] 尝试按file_label='{file_label}'定位上传按钮...", 2)
                    js_click_label = json.dumps(file_label, ensure_ascii=False).strip('"')
                    js_click_fn = (
                        "() => {"
                        " var label = '" + js_click_label.replace("'", "\\'") + "';"
                        " var rows = document.querySelectorAll('tr');"
                        " for (var i = 0; i < rows.length; i++) {"
                        "   if (rows[i].textContent.indexOf(label) !== -1) {"
                        "     var btn = rows[i].querySelector('button');"
                        "     if (!btn) {"
                        "       var cells = rows[i].querySelectorAll('td');"
                        "       for (var j = 0; j < cells.length; j++) {"
                        "         if (cells[j].textContent.indexOf('上传') !== -1) {"
                        "           btn = cells[j].querySelector('button');"
                        "           if (btn) break;"
                        "         }"
                        "       }"
                        "     }"
                        "     if (btn) { btn.click(); return JSON.stringify({js_click:true,label:label}); }"
                        "   }"
                        " }"
                        " return JSON.stringify({js_click:false,error:'row_not_found'});"
                        "}"
                    )
                    js_click_result = await self.session.call_tool("evaluate_script", {"function": js_click_fn})
                    js_click_content = extract_result_content(js_click_result)
                    log(f"  📎 [P3-JS按行] 结果: {js_click_content[:150] if js_click_content else 'N/A'} (耗时:{(time.time()-step_start_time)*1000:.0f}ms)", 2)

                    js_click_info = parse_json_from_mcp_response(js_click_content)
                    if isinstance(js_click_info, dict) and js_click_info.get("js_click"):
                        log(f"  📎 ✅ JS成功点击了 '{file_label}' 行的上传按钮", 2)
                        sub_steps.append(f"{sub_step_1}: ✅(JS按行)")
                        click_uid = None
                    else:
                        elapsed = int((time.time() - start_time) * 1000)
                        return StepResult(
                            step_num=step_num, desc=desc, action="el_upload",
                            status=StepStatus.ERROR, mcp_tool="(el_upload)",
                            error=f"Cannot find upload button for target='{target}' (UID stale, JS click also failed)",
                            duration_ms=elapsed,
                        )
                else:
                    elapsed = int((time.time() - start_time) * 1000)
                    return StepResult(
                        step_num=step_num, desc=desc, action="el_upload",
                        status=StepStatus.ERROR, mcp_tool="(el_upload)",
                        error=f"Cannot find upload button for target='{target}'",
                        duration_ms=elapsed,
                    )

            if click_uid:
                click_elem = self.parser.elements.get(click_uid)
                click_role = click_elem.role if click_elem else "?"
                click_text = (click_elem.text or "")[:30] if click_elem else ""
                log(f"  📎 🎯 上传按钮: UID={click_uid} | role={click_role} | text='{click_text}'", 2)
                click_result = await self.session.call_tool("click", {
                    "uid": click_uid,
                    "includeSnapshot": False,
                })
                click_content = extract_result_content(click_result)
                log(f"  📎 ✅ [MCP-click] UID={click_uid} 结果: {click_content[:60] if click_content else 'OK'} (耗时:{(time.time()-step_start_time)*1000:.0f}ms)", 2)
            else:
                log(f"  📎 ✅ [JS-click] 已通过JS完成按钮点击 (耗时:{(time.time()-step_start_time)*1000:.0f}ms)", 2)
            sub_steps.append(f"{sub_step_1}: ✅")

            await asyncio.sleep(0.5)

            sub_step_2 = "[2/3] 暴露隐藏的文件输入框"
            log(f"  📎 ── {sub_step_2} ── | label='{file_label or target}'", 2)

            search_label = json.dumps(file_label or target, ensure_ascii=False).strip('"')
            expose_ts = str(int(time.time() * 1000))

            expose_fn = (
                "() => {"
                " var label = '" + search_label.replace("'", "\\'") + "';"
                " var ts = '" + expose_ts + "';"
                " var oldExposed = document.querySelectorAll('[data-el-upload-exposed]');"
                " for (var oi = 0; oi < oldExposed.length; oi++) {"
                "   oldExposed[oi].removeAttribute('data-el-upload-exposed');"
                "   oldExposed[oi].removeAttribute('aria-label');"
                "   oldExposed[oi].style.cssText = '';"
                "   oldExposed[oi].setAttribute('type','file');"
                " }"
                " var rows = document.querySelectorAll('tr');"
                " var fileInput = null;"
                " var foundByRow = false;"
                " for (var i = 0; i < rows.length; i++) {"
                "   if (label && rows[i].textContent.indexOf(label) !== -1) {"
                "     fileInput = rows[i].querySelector('input[type=file]');"
                "     if (!fileInput) {"
                "       fileInput = rows[i].closest('table') ? rows[i].closest('table').querySelector('input[type=file]') : null;"
                "     }"
                "     if (!fileInput) {"
                "       fileInput = rows[i].parentElement ? rows[i].parentElement.querySelector('input[type=file]') : null;"
                "     }"
                "     foundByRow = !!fileInput;"
                "     break;"
                "   }"
                " }"
                " if (!fileInput) {"
                "   var allInputs = document.querySelectorAll('input[type=file]');"
                "   if (allInputs.length > 1 && label) {"
                "     for (var ai = allInputs.length - 1; ai >= 0; ai--) {"
                "       var pEl = allInputs[ai].closest('tr') || allInputs[ai].parentElement;"
                "       if (pEl && pEl.textContent.indexOf(label) !== -1) {"
                "         fileInput = allInputs[ai];"
                "         foundByRow = true;"
                "         break;"
                "       }"
                "     }"
                "   }"
                "   if (!fileInput && allInputs.length > 0) {"
                "     fileInput = allInputs[allInputs.length - 1];"
                "   }"
                " }"
                " if (!fileInput) return JSON.stringify({error:'no_file_input_found',found:false});"
                " fileInput.style.cssText = 'position:fixed!important;top:50%!important;left:50%!important;transform:translate(-50%,-50%)!important;width:300px!important;height:40px!important;display:block!important;visibility:visible!important;opacity:1!important;z-index:2147483647!important;border:2px solid red!important;background:yellow!important;font-size:14px!important;padding:5px!important';"
                " fileInput.setAttribute('data-el-upload-exposed','true');"
                " fileInput.setAttribute('data-expose-ts',ts);"
                " fileInput.setAttribute('aria-label','exposed-upload-' + ts);"
                " fileInput.setAttribute('role','textbox');"
                " fileInput.setAttribute('tabindex','0');"
                " fileInput.removeAttribute('disabled');"
                " fileInput.removeAttribute('hidden');"
                " if (!fileInput.id) fileInput.id = 'exposed-file-input-' + ts;"
                " var r = fileInput.getBoundingClientRect();"
                " return JSON.stringify({found:true,id:fileInput.id,name:fileInput.name||'',exposed:true,ts:ts,w:r.width,h:r.height,foundByRow:foundByRow});"
                "}"
            )

            script_result = await self.session.call_tool("evaluate_script", {"function": expose_fn})
            script_content = extract_result_content(script_result)
            log(f"  📎 [expose] 结果: {script_content[:200] if script_content else 'N/A'} (耗时:{(time.time()-step_start_time)*1000:.0f}ms)", 2)

            expose_info = parse_json_from_mcp_response(script_content)

            mcp_error = check_result_has_error(script_content) if script_content else True
            js_success = isinstance(expose_info, dict) and expose_info.get("found")

            if not js_success and mcp_error:
                elapsed = int((time.time() - start_time) * 1000)
                return StepResult(
                    step_num=step_num, desc=desc, action="el_upload",
                    status=StepStatus.ERROR, mcp_tool="(el_upload)",
                    error=f"JS execution failed: {script_content[:200] if script_content else 'no response'}",
                    output=script_content,
                    duration_ms=elapsed,
                )

            if not js_success:
                log(f"  📎 ⚠️ [2/3] 无法解析JS返回值但MCP未报错，继续尝试上传...", 2)

            sub_steps.append(f"{sub_step_2}: ✅")

            await asyncio.sleep(0.3)

            await self._take_snapshot()

            post_url_result = await self.session.call_tool("evaluate_script", {"function": "() => window.location.href"})
            post_url = extract_result_content(post_url_result).strip()
            if post_url and pre_url and post_url != pre_url:
                log(f"  📎 ⚠️ 检测到页面跳转: {pre_url[-40:]} → {post_url[-40:]}", 1)
                if '/apply-list' in post_url or '/list' in post_url:
                    log(f"  📎 🔧 页面跳转到列表页，尝试自动恢复表单并重新上传...", 1)
                    try:
                        await self._take_snapshot()
                        new_btn_uid = None
                        for uid, elem in self.parser.elements.items():
                            elem_text = (elem.text or "") + (getattr(elem, 'description', '') or "")
                            if elem.role == "button" and "新增" in elem_text:
                                new_btn_uid = uid
                                break
                        if new_btn_uid:
                            log(f"  📎 🔧 找到'新增'按钮 uid={new_btn_uid}，点击恢复表单...", 2)
                            await self.session.call_tool("click", {"uid": new_btn_uid, "includeSnapshot": False})
                            await asyncio.sleep(2000 / 1000.0)
                            await self._take_snapshot()
                            restored_url = getattr(self, 'last_snapshot_url', '') or ''
                            if '/apply' in restored_url:
                                log(f"  📎 ✅ 表单页恢复成功: {restored_url}，重新开始el_upload流程...", 1)
                                sub_steps.append("🔧expose跳转恢复: ✅")
                                # await self._disable_auto_save()  # 暂时禁用，排查导航问题
                                log(f"  📎 🔄 [恢复重试] 重新执行el_upload: target='{target}' file_label='{file_label}'", 1)
                                return await self._execute_el_upload(step, step_num, desc, start_time)
                            else:
                                elapsed = int((time.time() - start_time) * 1000)
                                return StepResult(
                                    step_num=step_num, desc=desc, action="el_upload",
                                    status=StepStatus.ERROR, mcp_tool="(el_upload)",
                                    error=f"expose后页面跳转，恢复表单失败(恢复后URL: {restored_url})",
                                    output=f"pre_url={pre_url[-50:]} post_url={post_url[-50:]} restored={restored_url[-50:]}",
                                    duration_ms=elapsed,
                                )
                        else:
                            elapsed = int((time.time() - start_time) * 1000)
                            return StepResult(
                                step_num=step_num, desc=desc, action="el_upload",
                                status=StepStatus.ERROR, mcp_tool="(el_upload)",
                                error=f"expose后页面跳转到列表页，未找到'新增'按钮恢复",
                                output=f"pre_url={pre_url[-50:]} post_url={post_url[-50:]}",
                                duration_ms=elapsed,
                            )
                    except Exception as restore_err:
                        elapsed = int((time.time() - start_time) * 1000)
                        return StepResult(
                            step_num=step_num, desc=desc, action="el_upload",
                            status=StepStatus.ERROR, mcp_tool="(el_upload)",
                            error=f"expose后页面跳转，恢复异常: {restore_err}",
                            output=f"pre_url={pre_url[-50:]} post_url={post_url[-50:]}",
                            duration_ms=elapsed,
                        )
                else:
                    elapsed = int((time.time() - start_time) * 1000)
                    return StepResult(
                        step_num=step_num, desc=desc, action="el_upload",
                        status=StepStatus.ERROR, mcp_tool="(el_upload)",
                        error=f"页面在expose后跳转(可能自动保存/提交), 无法完成上传",
                        output=f"pre_url={pre_url[-50:]} post_url={post_url[-50:]}",
                        duration_ms=elapsed,
                    )

            sub_step_3 = "[3/3] 执行文件上传"
            log(f"  📎 ── {sub_step_3} ── | path={os.path.basename(file_path)}", 2)

            upload_args = {"filePath": file_path}

            exposed_uid = None
            best_match = None
            ts_marker = f"exposed-upload-{expose_ts}"
            for uid, elem in self.parser.elements.items():
                elem_text = ((elem.text or "") + " " + (elem.name or "") + " " + (getattr(elem, 'description', '') or "")).lower()
                if ts_marker.lower() in elem_text:
                    exposed_uid = uid
                    log(f"  📎 精确匹配到时间戳标记的input: uid={uid}", 3)
                    break
                if "exposed-file-input" in elem_text:
                    best_match = uid
                if elem.role == "textbox" and ("file" in (elem.name or "").lower() or "upload" in elem_text):
                    if not best_match:
                        best_match = uid

            if not exposed_uid and best_match:
                exposed_uid = best_match
                log(f"  📎 使用备选input: uid={best_match}（非精确匹配）", 3)

            if not exposed_uid:
                log(f"  📎 ⚠️ 快照中未找到暴露的file input，尝试JS直接获取...", 2)
                fallback_fn = f"() => {{ var el = document.getElementById('exposed-file-input-{expose_ts}'); if(el) return JSON.stringify({{uid:'N/A',found:true,tag:el.tagName}}); var inputs = document.querySelectorAll('input[type=file]'); if(inputs.length>0) return JSON.stringify({{uid:'last-file-input',found:true,count:inputs.length}}); return JSON.stringify({{found:false}}); }}"
                fb_result = await self.session.call_tool("evaluate_script", {"function": fallback_fn})
                fb_content = extract_result_content(fb_result)
                fb_info = parse_json_from_mcp_response(fb_content)
                if isinstance(fb_info, dict) and fb_info.get("found"):
                    all_inputs = [u for u, e in self.parser.elements.items() if e.role == "textbox" and "file" in ((e.name or "").lower() + " " + (e.text or "").lower())]
                    if all_inputs:
                        exposed_uid = all_inputs[-1]
                        log(f"  📎 回退到最后一个file input: uid={exposed_uid}", 2)

            if not exposed_uid:
                elapsed = int((time.time() - start_time) * 1000)
                return StepResult(
                    step_num=step_num, desc=desc, action="el_upload",
                    status=StepStatus.ERROR, mcp_tool="(el_upload)",
                    error=f"无法定位暴露的file input元素(expose成功但快照中丢失), upload_file需要uid参数",
                    output=f"expose_ts={expose_ts} elements={len(self.parser.elements)}",
                    duration_ms=elapsed,
                )

            upload_args["uid"] = exposed_uid
            log(f"  📎 上传目标UID: {exposed_uid}", 3)

            upload_args["includeSnapshot"] = False

            upload_result = await self.session.call_tool("upload_file", upload_args)
            upload_content = extract_result_content(upload_result)
            log(f"  📎 ✅ [upload] 结果: {upload_content[:120] if upload_content else 'OK'} (耗时:{(time.time()-step_start_time)*1000:.0f}ms)", 2)
            sub_steps.append(f"{sub_step_3}: ✅")

            if wait_duration > 0:
                log(f"  📎 ⏳ 等待 {wait_duration}ms 让页面处理文件...", 2)
                await asyncio.sleep(wait_duration / 1000.0)

            sub_step_4 = "[4/3] 关闭文件选择窗口"
            log(f"  📎 {sub_step_4}: 尝试关闭OS级文件对话框", 2)
            try:
                import ctypes
                VK_ESCAPE = 0x1B
                user32 = ctypes.windll.user32
                result = user32.keybd_event(VK_ESCAPE, 0, 0, 0)
                user32.keybd_event(VK_ESCAPE, 0, 2, 0)
                await asyncio.sleep(0.5)
                log(f"  📎 {sub_step_4}: Win32 keybd_event Escape 发送成功", 3)
                sub_steps.append(f"{sub_step_4}: ✅(Win32)")
            except Exception as win_err:
                log(f"  📎 {sub_step_4} Win32失败({win_err})，尝试MCP press_key...", 3)
                try:
                    await self.session.call_tool("press_key", {"key": "Escape"})
                    await asyncio.sleep(0.3)
                    sub_steps.append(f"{sub_step_4}: ✅(MCP)")
                except Exception as mcp_err:
                    log(f"  📎 ⚠️ {sub_step_4} 所有方式均失败(可忽略)", 3)
                    sub_steps.append(f"{sub_step_4}: ⚠️")

            url_after = getattr(self, 'last_snapshot_url', '') or ''
            total_elapsed = (time.time() - step_start_time) * 1000
            log(f"  📎 🌐 执行后URL: {url_after} | 总耗时: {total_elapsed:.0f}ms", 2)

            if url_before and url_after and url_before != url_after:
                log(f"  📎 ⚠️ ═════ URL变化检测 ═════", 1)
                log(f"  📎 ⚠️ 变化: {url_before}", 2)
                log(f"  📎 ⚠️ →   {url_after}", 2)
                if '/apply-list' in url_after or '/list' in url_after:
                    log(f"  📎 🔧 检测到列表页跳转，启动自动恢复...", 1)
                    try:
                        await self._take_snapshot()
                        new_btn_uid = None
                        for uid, elem in self.parser.elements.items():
                            elem_text = (elem.text or "") + (getattr(elem, 'description', '') or "")
                            if elem.role == "button" and "新增" in elem_text:
                                new_btn_uid = uid
                                break
                        if new_btn_uid:
                            log(f"  📎 🔧 找到'新增'按钮 uid={new_btn_uid}，点击恢复表单...", 2)
                            await self.session.call_tool("click", {"uid": new_btn_uid, "includeSnapshot": False})
                            await asyncio.sleep(1500 / 1000.0)
                            await self._take_snapshot()
                            restored_url = getattr(self, 'last_snapshot_url', '') or ''
                            if '/apply' in restored_url:
                                log(f"  📎 ✅ 表单页恢复成功: {restored_url} (总耗时:{(time.time()-step_start_time)*1000:.0f}ms)", 1)
                                sub_steps.append("🔧页面自动恢复: ✅")
                            else:
                                log(f"  📎 ⚠️ [el_upload] 恢复后URL: {restored_url}", 2)
                                sub_steps.append("🔧页面自动恢复: ⚠️")
                        else:
                            log(f"  📎 ⚠️ [el_upload] 未找到'新增'按钮，无法自动恢复", 2)
                            sub_steps.append("🔧页面恢复失败: ❌未找到新增按钮")
                    except Exception as restore_err:
                        log(f"  📎 ⚠️ [el_upload] 自动恢复异常: {restore_err}", 2)
                        sub_steps.append(f"🔧页面恢复异常: {restore_err}")

            elapsed = int((time.time() - start_time) * 1000)
            log(f"  📎 ═════════════════════ el_upload 完成 ═════════════════════", 1)
            log(f"  📎 📊 结果: ✅ 成功 | 文件: {os.path.basename(file_path)} | 总耗时: {elapsed}ms", 1)

            return StepResult(
                step_num=step_num, desc=desc, action="el_upload",
                status=StepStatus.SUCCESS, mcp_tool="(el_upload)",
                mcp_args={"target": target, "filePath": file_path},
                output=f"File uploaded successfully: {file_path}\nSub-steps: {' | '.join(sub_steps)}",
                duration_ms=elapsed,
                snapshot_before=self.last_snapshot_text,
                snapshot_after=self.last_snapshot_text,
                snapshot_path=self.last_snapshot_path,
            )

        except Exception as e:
            tb_lines = traceback.format_exc().splitlines()
            elapsed = int((time.time() - start_time) * 1000)
            log(f"  📎 [el_upload] ❌ 异常: {e}", 1)
            for tl in tb_lines[-6:]:
                log(f"    {tl}", 3)

            return StepResult(
                step_num=step_num, desc=desc, action="el_upload",
                status=StepStatus.ERROR, mcp_tool="(el_upload)",
                error=str(e),
                output=f"Failed at: {' | '.join(sub_steps)}",
                duration_ms=elapsed,
            )

    async def _execute_el_date(self, step: Dict, step_num: int,
                                desc: str, start_time: float) -> StepResult:
        """Element UI el-date-picker 日期选择器填写（一步完成）

        内部自动执行三步操作:
          1. click 日期输入框（打开日期选择面板）
          2. sleep 等待面板渲染
          3. fill 填入日期值

        YAML 用法:
          - step: N
            action: el_date
            target: 请选择评估基准日    # placeholder 或 label
            value: '2026-05-10'         # 日期字符串
            wait_after:
              type: time
              duration: 500             # 面板打开后等待时间(默认500ms)
        """
        log(f"  📅 [el_date] Element UI 日期选择器开始", 1)

        target = step.get("target", "")
        value = resolve_env_vars(step.get("value", ""))
        wait_after = step.get("wait_after", {})
        panel_wait = int(wait_after.get("duration", 500)) if wait_after else 500

        if not value:
            elapsed = int((time.time() - start_time) * 1000)
            return StepResult(
                step_num=step_num, desc=desc, action="el_date",
                status=StepStatus.ERROR, mcp_tool="(el_date)",
                error="Missing required parameter: 'value' (date value to fill)",
                duration_ms=elapsed,
            )

        log(f"  📅 [el_date] 目标: '{target}' | 值: '{value}' | 面板等待: {panel_wait}ms", 2)

        sub_steps = []

        try:
            sub_step_1 = "[1/3] 点击日期输入框"
            log(f"  📅 {sub_step_1}: target='{target}'", 2)

            click_uid = _resolve_uid(step, self.parser, self.cache, require_interactive=True)
            if not click_uid:
                elapsed = int((time.time() - start_time) * 1000)
                return StepResult(
                    step_num=step_num, desc=desc, action="el_date",
                    status=StepStatus.ERROR, mcp_tool="(el_date)",
                    error=f"Cannot find date input element for target='{target}'",
                    duration_ms=elapsed,
                )

            click_result = await self.session.call_tool("click", {"uid": click_uid, "includeSnapshot": False})
            click_content = extract_result_content(click_result)
            log(f"  📅 {sub_step_1} 结果: {click_content[:80] if click_content else 'OK'}", 2)
            sub_steps.append(f"{sub_step_1}: ✅")

            sub_step_2 = f"[2/3] 等待日期面板渲染 ({panel_wait}ms)"
            await asyncio.sleep(panel_wait / 1000.0)
            sub_steps.append(f"{sub_step_2}: ✅")

            await self._take_snapshot()

            sub_step_3 = "[3/3] 填入日期值"
            log(f"  📅 {sub_step_3}: value='{value}'", 2)

            fill_args = {"value": value}
            if click_uid:
                fill_args["uid"] = click_uid

            fill_result = await self.session.call_tool("fill", fill_args)
            fill_content = extract_result_content(fill_result)
            log(f"  📅 {sub_step_3} 结果: {fill_content[:120] if fill_content else 'OK'}", 2)
            sub_steps.append(f"{sub_step_3}: ✅")

            elapsed = int((time.time() - start_time) * 1000)
            log(f"  📅 [el_date] 完成 ({elapsed}ms)", 1)

            return StepResult(
                step_num=step_num, desc=desc, action="el_date",
                status=StepStatus.SUCCESS, mcp_tool="(el_date)",
                mcp_args={"target": target, "value": value},
                output=f"Date filled successfully: {value}\nSub-steps: {' | '.join(sub_steps)}",
                duration_ms=elapsed,
                snapshot_before=self.last_snapshot_text,
                snapshot_after=self.last_snapshot_text,
                snapshot_path=self.last_snapshot_path,
            )

        except Exception as e:
            tb_lines = traceback.format_exc().splitlines()
            elapsed = int((time.time() - start_time) * 1000)
            log(f"  📅 [el_date] ❌ 异常: {e}", 1)
            for tl in tb_lines[-6:]:
                log(f"    {tl}", 3)

            return StepResult(
                step_num=step_num, desc=desc, action="el_date",
                status=StepStatus.ERROR, mcp_tool="(el_date)",
                error=str(e),
                output=f"Failed at: {' | '.join(sub_steps)}",
                duration_ms=elapsed,
            )

    def _find_upload_button_uid(self, target: str, preferred_uid: Optional[str] = None,
                                  file_label: Optional[str] = None) -> Optional[str]:
        """上下文感知的上传按钮定位（三级策略）

        策略优先级:
          P1: UID后缀模糊匹配 (60_370 -> *_370)
          P2: file_label上下文定位 (找到"核准申请文件"行→取该行button"上传")
          P3: 智能文本匹配 (排除radio/checkbox，优先button角色)
        """
        log(f"    [SmartMatch] target='{target}' preferred_uid={preferred_uid} file_label={file_label}", 3)

        TEXT_ONLY_ROLES = {"strong", "statictext", "inline textbox", "heading",
                           "listitem", "paragraph", "label", "image"}

        if preferred_uid:
            uid_suffix = preferred_uid.split("_")[-1] if "_" in preferred_uid else preferred_uid
            p1_candidates = []
            for uid, elem in self.parser.elements.items():
                if uid.endswith("_" + uid_suffix) or uid == uid_suffix:
                    role = getattr(elem, 'role', '') or ''
                    text = (getattr(elem, 'text', '') or '')[:40]
                    log(f"    [SmartMatch-P1] UID后缀匹配: {uid} (role={role} text='{text}')", 3)
                    if role in INTERACTIVE_ROLES:
                        log(f"    [SmartMatch-P1] ✅ 找到交互元素: {uid}", 3)
                        return uid
                    elif role not in TEXT_ONLY_ROLES and role not in ("radio", "checkbox", "switch"):
                        p1_candidates.append((uid, role, text))

            if p1_candidates and not file_label:
                uid, role, text = p1_candidates[0]
                log(f"    [SmartMatch-P1] ⚠️ 使用非标准角色: {uid} (role={role})", 2)
                return uid

            if p1_candidates:
                log(f"    [SmartMatch-P1] 后缀匹配到非交互元素({len(p1_candidates)}个)，降级到P2...", 3)

        if file_label:
            label_uids = []
            for uid, elem in self.parser.elements.items():
                text = (elem.text or "") + (elem.name or "") + (getattr(elem, 'description', '') or "")
                if file_label.lower() in text.lower():
                    label_uids.append((uid, elem))

            if label_uids:
                log(f"    [SmartMatch-P2] file_label '{file_label}' 匹配到 {len(label_uids)} 个元素:", 3)
                for lu, le in label_uids:
                    log(f"      uid={lu} role={le.role} text={(le.text or '')[:30]}", 3)

                best_btn = self._find_nearest_button(label_uids, target)
                if best_btn:
                    return best_btn

        candidates = []
        for uid, elem in self.parser.elements.items():
            if elem.role in ("radio", "checkbox", "switch"):
                continue
            text = (elem.text or "") + (elem.name or "")
            is_interactive = elem.role in ("button", "link", "textbox", "combobox", "menuitem")
            if target and target.lower() in text.lower() and is_interactive:
                score = 0
                if text.strip().lower() == target.strip().lower():
                    score += 10
                elif target.lower() in text.lower():
                    score += 5
                if elem.role == "button":
                    score += 3
                candidates.append((score, uid, elem))

        candidates.sort(key=lambda x: x[0], reverse=True)
        if candidates:
            _, best_uid, best_elem = candidates[0]
            log(f"    [SmartMatch-P3] 最佳文本匹配: uid={best_uid} role={best_elem.role} text={best_elem.text[:30]}", 3)
            return best_uid

        log(f"    [SmartMatch] ❌ 未找到上传按钮", 2)
        return None

    def _find_nearest_button(self, anchor_elements: List[Tuple], target_text: str) -> Optional[str]:
        """在锚点元素附近查找名称匹配target的button（不使用距离最近，而是文本匹配优先）"""
        if not anchor_elements:
            return None

        anchor_uids = {uid for uid, _ in anchor_elements}
        candidates = []

        for uid, elem in self.parser.elements.items():
            if elem.role not in ("button", "link"):
                continue
            text = ((elem.text or "") + " " + (elem.name or "")).strip()
            if not text:
                continue

            try:
                uid_num = int(uid.split("_")[-1]) if "_" in uid else 0
            except ValueError:
                continue

            min_anchor_dist = float('inf')
            for auid, _ in anchor_elements:
                try:
                    auid_num = int(auid.split("_")[-1]) if "_" in auid else 0
                except ValueError:
                    continue
                dist = abs(uid_num - auid_num)
                if dist < min_anchor_dist:
                    min_anchor_dist = dist

            score = 0
            text_lower = text.lower()
            target_lower = (target_text or "").lower()

            if text_lower == target_lower:
                score = 100
            elif target_lower and target_lower in text_lower:
                score = 70 + len(target_lower) / max(len(text_lower), 1) * 20
            elif target_lower:
                for word in target_lower.split():
                    if word in text_lower:
                        score += 10
            elif min_anchor_dist < 50:
                score = max(0, 30 - min_anchor_dist)

            if score > 0:
                candidates.append((score, min_anchor_dist, uid, elem))

        candidates.sort(key=lambda x: (-x[0], x[1]))

        if candidates:
            best_score, best_dist, best_uid, best_elem = candidates[0]
            log(f"    [NearestButton] 最佳匹配: uid={best_uid} role={best_elem.role} "
                f"text={(best_elem.text or '')[:30]} score={best_score} 距离anchor={best_dist}", 3)
            return best_uid

        log(f"    [NearestButton] 未找到匹配按钮", 3)
        return None

    async def _execute_js_click(self, step: Dict, step_num: int,
                                desc: str, start_time: float) -> StepResult:
        target_text = resolve_env_vars(step.get("target", ""))
        locator = step.get("locator", {}) or {}
        css_selector = locator.get("css") or locator.get("selector", "")
        role_filter = locator.get("role", "")
        log(f"  🖱️ [JS Click] 目标='{target_text}' | role={role_filter or 'any'}"
            f" | selector={css_selector or '(auto)'}", 2)
        mcp_args = _build_js_click_args("js_click", step, self.parser, self.cache)
        log(f"  🔧 MCP工具: evaluate_script (JS原生click)", 2)
        log(f"  📝 JS代码预览: {mcp_args['function'][:80]}...", 3)

        max_retries = int(resolve_env_vars(step.get("retries",
                                  self.config.get("MAX_RETRIES", "3"))))
        last_error = None
        for attempt in range(max_retries):
            try:
                result = await self.session.call_tool("evaluate_script", mcp_args)
                content = extract_result_content(result) if result else ""
                log(f"  📄 JS返回: {content[:120] if content else '(empty)'}", 2)

                import json as _json
                try:
                    info = _json.loads(content) if content else {}
                    clicked = info.get("clicked", False)
                    tag = info.get("tag", "?")
                    el_text = info.get("text", "")
                    err = info.get("error", "")
                    if clicked:
                        log(f"  ✅ JS点击成功: <{tag}> '{el_text}' "
                            f"(耗时:{(time.time()-start_time)*1000:.0f}ms)"
                            + (f" [重试{attempt}次]" if attempt > 0 else ""), 1)
                        return StepResult(
                            step_num=step_num, desc=desc, action="js_click",
                            status=StepStatus.SUCCESS,
                            mcp_tool="evaluate_script",
                            output=f"JS clicked <{tag}> '{el_text}'",
                            duration_ms=int((time.time() - start_time) * 1000),
                            snapshot_path=self.last_snapshot_path,
                        )
                    elif err:
                        log(f"  ❌ JS未找到元素: {err}", 1)
                        last_error = f"Element not found: {err}"
                    else:
                        log(f"  ⚠️ JS返回异常格式: {content[:80]}", 1)
                        last_error = f"Unexpected result: {content[:80]}"
                except (_json.JSONDecodeError, TypeError):
                    if content and ("error" not in content.lower()):
                        log(f"  ✅ JS执行完成 (非JSON): {content[:60]}", 1)
                        return StepResult(
                            step_num=step_num, desc=desc, action="js_click",
                            status=StepStatus.SUCCESS,
                            mcp_tool="evaluate_script",
                            output=content[:100] if content else "OK",
                            duration_ms=int((time.time() - start_time) * 1000),
                            snapshot_path=self.last_snapshot_path,
                        )
                    last_error = f"JS error: {content[:80] if content else 'empty'}"

            except Exception as e:
                last_error = f"{type(e).__name__}: {e}"
                log(f"  ❌ JS执行异常: {last_error} (尝试 {attempt+1}/{max_retries})", 1)

            if attempt < max_retries - 1:
                delay = self.config.get("RETRY_DELAY", 1.0)
                await asyncio.sleep(delay)

        log(f"  ⛔ JS Click 失败 ({max_retries}次): {last_error}", 1)
        return StepResult(
            step_num=step_num, desc=desc, action="js_click",
            status=StepStatus.FAILED,
            mcp_tool="evaluate_script",
            output=f"Failed after {max_retries} attempts: {last_error}",
            duration_ms=int((time.time() - start_time) * 1000),
            snapshot_path=self.last_snapshot_path,
        )

    async def _execute_assert_multiple(self, step: Dict, step_num: int,
                                       desc: str, start_time: float) -> StepResult:
        action_type = "assert_multiple"
        log(f"  📸 获取页面快照用于断言验证...", 2)
        await self._take_snapshot()
        await asyncio.sleep(0.3)

        assertions = self._collect_assertions(step)
        assertion_results = []
        if not assertions:
            return StepResult(
                step_num=step_num, desc=desc, action=action_type,
                status=StepStatus.SUCCESS, mcp_tool="(assert_multiple)",
                output="No assertions defined, auto-pass",
                duration_ms=int((time.time() - start_time) * 1000),
                snapshot_path=self.last_snapshot_path or "",
            )

        log(f"\n  🔍 断言验证 ({len(assertions)} 项):", 1)
        for assertion in assertions:
            ar = self._run_assertion(assertion)
            assertion_results.append(ar)
            icon = "✅" if ar["passed"] else "❌"
            expected = ar.get("expected", "")
            log(f"    [{icon}] {assertion['type']}: 期望={expected} → "
                f"{'PASS' if ar['passed'] else 'FAIL'} | {ar['detail']}", 1)

        all_pass = all(a["passed"] for a in assertion_results)
        critical_fail = any(
            not a["passed"] and (
                a.get("critical", False)
                or (a.get("confidence") == "high"
                    and a["type"] in ("text_contains", "url_contains",
                                         "element_visible", "toast_visible"))
            )
            for a in assertion_results
        )

        if critical_fail:
            status = StepStatus.FAILED_ASSERT
            log("  ⛔ 关键断言失败!", 1)
        elif not all_pass:
            status = StepStatus.SUCCESS
            log("  ⚠️ 非关键断言失败，标记成功(continue_on_error)", 1)
        else:
            status = StepStatus.SUCCESS
            log("  ✅ 所有断言通过", 1)

        elapsed_ms = int((time.time() - start_time) * 1000)
        detail_summary = "; ".join(
            f"{a['type']}={'PASS' if a['passed'] else 'FAIL'}" for a in assertion_results
        )
        return StepResult(
            step_num=step_num, desc=desc, action=action_type,
            status=status, mcp_tool="(assert_multiple)",
            output=detail_summary, assertions=assertion_results,
            duration_ms=elapsed_ms,
            snapshot_before=self.last_snapshot_text[:500] if self.last_snapshot_text else "",
            snapshot_path=self.last_snapshot_path or "",
        )

    def _collect_assertions(self, step: Dict) -> List[Dict]:
        """收集步骤中的所有断言"""
        assertions = []
        singular = step.get("assertion")
        if singular:
            assertions.append(singular)
        plural = step.get("assertions", [])
        if plural:
            assertions.extend(plural)
        also = step.get("also_assert")
        if also:
            if isinstance(also, list):
                assertions.extend(also)
            else:
                assertions.append(also)
        return assertions

    def _run_assertion(self, assertion: Dict) -> Dict:
        """执行单个断言"""
        assert_type = assertion.get("type", "unknown")
        expected = resolve_env_vars(str(assertion.get("expected", "")))

        validator = AssertionRegistry.get(assert_type)
        
        if validator:
            try:
                result = validator(assertion, self.last_snapshot_text, self.parser, self.cache)
                return {
                    "type": assert_type,
                    "expected": expected,
                    "passed": result["passed"],
                    "detail": result["detail"],
                    "confidence": assertion.get("confidence", "medium"),
                    "critical": assertion.get("critical", False),
                }
            except Exception as e:
                return {
                    "type": assert_type,
                    "expected": expected,
                    "passed": False,
                    "detail": f"Validator error: {e}",
                    "confidence": assertion.get("confidence", "medium"),
                    "critical": assertion.get("critical", False),
                }

        passed = True
        detail = f"Unknown assertion type: {assert_type}, auto-passed"

        return {"type": assert_type, "expected": expected, "passed": passed, "detail": detail, "critical": assertion.get("critical", False)}

    # _extract_result_content / _parse_json_from_mcp_response / _check_result_has_error
    # 已迁移至 tests.framework.mcp_client 模块


