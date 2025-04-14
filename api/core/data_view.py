import abc
from datetime import datetime
from functools import cached_property
from typing import Any, ClassVar, Generic, Optional, TypeVar

from pydantic import BaseModel, Field

from common.errors import PermissionDeniedError
from core.permission import Role
from core.data_request import DataRequestContext

class PermissionsMixin(BaseModel):
    permitted_for_roles: list[Role] = Field(default_factory=list)

    def check_permissions(self, client_roles: frozenset[Role]):
        if not self.permitted_for_roles:
            return True
        for r in self.permitted_for_roles:
            if r in client_roles:
                return True
        raise PermissionDeniedError()


class DataViewConfigBase(abc.ABC, PermissionsMixin):
    type: Any

class DataViewResultBase(abc.ABC, BaseModel):
    type: Any

DataViewConfigT = TypeVar('DataViewConfigT', bound=DataViewConfigBase)
DataViewResultT = TypeVar('DataViewResultT', bound=DataViewResultBase)

class DataViewBase(abc.ABC, Generic[DataViewConfigT, DataViewResultT]):
    TYPE: ClassVar[Any]
    config: DataViewConfigT

    def __init__(self, config: DataViewConfigT):
        self.config = config

    @abc.abstractmethod
    async def get(self, context: DataRequestContext):
        return DataViewResultT(type=self.config.type)

class DatasetViewConfig(PermissionsMixin):
    elements: dict[str, str] = Field(default_factory=dict)
