import asyncstdlib as a
from typing import Any
from fastapi import APIRouter
from geojson_pydantic import FeatureCollection

from common.db_async import DBSessionDep
from core.dependencies import CollectionDep, ProjectDep

router = APIRouter()

@router.get("/")
async def get_collections(project: ProjectDep) -> dict[str, Any]:
    result = {}
    for item in (await project.awaitable_attrs.collections).values():
        result[item.name] = await item.info()
    return result

@router.get("/{collection_name}/items")
async def get_collection_items(
        db: DBSessionDep,
        collection: CollectionDep
        ):
    return await a.list(collection.all_last_values(db))

@router.get("/{collection_name}/items.geojson", response_model=list[Any])
async def get_collection_items_geojson(
        db: DBSessionDep,
        collection: CollectionDep,
        ):
    return FeatureCollection(
            type='FeatureCollection',
            features=await a.list(collection.all_last_values(db))
            )

@router.get("/{collection_name}/revisions")
async def get_collection_revisions(
        db: DBSessionDep,
        collection: CollectionDep
        ):
    return await collection.all_revisions(db)

@router.get("/{collection_name}/items/{item_id}")
async def get_collection_item(
        db: DBSessionDep,
        collection: CollectionDep,
        item_id: str
        ):
    return await collection.item_last_value(db, item_id)

@router.get("/{collection_name}/items/{item_id}/revisions")
async def get_collection_item_revisions(
        db: DBSessionDep,
        collection: CollectionDep,
        item_id: str
        ):
    return await a.list(collection.item_revisions(db, item_id))
