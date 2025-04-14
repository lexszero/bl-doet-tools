from fastapi import HTTPException

class ApiError(HTTPException):
    def __init__(self, status_code, code, description):
        super().__init__(status_code, {'error': code, 'message': description})
        self.status_code = status_code
        self.code = code
        self.description = description

class NotImplementedError(ApiError):
    def __init__(self, description = 'Not implemented'):
        super().__init__(501, 'not_implemented', description)

class AuthError(ApiError):
    def __init__(self, code, description):
        super().__init__(401, code, description)

class InvalidTokenError(AuthError):
    def __init__(self, description = 'Invalid token'):
        super().__init__('invalid_token', description)

class UnauthorizedError(AuthError):
    def __init__(self, description = 'Unauthorized'):
        super().__init__('unauthorized', description)

class PermissionDeniedError(ApiError):
    def __init__(self, description = 'Permission denied'):
        super().__init__(403, 'permission_denied', description)

class InvalidRequestError(ApiError):
    def __init__(self, description):
        super().__init__(400, 'invalid_request', description)

class NotFoundError(ApiError):
    def __init__(self, description = 'Object not found'):
        super().__init__(404, 'not_found', description)

class ExternalError(ApiError):
    def __init__(self, description = 'Unexpected external service error'):
        super().__init__(500, 'external_error', description)

class InternalError(ApiError):
    def __init__(self, description = 'Unexpected internal error'):
        super().__init__(500, 'internal_error', description)

class ModuleConflictError(ApiError):
    def __init__(self, description = 'unknown'):
        super().__init__(500, 'module_conflict', 'Conflicting modules: ' + description)

class ConfigurationError(ApiError):
    def __init__(self, description = 'Configuration error'):
        super().__init__(400, 'configuration_error', description)

class ErrorWithData(ApiError):
    def __init__(self, base_exception, data = None, *args, **kwargs):
        self.base_exception = base_exception(*args, **kwargs)
        self.data = data

    def as_result(self):
        result = self.base_exception.as_result()
        result['body']['data'] = self.data
        return result


