class AppException(Exception):
    status_code = 500
    message = "Internal error"

    def __init__(self, message: str | None = None, status_code: int | None = None) -> None:
        if message is not None:
            self.message = message
        if status_code is not None:
            self.status_code = status_code
        super().__init__(self.message)


class NotFoundError(AppException):
    status_code = 404
    message = "Resource not found"


class ValidationError(AppException):
    status_code = 422
    message = "Validation failed"


class ConflictError(AppException):
    status_code = 409
    message = "Conflict"


class UnauthorizedError(AppException):
    status_code = 401
    message = "Unauthorized"


class PayloadTooLargeError(AppException):
    status_code = 413
    message = "Payload too large"
