from dataclasses import dataclass
from datetime import datetime
from functools import cached_property
from typing import Optional
from pydantic import BaseModel, Field

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


