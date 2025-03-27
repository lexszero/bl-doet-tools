from datetime import datetime
from typing import Annotated, Optional

from fastapi import Depends
from sqlalchemy import select

from common.db_async import DBSessionDep
from common.errors import NotFoundError
from core.project import Project
from core.store import VersionedCollection


async def get_project(db: DBSessionDep, project_name: str) -> Project:
    result = await db.scalar(select(Project).where(Project.name == project_name))
    if not result:
        raise NotFoundError(f"Project {project_name} not found")
    return result

ProjectDep = Annotated[Project, Depends(get_project)]

async def get_versioned_collection(
        project: ProjectDep,
        collection_name: str,
        time_start: Optional[datetime] = None,
        time_end: Optional[datetime] = None,
        ):
    collection = (await project.awaitable_attrs.collections).get(collection_name)
    if not collection:
        raise NotFoundError("Collection not found")
    for cls in VersionedCollection.__subclasses__():
        if cls.store_item_type == collection.item_type:
            return cls(collection, time_start=time_start, time_end=time_end)
    raise RuntimeError(f"Unable to determine VersionedCollection class for {collection}")

CollectionDep = Annotated[VersionedCollection, Depends(get_versioned_collection)]

