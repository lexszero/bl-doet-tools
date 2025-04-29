from math import ceil
import asyncstdlib as a
from typing import Annotated, Any
from fastapi import APIRouter, Depends

from common.errors import PermissionDeniedError
from core.dependencies import DataRequestContextDep, ProjectDep, RequiredProjectRole_Any
from core.permission import Role
from core.store import VersionedCollection

def get_collection_if_roles(*args: Role):
    roles = frozenset(args)
    async def _check_role(collection_name: str, context: DataRequestContextDep):
        collection = await context.project.get_store_collection(collection_name)
        if not collection.roles_for(context.client_permissions).intersection(roles):
            raise PermissionDeniedError()
        return collection.instantiate(context)
    return _check_role

CollectionReadableDep = Annotated[
        VersionedCollection,
        Depends(get_collection_if_roles(Role.Viewer, Role.Editor, Role.Admin, Role.Owner))
        ]
CollectionWritableDep = Annotated[
        VersionedCollection,
        Depends(get_collection_if_roles(Role.Editor, Role.Admin, Role.Owner))
        ]

router = APIRouter()

@router.get("/")
async def get_collections(project: ProjectDep) -> dict[str, Any]:
    result = {}
    for item in (await project.awaitable_attrs.collections).values():
        result[item.name] = await item.info()
    return result

@router.get("/change_timestamps", dependencies=[RequiredProjectRole_Any])
async def get_change_timestamps(project: ProjectDep):
    result = []
    for item in await project.get_all_changes():
        ts = ceil(item.timestamp.timestamp())
        if ts not in result:
            result.append(ts)
    return {'timestamps': result}

@router.get("/{collection_name}/items")
async def get_collection_items(collection: CollectionReadableDep):
    return await a.list(collection.all_last_values())

@router.get("/{collection_name}/revisions")
async def get_collection_revisions(collection: CollectionReadableDep):
    return await collection.all_revisions()

@router.get("/{collection_name}/items/{item_id}")
async def get_collection_item(
        collection: CollectionReadableDep,
        item_id: str
        ):
    return await collection.item_last_value(item_id)

#@router.delete("/{collection_name}/items/{item_id}")
#async def delete_collection_item(
#        collection: CollectionDep,
#        item_id: str
#        ):

@router.get("/{collection_name}/items/{item_id}/revisions")
async def get_collection_item_revisions(
        collection: CollectionReadableDep,
        item_id: str
        ):
    return await a.list(collection.item_revisions(item_id))
