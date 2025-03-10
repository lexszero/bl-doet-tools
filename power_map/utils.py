import logging
from typing import Any, Self, Optional, TypeVar

from pydantic import BaseModel as PydanticBaseModel, ValidationError, model_validator
from pydantic.functional_validators import ModelWrapValidatorHandler

from common.log import Log

log = Log.getChild('power_map')
log.setLevel(logging.DEBUG)

class ModelLoggingValidator(PydanticBaseModel):
    @model_validator(mode='wrap')
    @classmethod
    def log_failed_validation(cls, data: Any, handler: ModelWrapValidatorHandler[Self]) -> Self:
        log.debug(f"{cls}: before validation: {data=}")
        try:
            d = handler(data)
            log.debug(f"{cls}: after validation: {d=}")
            return d
        except ValidationError:
            log.error(f"Model {cls} failed to validate with {data=}")
            raise

class BaseModel(PydanticBaseModel):
    pass

BaseModelT = TypeVar('BaseModelT', bound=BaseModel)

class NameDescriptionModel(BaseModel):
    name: str
    description: Optional[str] = None


