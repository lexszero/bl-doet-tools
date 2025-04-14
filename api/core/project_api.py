from datetime import datetime
from typing import Annotated, Optional
from fastapi import APIRouter, Depends

from core.auth import ClientPermissionsDep
from core.dependencies import ProjectDep, RequiredUserRole_Any
from core.data_request import DataRequestContext
from core.data_view import DataViewBase

router = APIRouter()

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

async def get_view_element(
        context: DataRequestContextDep,
        view_name: str,
        element_alias: str,
        ):
    return context.project.get_view_element(view_name, element_alias, context.client_project_roles)

DataViewElementDep = Annotated[DataViewBase, Depends(get_view_element)]

@router.get("/", dependencies=[RequiredUserRole_Any])
async def get_default_view(
        project: ProjectDep,
        context: DataRequestContextDep,
        ):
    return await project.get_view('default', context)

@router.get("/v/{view_name}", dependencies=[RequiredUserRole_Any])
async def get_project_view(
        project: ProjectDep,
        view_name: str,
        context: DataRequestContextDep
        ):
    return await project.get_view(view_name, context)

@router.get("/v/{view_name}/{element_alias}", dependencies=[RequiredUserRole_Any])
async def get_project_view_element(
        element: DataViewElementDep,
        context: DataRequestContextDep,
        ):
    return await element.get(context)
