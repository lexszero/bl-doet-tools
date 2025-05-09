from abc import ABC
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, ClassVar, Dict, Generic, Iterable, List, Optional, Self, TypeVar
from pydantic import BaseModel, TypeAdapter
from sqlalchemy import ForeignKey, Index, delete, func, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncAttrs, AsyncSession, async_object_session
from sqlalchemy.orm import Mapped, attribute_keyed_dict, mapped_column, relationship
from sqlalchemy.types import DateTime

from common.db import DBModel
from common.errors import InternalError, NotFoundError
from common.model_utils import ModelT
from common.log import Log
from core.data_request import DataRequestContext
from core.permission import ClientPermissions, Permission, PermissionInDB, Role, get_roles
from core.user import User, UserInDB

log = Log.getChild('store')

class CollectionInfo(BaseModel):
    id: int
    name: str
    item_type: str
    num_items: int
    num_revisions: int

class ItemRevisionInfo(BaseModel, Generic[ModelT]):
    revision: int
    timestamp: datetime
    user: str
    deleted: bool
    data: Optional[ModelT]

class CollectionWithRevisions(CollectionInfo, Generic[ModelT]):
    items: dict[str, list[ItemRevisionInfo[ModelT]]]


class StoreItemRevision(DBModel, AsyncAttrs):
    __tablename__ = 'store_item_revision'

    id: Mapped[int] = mapped_column(primary_key=True)
    collection_id: Mapped[int] = mapped_column(ForeignKey('store_collection.id'), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey('user.id'), nullable=False)
    item_id: Mapped[str] = mapped_column(nullable=False)
    revision: Mapped[int] = mapped_column(default=0, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deleted: Mapped[bool] = mapped_column(default=False)

    data: Mapped[dict[str, Any]] = mapped_column(JSONB)

    user: Mapped[UserInDB] = relationship()
    collection: Mapped['StoreCollection'] = relationship(
            back_populates='revisions'
            )

#    __mapper_args__ = {
#            'polymorphic_on': 'entity_type',
#            }

    def __repr__(self) -> str:
        return f"<StoreItemRevision[{self.id}]: {self.collection.name}/{self.item_id} v{self.revision}>"

class StoreCollection(DBModel, AsyncAttrs):
    __tablename__ = 'store_collection'

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey('project.id'), nullable=False)
    name: Mapped[str] = mapped_column(nullable=False)
    item_type: Mapped[str] = mapped_column(nullable=False)

    project: Mapped['Project'] = relationship(
            back_populates='collections'
            )
    revisions: Mapped[List[StoreItemRevision]] = relationship(
            back_populates='collection'
            )
    items: Mapped[Dict[str, List[StoreItemRevision]]] = relationship('StoreItemRevision',
            collection_class=attribute_keyed_dict('item_id'),
            back_populates='collection',
            viewonly=True
            )

    def __repr__(self) -> str:
        return f"<StoreCollection[{self.id}]: {self.project.name}/{self.name}>"

    def roles_for(self, client_permissions: ClientPermissions):
        return get_roles(client_permissions, 'collection', str(self.id))

    async def info(self) -> CollectionInfo:
        return CollectionInfo(
                id=self.id,
                name=self.name,
                item_type=self.item_type,
                num_items=len(await self.awaitable_attrs.items),
                num_revisions=len(await self.awaitable_attrs.revisions)
                )

    def instantiate(self, context: Optional[DataRequestContext] = None):
        return VersionedCollection.instantiate(self, context)

Index('idx_collection_item_revision',
      StoreItemRevision.collection_id,
      StoreItemRevision.item_id,
      StoreItemRevision.revision,
      unique=True)

