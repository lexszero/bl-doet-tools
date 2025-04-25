from dataclasses import dataclass
from datetime import datetime, timezone
from functools import cached_property
from typing import Optional
from pydantic import BaseModel, Field, field_validator

from core.permission import ClientPermissions, Role

@dataclass
class DataRequestContext:
    project: 'Project'
    time_start: Optional[datetime] = None
    time_end: Optional[datetime] = None
    client_permissions: ClientPermissions = Field(default_factory=frozenset)

    @cached_property
    def client_project_roles(self) -> frozenset[Role]:
        return self.project.roles_for(self.client_permissions)

    @field_validator('time_start', 'time_end')
    @classmethod
    def validate_time(cls, ts: Optional[int]) -> Optional[datetime]:
        if not ts:
            return None
        else:
            return datetime.fromtimestamp(ts, tz=timezone.utc)


