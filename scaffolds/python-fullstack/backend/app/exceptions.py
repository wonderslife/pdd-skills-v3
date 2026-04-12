"""
Custom Application Exceptions
"""


class AppException(Exception):
    """Base application exception with code and message"""

    def __init__(self, message: str = "Application error", code: int = 400, detail: Any = None):
        self.message = message
        self.code = code
        self.detail = detail
        super().__init__(self.message)


class NotFoundError(AppException):
    """Resource not found (404)"""

    def __init__(self, message: str = "Resource not found", detail=None):
        super().__init__(message=message, code=404, detail=detail)


class UnauthorizedError(AppException):
    """Authentication required (401)"""

    def __init__(self, message: str = "Unauthorized", detail=None):
        super().__init__(message=message, code=401, detail=detail)


class ForbiddenError(AppException):
    """Access denied (403)"""

    def __init__(self, message: str = "Forbidden", detail=None):
        super().__init__(message=message, code=403, detail=detail)


class ValidationError(AppException):
    """Validation error (422)"""

    def __init__(self, message: str = "Validation failed", detail=None):
        super().__init__(message=message, code=422, detail=detail)


class ConflictError(AppException):
    """Resource conflict (409)"""

    def __init__(self, message: str = "Conflict", detail=None):
        super().__init__(message=message, code=409, detail=detail)


class WorkflowError(AppException):
    """Workflow engine related errors"""

    def __init__(self, message: str = "Workflow error", code: int = 400, detail=None):
        super().__init__(message=message, code=code, detail=detail)


class InvalidTransitionError(WorkflowError):
    """Invalid state transition in workflow"""

    def __init__(self, message="Invalid state transition"):
        super().__init__(message=message, code=400)


class TaskAlreadyCompletedError(WorkflowError):
    """Task already completed"""

    def __init__(self, message="Task already completed"):
        super().__init__(message=message, code=400)


class SignConditionNotMetError(WorkflowError):
    """Counter-sign condition not met"""

    def __init__(self, message="Sign condition not satisfied"):
        super().__init__(message=message, code=400)
