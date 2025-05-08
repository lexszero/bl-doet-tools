from datetime import datetime, timezone
from math import ceil
from typing import Any, Iterable, Mapping, Optional, Self

from cachetools import TTLCache
from cachetools_async import cached
from pydantic import BaseModel
from sqlalchemy import ForeignKey, Integer, String, cast, func, or_, select, union, and_
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.orm import Mapped, attribute_keyed_dict, joinedload, mapped_column, relationship
from sqlalchemy.sql import literal

from common.db_async import AsyncSessionMixin, DBSessionDep, DBModel
from common.errors import NotFoundError
from common.model_utils import ModelJson

from core.data_request import DataRequestContext
from core.data_view import DataViewBase
from core.importer.base import ImportContext
from core.user import UserInDB
from core.permission import ClientPermissions, Permission, PermissionInDB, Role, get_roles
from core.log import log
from core.project_config import ProjectConfig, merge_config
from core.map import AnyMapLayerData, MapViewData
from core.store import StoreCollection, StoreItemRevision, VersionedCollection

class View(BaseModel):
    name: str
    map_data: MapViewData

class Project(DBModel, AsyncAttrs, AsyncSessionMixin):
    __tablename__ = 'project'

    id: Mapped[int] = mapped_column(autoincrement=True, primary_key=True, index=True)
    owner_user_id: Mapped[int] = mapped_column(ForeignKey('user.id'))
    name: Mapped[str] = mapped_column(unique=True)
    data: Mapped[ProjectConfig] = mapped_column(ModelJson(ProjectConfig))

    owner_user: Mapped[UserInDB] = relationship()

    collections: Mapped[dict[str, StoreCollection]] = relationship(
            collection_class=attribute_keyed_dict('name'),
            cascade='all, delete-orphan'
            )

    @property
    def config(self):
        return self.data

    def roles_for(self, client_permissions: ClientPermissions):
        if self.config.public:
            return {*get_roles(client_permissions, 'project', self.id), Role.Guest}
        else:
            return get_roles(client_permissions, 'project', self.id)

    async def get_store_collection(self, collection_name: str, allow_create: bool = False):
        db = self._db()
        collection: StoreCollection = (await self.awaitable_attrs.collections).get(collection_name)
        if collection:
            return collection
        elif allow_create:
            cls = VersionedCollection.class_for(name=collection_name)
            collection = StoreCollection(
                project_id=self.id,
                name=collection_name,
                item_type=cls.store_item_type
                )
            (await self.awaitable_attrs.collections)[cls.store_collection_name] = collection
            db.add(collection)

            await db.flush()
            await self.owner_user.grant_permission(Permission(
                object_type='collection',
                object_id=str(collection.id),
                role=Role.Owner
                ))
            await db.flush()
            return collection
        raise NotFoundError("Collection not found")

    async def get_versioned_collection(self, collection_name: str, allow_create: bool = False, context: Optional[DataRequestContext] = None):
        return (await self.get_store_collection(
                collection_name=collection_name,
                allow_create=allow_create
                )).instantiate(context)

    async def get_all_permissions(self):
        db = self._db()
        subq = (union(
                select(
                    literal('project').label('object_type'),
                    literal(str(self.id)).label('object_id')
                    ),
                (select(
                    literal('collection').label('object_type'),
                    cast(StoreCollection.id, String).label('object_id')
                    )
                 .where(StoreCollection.project_id == self.id)
                )
                ).subquery())

        q = (select(PermissionInDB)
             .join(
                 subq,
                 and_(
                     PermissionInDB.object_type == subq.c.object_type,
                     PermissionInDB.object_id == subq.c.object_id
                     )
                 )
             .options(joinedload(PermissionInDB.user))
             )

        return (await db.scalars(q)).unique()

    async def get_all_changes(self, collections: Optional[list[str]] = None):
        db = self._db()
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

    async def get_last_change_timestamp(self, time_end: Optional[datetime] = None) -> Optional[datetime]:
        db = self._db()
        subquery = (
                select(StoreCollection.id)
                .where(StoreCollection.project_id == self.id)
                .subquery()
                )
        return await db.scalar(
                select(func.max(StoreItemRevision.timestamp))
                .join(subquery, StoreItemRevision.collection_id == subquery.c.id)
                .where(StoreItemRevision.timestamp < (time_end or datetime.now(timezone.utc)))
                )

    async def get_change_timestamps(self):
        tss: list[float] = []
        for item in await self.get_all_changes():
            ts = ceil(item.timestamp.timestamp())
            if ts not in tss:
                tss.append(ts)
        return [datetime.fromtimestamp(ts, tz=timezone.utc) for ts in tss]

    def get_view_config(self, view_name: str, client_roles: frozenset[Role]):
        view_config = self.data.views.get(view_name)
        if not view_config:
            raise NotFoundError(f"{self.name}: view {view_name} is not defined")
        view_config.check_permissions(client_roles)
        return view_config

    def element_data_key(self: Self, element_name: str, context: DataRequestContext):
        return self.name, element_name, context

    def get_view_element(
            self,
            view_name: str,
            element_alias: str,
            roles: frozenset[Role],
            ):
        view_config = self.get_view_config(view_name, roles)
        element_name = view_config.element(element_alias)
        if not element_name:
            raise NotFoundError(f"{self.name}: empty binding for alias {element_alias} in view {view_name}")
        return self.config.get_element_generator(element_name, roles)

    @cached(TTLCache(maxsize=64, ttl=30), key=element_data_key)
    async def get_view_element_data(
            self,
            view_name: str,
            element_alias: str,
            context: DataRequestContext,
            ):
        layer = self.get_view_element(view_name, element_alias, context.client_project_roles)
        log.debug(f"Rendering {self.name}/v/{view_name}/{element_alias}")
        return await layer.get(context)

    async def get_view(
            self,
            view_name: str,
            context: DataRequestContext,
            ):
        view_config = self.get_view_config(view_name, context.client_project_roles)

        results: dict[str, AnyMapLayerData] = {}
        elements: dict[str, DataViewBase] = {}
        for alias in view_config.elements():
            elements[alias] = self.get_view_element(view_name, alias, context.client_project_roles)

        for alias, element in elements.items():
            try:
                results[alias] = await element.get(context)
            except Exception as e:
                log.error(f"Invalid config: {e}", exc_info=e)

        return View(
                name=view_name,
                map_data=MapViewData(
                    options=view_config.options,
                    layers=results
                    )
                )

    async def set_config(self, config: ProjectConfig):
        db = self._db()
        config.name = self.name
        self.data = config
        db.add(self)
        await db.flush()

    def update_config(self, update: Mapping[str, Any] = {}):
        db = self._db()

        config = merge_config(self.data, update)
        config.name = self.name

        self.data = config
        db.add(self)

    async def update_data(self, user: Optional[UserInDB] = None, loader_name: Optional[str] = None):
        if loader_name:
            importers = [it for it in self.config.external.importers if it.loader == loader_name]
        else:
            importers = self.config.external.importers
        for importer in importers:
            loader = None
            if importer.loader:
                loader = self.config.external.loaders.get(importer.loader)

            ctx = ImportContext(
                    db=self._db(),
                    user=user,
                    project=self,
                    loader=loader
                    )
            await importer.do_import(ctx)

async def create_project(db: DBSessionDep, name: str, owner: UserInDB, config: ProjectConfig):
    config = config.model_copy()
    config.name = name

    p = Project(
            name=name,
            owner_user=owner,
            data=config
            )
    db.add(p)
    await db.flush()

    await owner.grant_permission(PermissionInDB(
        object_type='project',
        object_id=str(p.id),
        role=Role.Owner))

    await db.flush()

    return p

async def list_projects(db: DBSessionDep, user_id: Optional[int]) -> Iterable[Project]:
    ids_public = select(Project.id).where(Project.data['public'].as_boolean() == True)
    if user_id is not None:
        ids_restricted = select(cast(PermissionInDB.object_id, Integer).label('id')).where(
                and_(
                    PermissionInDB.object_type == 'project',
                    PermissionInDB.user_id == user_id
                    ))
        ids = union(ids_public, ids_restricted)
    else:
        ids = ids_public
    ids = ids.subquery()
    query = select(Project).join(ids, ids.c.id == Project.id)
    return await db.scalars(query)

