from typing import Annotated
from fastapi import APIRouter, Depends

from core.dependencies import DataRequestContextDep, ProjectDep, RequiredProjectRole_Any
from core.data_view import DataViewBase

router = APIRouter()

async def get_view_element(
        context: DataRequestContextDep,
        view_name: str,
        element_alias: str,
        ):
    return context.project.get_view_element(view_name, element_alias, context.client_project_roles)

DataViewElementDep = Annotated[DataViewBase, Depends(get_view_element)]

@router.get("/", dependencies=[RequiredProjectRole_Any])
async def get_default_view(
        project: ProjectDep,
        context: DataRequestContextDep,
        ):
    return await project.get_view('default', context)

@router.get("/v/{view_name}", dependencies=[RequiredProjectRole_Any])
async def get_project_view(
        project: ProjectDep,
        view_name: str,
        context: DataRequestContextDep
        ):
    return await project.get_view(view_name, context)

@router.get("/v/{view_name}/{element_alias}", dependencies=[RequiredProjectRole_Any])
async def get_project_view_element(
        element: DataViewElementDep,
        context: DataRequestContextDep,
        ):
    return await element.get(context)
