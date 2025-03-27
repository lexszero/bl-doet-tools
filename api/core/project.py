from typing import Optional

from sqlalchemy import ForeignKey
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.orm import Mapped, attribute_keyed_dict, mapped_column, relationship

from common.db_async import DBSessionDep, DBModel
from common.model_utils import BaseModel, ModelJson

from core.user import Permission, User, UserRole
from core.store import StoreCollection

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