class VersionedCollection(ABC, Generic[ModelT]):
    store_collection_name: ClassVar[str]
    store_item_type: Optional[str] = None
    store_item_class: Optional[type[ModelT] | TypeAdapter[ModelT]] = None

    _collection: StoreCollection
    _db: AsyncSession
    _time_start: Optional[datetime] = None
    _time_end: Optional[datetime] = None

    @classmethod
    def class_for(cls, name: Optional[str] = None, item_type: Optional[str] = None):
        if name is None and item_type is None:
            raise RuntimeError("class_for requires at least one of name or item_type parameters")
        for c in VersionedCollection.__subclasses__():
            if ((
                    (name is None) or (c.store_collection_name == name)
                ) and (
                    (item_type is None) or (c.store_collection_name == name)
                )):
                return c
        raise InternalError(f"Unable to find VersionedCollection class with {name=} {item_type=}")

    @classmethod
    def instantiate(cls, store_collection: StoreCollection, context: Optional[DataRequestContext] = None):
        c = cls.class_for(name=store_collection.name, item_type=store_collection.item_type)
        if context:
            return c(store_collection, time_start=context.time_start, time_end=context.time_end)
        else:
            return c(store_collection)


    @classmethod
    async def bind(cls, project: 'Project', allow_create=False, time_start: Optional[datetime] = None, time_end: Optional[datetime] = None):
        db = project._db()
        collection = (await project.awaitable_attrs.collections).get(cls.store_collection_name)
        if collection:
            return cls(collection, time_start=time_start, time_end=time_end)
        elif allow_create:
            collection = StoreCollection(
                project_id=project.id,
                name=cls.store_collection_name,
                item_type=cls.store_item_type
                )
            (await project.awaitable_attrs.collections)[cls.store_collection_name] = collection
            db.add(collection)
            await db.flush()

            result = cls(collection, time_start=time_start, time_end=time_end)
            await project.owner_user.grant_permission(Permission(
                object_type='collection',
                object_id=str(collection.id),
                role=Role.Owner
                ))

            log.info(f"{cls.store_collection_name}: Created collection")

            return result
        else:
            raise NotFoundError(f"Collection {cls.store_collection_name} not found")

    def __init__(self, collection: StoreCollection, time_start: Optional[datetime] = None, time_end: Optional[datetime] = None):
        if not self.store_item_type:
            self.store_item_type = collection.item_type
        if self.store_item_type != collection.item_type:
            raise RuntimeError(f"Collection {collection} item_type={collection.item_type} is not compatible with item class {self.store_item_class} (item_type={self.store_item_type})")

        db = async_object_session(collection)
        if not db:
            raise InternalError("db session not found")
        self._db = db
        self._collection = collection
        if time_start:
            self._time_start = time_start
        if time_end:
            self._time_end = time_end


        #log.info(f"{self.__class__.__name__}: time interval {self._time_start} - {self._time_end}")

    def _from_dict(self, value: dict[str, Any]) -> Optional[ModelT]:
        #log.info(f"{self.__class__.__name__}: from_dict {self.store_item_class=} {value=}")
        if not value:
            result = None
        if isinstance(self.store_item_class, TypeAdapter):
            result = self.store_item_class.validate_python(value)
        elif issubclass(self.store_item_class, BaseModel):
            result = self.store_item_class.model_validate(value)
        else:
            raise RuntimeError("{self.__cls__.__name__}: Unsupported store_item_class")
        #debug(value, result)
        return result

    def _to_dict(self, value: ModelT) -> dict[str, Any]:
        return value.model_dump(mode='json')

    async def _revision_info(self, r: StoreItemRevision) -> ItemRevisionInfo:
        return ItemRevisionInfo(
                revision=r.revision,
                timestamp=r.timestamp,
                deleted=r.deleted,
                user=(await r.awaitable_attrs.user).name,
                data=self._from_dict(r.data)
                )

    async def grant_permission(self, user: UserInDB, role: Role) -> Permission:
        permission = Permission(
            object_type='collection',
            object_id=str(self._collection.id),
            role=role
            )
        await user.grant_permission(permission)
        return permission

    async def remove(self):
        await self._db.execute(
                delete(PermissionInDB)
                .where(
                    (PermissionInDB.object_type == 'collection') &
                    (PermissionInDB.object_id == str(self._collection.id))
                    )
                )
        await self._db.delete(self)

    def _filter_revisions(
            self,
            item_id: Optional[str] = None,
            include_deleted: bool = False):
        condition = (StoreItemRevision.collection_id == self._collection.id)
        if item_id:
            condition = condition & (StoreItemRevision.item_id == item_id)
        if not include_deleted:
            condition = condition & (StoreItemRevision.deleted == False)
        if self._time_start:
            condition = condition & (StoreItemRevision.timestamp >= self._time_start)
        if self._time_end:
            condition = condition & (StoreItemRevision.timestamp <= self._time_end)
        return condition

    async def _all_last_revisions(self) -> Iterable[StoreItemRevision]:
        subquery = (
                select(
                    StoreItemRevision.collection_id,
                    StoreItemRevision.item_id,
                    func.max(StoreItemRevision.revision).label('revision'))
                .where(self._filter_revisions())
                .group_by(
                    StoreItemRevision.collection_id,
                    StoreItemRevision.item_id)
                .subquery()
                )
        return await self._db.scalars(
                select(StoreItemRevision)
                .join(
                    subquery,
                    (StoreItemRevision.collection_id == subquery.c.collection_id) &
                    (StoreItemRevision.item_id == subquery.c.item_id) &
                    (StoreItemRevision.revision == subquery.c.revision)
                    )
                )

    async def _item_last_revision(
            self,
            item_id: str,
            include_deleted: bool = False
            ) -> StoreItemRevision:
        return await self._db.scalar(
                select(StoreItemRevision)
                .where(self._filter_revisions(item_id, include_deleted=include_deleted))
                .order_by(StoreItemRevision.revision.desc())
                .limit(1)
                )

    async def _revisions(
            self,
            item_id: Optional[str] = None,
            include_deleted: bool = False
            ):
        return await self._db.scalars(
                select(StoreItemRevision)
                .where(self._filter_revisions(item_id, include_deleted=include_deleted))
                .order_by(StoreItemRevision.revision)
                )

    async def item_last_value(
            self,
            item_id: str,
            include_deleted: bool = False
            ) -> Optional[ModelT]:
        result = await self._item_last_revision(item_id, include_deleted=include_deleted)
        if not (result and result.data):
            return None
        return self._from_dict(result.data)

    async def item_revisions(
            self,
            item_id: str,
            include_deleted: bool = False
            ) -> AsyncGenerator[ItemRevisionInfo]:
        for r in await self._revisions(item_id, include_deleted=include_deleted):
            yield await self._revision_info(r)

    async def all_revisions(
            self,
            include_deleted: bool = False
            ) -> CollectionWithRevisions:
        revisions = await self._revisions(include_deleted=include_deleted)
        items = {}
        n_revisions = 0
        for r in revisions:
            item_revisions = items.setdefault(r.item_id, [])
            item_revisions.append(await self._revision_info(r))
            n_revisions += 1

        return CollectionWithRevisions(
                id=self._collection.id,
                name=self._collection.name,
                item_type=self._collection.item_type,
                num_items=len(items),
                num_revisions=n_revisions,
                items=items)
 
    async def all_last_values(self) -> AsyncGenerator[ModelT]:
        result = await self._all_last_revisions()
        for item in result:
            if not item.data:
                #log.debug(f"{self.__class__.__name__}: Item {item.item_id} is missing data")
                continue
            value = self._from_dict(item.data)
            if value:
                yield value

    async def add(
            self,
            user: User,
            item_id: str,
            data: Optional[ModelT],
            timestamp: Optional[datetime] = None,
            revision: Optional[int] = None,
            deleted: bool = False,
            ) -> StoreItemRevision:
        if not revision:
            last = await self._item_last_revision(item_id, include_deleted=True)
            if last:
                revision = last.revision+1
            else:
                revision = 0
        if timestamp:
            ts = timestamp.astimezone(timezone.utc)
        else:
            ts = datetime.now(timezone.utc)

        item = StoreItemRevision(
                collection_id=self._collection.id,
                user=user,
                item_id=item_id,
                data=data and self._to_dict(data) or None,
                timestamp=ts,
                revision=revision,
                deleted=deleted
                )
        self._db.add(item)
        log.info(f"{self.store_collection_name}: Added new revision {item.revision} (timestamp: {item.timestamp}) for item {item_id}")
        return item

    async def last_timestamp(self) -> datetime | None:
        return await self._db.scalar(
                select(func.max(StoreItemRevision.timestamp))
                .where(self._filter_revisions())
                )
