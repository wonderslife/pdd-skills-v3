"""
Condition Evaluator - Evaluates workflow conditions (amount thresholds, etc.)
"""
import logging
from typing import Any, Callable

logger = logging.getLogger(__name__)


class ConditionEvaluator:
    """条件判断器"""

    @staticmethod
    def amount_threshold(variables: dict, threshold: float) -> bool:
        amount = float(variables.get("amount", 0) or 0)
        return amount >= threshold

    @staticmethod
    def evaluate(condition_func: Callable[[dict], bool], variables: dict) -> bool:
        try:
            return condition_func(variables)
        except Exception as e:
            logger.error(f"条件评估失败: {e}")
            return False

    @staticmethod
    def always_true(variables: dict) -> bool:
        return True

    @staticmethod
    def always_false(variables: dict) -> bool:
        return False


BUILTIN_CONDITIONS = {
    "dept_approve": lambda vars: ConditionEvaluator.amount_threshold(vars, 500000) is False,
    "group_approve": lambda vars: ConditionEvaluator.amount_threshold(vars, 500000) is True,
}
