from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey, func, select
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.orm import Mapped, attribute_keyed_dict, mapped_column, relationship

from common.db_async import DBSessionDep, DBModel
from common.model_utils import BaseModel, ModelJson

from core.user import Permission, User, UserRole
from core.store import StoreCollection, StoreItemRevision

class ProjectData(BaseModel):
    name: str

class Project(DBModel, AsyncAttrs):
    __tablename__ = 'project'

    id: Mapped[int] = mapped_column(autoincrement=True, primary_key=True, index=True)
    owner_user_id: Mapped[int] = mapped_column(ForeignKey('user.id'))
    name: Mapped[str] = mapped_column(unique=True)
    data: Mapped[ProjectData] = mapped_column(ModelJson(ProjectData))

    owner_user: Mapped[User] = relationship()

    collections: Mapped[dict[str, StoreCollection]] = relationship(
            collection_class=attribute_keyed_dict('name'),
            cascade='all, delete-orphan'
            )

    async def get_all_changes(self,
            db: DBSessionDep,
            collections: Optional[list[str]] = None,
            time_start: Optional[datetime] = None,
            time_end: Optional[datetime] = None):
        filter_collections = (StoreCollection.project_id == self.id)
        if collections:
            filter_collections = filter_collections & (StoreCollection.name in collections)
        subquery = select(StoreCollection.id).where(filter_collections).subquery()
        revisions = (
                select(
                    StoreItemRevision.id,
                    StoreItemRevision.item_id,
                    StoreItemRevision.collection_id,
                    StoreItemRevision.timestamp
                    )
                .join(
                    subquery,
                    (StoreItemRevision.collection_id == subquery.c.id)
                    )
                )
        return await db.execute(revisions)

    async def get_last_change_timestamp(self, db: DBSessionDep, time_end: Optional[datetime] = None) -> Optional[datetime]:
        subquery = (
                select(StoreCollection.id)
                .where(StoreCollection.project_id == self.id)
                .subquery()
                )
        return await db.scalar(
                select(func.max(StoreItemRevision.timestamp))
                .join(subquery, StoreItemRevision.collection_id == subquery.c.id)
                .where(StoreItemRevision.timestamp < (time_end or datetime.now(tz=None)))
                )

async def create_project(db: DBSessionDep, name: str, owner: User, data: Optional[ProjectData] = None):
        p = Project(
                name=name,
                owner_user=owner,
                data=data or ProjectData(
                    name=name
                    )
                )
        db.add(p)
        await db.flush()

        db.add(Permission(
            user=owner,
            object_type='project',
            object_id=str(p.id),
            role=UserRole.Owner
            ))

        await db.flush()

        return p


