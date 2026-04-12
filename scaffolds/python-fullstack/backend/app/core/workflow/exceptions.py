"""
Workflow Exceptions
"""


class WorkflowEngineError(Exception):
    """Base workflow error"""

    def __init__(self, message: str = "Workflow error", code: int = 400):
        self.message = message
        self.code = code
        super().__init__(self.message)


class InvalidTransitionError(WorkflowEngineError):
    """Invalid state transition"""

    def __init__(self, message="Invalid state transition"):
        super().__init__(message=message, code=400)


class TaskAlreadyCompletedError(WorkflowEngineError):
    """Task already completed"""

    def __init__(self, message="Task already completed"):
        super().__init__(message=message, code=400)


class SignConditionNotMetError(WorkflowEngineError):
    """Counter-sign condition not satisfied"""

    def __init__(self, message="Sign condition not satisfied"):
        super().__init__(message=message, code=400)


class WorkflowDefNotFoundError(WorkflowEngineError):
    """Workflow definition not found"""

    def __init__(self, message="Workflow definition not found"):
        super().__init__(message=message, code=404)


class InstanceNotFoundError(WorkflowEngineError):
    """Instance not found"""

    def __init__(self, message="Workflow instance not found"):
        super().__init__(message=message, code=404)


class TaskNotFoundError(WorkflowEngineError):
    """Task not found"""

    def __init__(self, message="Task not found"):
        super().__init__(message=message, code=404)
