"""
TransitionRule - State transition rule definition
"""
from dataclasses import dataclass, field
from typing import List, Callable, Optional, Dict, Any


@dataclass
class TransitionRule:
    """状态转换规则"""
    
    action: str                          # 动作: submit/approve/reject/return/revoke/cancel/start_eval/eval_complete/etc.
    from_states: List[str]               # 允许的起始状态列表
    to_state: str                         # 目标状态
    condition: Optional[Callable] = None   # 条件函数 (可选)
    condition_name: str = ""              # 条件名称（用于日志）
    auto_execute: bool = False            # 是否自动执行（无需人工）
    create_task: bool = False             # 是否创建待办任务
    task_config: Dict[str, Any] = field(default_factory=dict)  # 任务配置
    
    def check_condition(self, variables: dict) -> bool:
        if self.condition is None:
            return True
        try:
            return self.condition(variables)
        except Exception:
            return False
