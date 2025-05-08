from abc import abstractmethod
from dataclasses import dataclass
from datetime import datetime, timedelta
import json
from typing import Generic, Iterable, Literal, Optional, Protocol

from geojson_pydantic.features import Feat
from pydantic import BaseModel, StrictInt, StrictStr, model_validator
from pydantic.fields import PrivateAttr
import requests

from common.db_async import AsyncSession
from common.log import Log
from common.model_utils import ModelT
from common.settings import settings
from core.store import VersionedCollection
from core.user import UserInDB

log = Log.getChild("importer")

class LoaderBase(BaseModel):
    pass

@dataclass
class ImportContext:
    db: AsyncSession
    user: UserInDB
    project: 'Project'
    loader: LoaderBase

class ImporterBase(BaseModel, Generic[ModelT]):
    loader: Optional[str]

    @abstractmethod
    async def do_import(self, ctx: ImportContext):
        raise NotImplemented

class CollectionImporterBase(ImporterBase[ModelT], Generic[ModelT]):
    collection: str
    async def get_target_collection(self, ctx: ImportContext, allow_create: bool = False) -> VersionedCollection:
        return await ctx.project.get_versioned_collection(
            self.collection,
            allow_create=allow_create
            )

class ItemRevisionProtocol(Protocol[ModelT]):
    id: int
    revision: int
    deleted: bool

    @property
    @abstractmethod
    def timestamp_utc(self) -> datetime:
        raise NotImplemented

    @property
    @abstractmethod
    def item(self) -> ModelT:
        raise NotImplemented

class ImporterIncremental(CollectionImporterBase, Generic[ModelT]):
    @abstractmethod
    def get_revisions(self, ctx: ImportContext, time_start: datetime) -> Iterable[ItemRevisionProtocol[ModelT]]:
        raise NotImplemented

    async def do_import(self, ctx: ImportContext):
        collection = await self.get_target_collection(ctx, allow_create=True)
        time_start = await collection.last_timestamp()
        if time_start:
            time_start += timedelta(milliseconds=1)
        else:
            time_start = datetime.fromtimestamp(0)

        revisions = self.get_revisions(ctx, time_start)
        n_added = 0
        for rev in revisions:
            item = rev.item
            item.id = f"_{item.id}"

            await collection.add(ctx.user, item.id, item,
                                 timestamp=rev.timestamp_utc,
                                 revision=rev.revision,
                                 deleted=rev.deleted,
                                 )
            n_added += 1
            log.debug(f"Added new revision {rev.revision} for {rev.item.id} ({rev.item.properties.name})")
        log.info(f"{ctx.project.name}/{self.collection}: {n_added} revisions added")

class LoadFromUrlOrFile(LoaderBase):
    type: Literal['url_or_file'] | Literal['power_map_kml'] = 'url_or_file'
    offline: bool = False
    url: Optional[str] = None
    filename: Optional[str] = None

    @model_validator(mode='after')
    def validate_config(self):
        if not self.url and not self.filename:
            raise ValueError("Both url or filename are not defined")
        if self.offline and not self.filename:
            raise ValueError("filename is required when offline")
        return self

    def load(self, path: Optional[str] = None, params: Optional[dict[str, str]] = None):
        if self.offline or not self.url:
            if not self.filename:
                raise RuntimeError("PlacementLoader: missing filename")
            if path or params:
                raise RuntimeError("Loading with path or params is only possible from URL")
            log.info(f"Loading file {self.filename}")
            with open(f'{settings.data_dir}/{self.filename}', 'rb') as f:
                return f.read()
        else:
            if not path:
                path = ""
            log.info(f"Loading URL {self.url+path} with params {params}")
            return requests.get(self.url+path, params).content

    def load_json(self, path: Optional[str] = None, params: Optional[dict[str, str]] = None):
        return json.loads(self.load(path, params))
