import logging
from typing import Any, Generic, Optional, Type, TypeVar

from pydantic import BaseModel, ValidationError, parse_obj_as
from sqlalchemy.types import TypeDecorator
from sqlalchemy.dialects.postgresql import JSONB

log = logging.getLogger('model_utils')

ModelT = TypeVar('ModelT', bound=BaseModel)
class ModelJson(TypeDecorator, Generic[ModelT]):
    impl = JSONB
    cache_ok = True

    _model: Type[ModelT]
    _allowed_types: list[Type]

    _name: str

    def __init__(self, model: Type[ModelT], allowed_types: Optional[list[Type]] = None):
        self._name = f'ModelJson<{model.__name__}>'
        log.debug(f'{self._name}: init, model={model}, allowed_types={allowed_types}')
        if not issubclass(model, BaseModel):
            raise TypeError
        self._model = model
        if allowed_types is not None:
            self._allowed_types = allowed_types
        else:
            self._allowed_types = [model, dict]
        log.debug(f'  parse model: {self._allowed_types}')
        super().__init__()

    def process_bind_param(self, value: Any, dialect: Any):
        log.debug(f'{self._name}: bind_param: serializing {type(value)} {repr(value)}')
        for variant in self._allowed_types:
            #log.debug(f'{self._name}: bind_param: trying to parse as {variant}')
            if not isinstance(value, variant):
                continue
            if issubclass(variant, BaseModel):
                return value.dict()
            if isinstance(value, dict):
                return value

        if isinstance(value, dict) or value is None:
            return value
        if isinstance(value, self._model):
            return value.dict()

        raise TypeError(f"Expected one of {self._allowed_types}, got {type(value)} {value}")

    def process_result_value(self, value: ModelT, dialect):
        #log.debug(f'{self._name}: result_value: parsing {type(value)} {repr(value)}')
        if value is None:
            log.warning(f'{self._name}: Value is None')
            return value
        #args = getattr(self._allowed_types, '__args__', None)
        result = None
        errors = []
        for variant in self._allowed_types:
            #if isinstance(value, variant):
            #    return value
            try:
                #log.debug(f'{self._name}: result_value: trying to parse as {variant}')
                result = parse_obj_as(variant, value)
                #log.debug(f'{self._name}: result_value: parsed as {type(result)} {repr(result)}')
                break
            except ValidationError as exc:
                #log.debug(f'{self._name}: result_value: valdation failed: {exc}')
                errors.append(exc)
                continue
        if not result:
            log.warning(f"{self._name}: result_value: Invalid JSON in database, returning as is:\n   {type(value)} value={value},\n   errors: {errors}")
            return value
        return result

    def copy(self, **kw):
        return ModelJson(self._model, allowed_types=self._allowed_types, **kw)

    def coerce_compared_value(self, op, value):
        return self.impl.coerce_compared_value(op, value)

    def raw(self):
        return self.impl

