from datetime import datetime
from typing import Annotated, Optional

from fastapi import Depends
from sqlalchemy import select

from common.db_async import DBSessionDep
from common.errors import NotFoundError, PermissionDeniedError
from core.auth import ClientPermissionsDep
from core.data_request import DataRequestContext
from core.permission import Role
from core.project import Project

async def get_project(db: DBSessionDep, project_name: str) -> Project:
    result = await db.scalar(select(Project).where(Project.name == project_name))
    if not result:
        raise NotFoundError(f"Project {project_name} not found")
    return result

ProjectDep = Annotated[Project, Depends(get_project)]

def require_user_roles(*args: Role):
    roles = frozenset(args)
    def _check_role(project: ProjectDep, client_permissions: ClientPermissionsDep):
        if not project.roles_for(client_permissions).intersection(roles):
            raise PermissionDeniedError()
    return _check_role

RequiredUserRole_Any = Depends(require_user_roles(Role.Guest, Role.Viewer, Role.Editor, Role.Admin, Role.Owner))
RequiredUserRole_Edit = Depends(require_user_roles(Role.Editor, Role.Admin, Role.Owner))

async def get_data_request_context(
    project: ProjectDep,
    client_permissions: ClientPermissionsDep,
    time_start: Optional[datetime] = None,
    time_end: Optional[datetime] = None
    ):
    return DataRequestContext(
            project=project,
            client_permissions=client_permissions,
            time_start=time_start,
            time_end=time_end
            )

DataRequestContextDep = Annotated[DataRequestContext, Depends(get_data_request_context)]
