from datetime import datetime
from math import ceil
import asyncstdlib as a
from typing import Annotated, Any
from fastapi import APIRouter, Depends
from geojson_pydantic import FeatureCollection

from common.db_async import DBSessionDep
from core.dependencies import DataRequestContextDep, ProjectDep
from core.store import VersionedCollection, get_versioned_collection

async def get_collection_dep(
        collection_name: str,
        context: DataRequestContextDep
        ):
    return await get_versioned_collection(context.project, collection_name, context.time_start, context.time_end)

CollectionDep = Annotated[VersionedCollection, Depends(get_collection_dep)]

router = APIRouter()

@router.get("/")
async def get_collections(project: ProjectDep) -> dict[str, Any]:
    result = {}
    for item in (await project.awaitable_attrs.collections).values():
        result[item.name] = await item.info()
    return result

@router.get("/change_timestamps")
async def get_change_timestamps(project: ProjectDep):
    result = []
    for item in await project.get_all_changes():
        ts = ceil(item.timestamp.timestamp())
        if ts not in result:
            result.append(ts)
    return {'timestamps': result}

@router.get("/{collection_name}/items")
async def get_collection_items(collection: CollectionDep):
    return await a.list(collection.all_last_values())

@router.get("/{collection_name}/items.geojson", response_model=list[Any])
async def get_collection_items_geojson(collection: CollectionDep):
    return FeatureCollection(
            type='FeatureCollection',
            features=await a.list(collection.all_last_values())
            )

@router.get("/{collection_name}/revisions")
async def get_collection_revisions(collection: CollectionDep):
    return await collection.all_revisions()

@router.get("/{collection_name}/items/{item_id}")
async def get_collection_item(
        collection: CollectionDep,
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
        collection: CollectionDep,
        item_id: str
        ):
    return await a.list(collection.item_revisions(item_id))


