from typing import Literal, Mapping, Optional

from geojson_pydantic import Feature
from geojson_pydantic.geometries import Geometry
from numpy import version
from pydantic import BaseModel, ConfigDict

from core.importer.base import ImportContext, ImporterBase, LoadFromUrlOrFile
from core.importer.matching import ImporterMatching
from core.store import VersionedCollection

class AnyProperties(BaseModel):
    model_config = ConfigDict(
            extra='allow'
            )

AnyFeature = Feature[Geometry, AnyProperties]

class Importer_FeatureCollection(ImporterMatching):
    type: Literal['feature_collection'] = 'feature_collection'

    collection: str
    path: Optional[str] = None

    def get_features(self, ctx: ImportContext):
        if not isinstance(ctx.loader, LoadFromUrlOrFile):
            raise RuntimeError("Loader is not LoadFromUrlOrFile")
        loader: LoadFromUrlOrFile = ctx.loader

        j = loader.load_json(self.path)
        for item in j['features']:
            yield AnyFeature.model_validate(item)

class Importer_StaticCollections(ImporterBase):
    type: Literal['static_collections'] = 'static_collections'

    collections: Mapping[str, str]

    async def do_import(self, ctx: ImportContext):
        if not isinstance(ctx.loader, LoadFromUrlOrFile):
            raise RuntimeError("Loader is not LoadFromUrlOrFile")

        for collection, path in self.collections.items():
            importer = Importer_FeatureCollection(
                    loader=self.loader,
                    collection=collection,
                    path=path)
            await importer.do_import(ctx)
