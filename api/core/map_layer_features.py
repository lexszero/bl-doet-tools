import asyncstdlib as a
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Callable, ClassVar, Generic, Literal, Optional, TypeVar

from geojson_pydantic import Feature
from geojson_pydantic.features import Feat
from pydantic import BaseModel, ConfigDict, Field

from common.errors import ConfigurationError, InternalError
from core.data_request import DataRequestContext
from core.data_view import DataViewBase, DataViewConfigBase, DataViewResultBase
from core.permission import Role
from core.store import StoreCollection

_Feat = TypeVar('_Feat', bound=Feature)

FeatureTransform = Callable[[Feat, DataRequestContext], Any]

class MapLayerControls(str, Enum):
    Off = 'off'
    Simple = 'simple'
    Full = 'full'

class MapLayerDisplayOptions(BaseModel):
    visible: bool = True

    model_config = ConfigDict(extra='allow')

class MapLayerOptions(BaseModel):
    editable: bool = False
    controls: Optional[MapLayerControls] = None
    display_options: Optional[MapLayerDisplayOptions] = Field(default=None, serialization_alias='initDisplayOptions')

class MapLayerConfig_Features(DataViewConfigBase, Generic[_Feat]):
    type: Literal['features'] = 'features'
    collection: str
    transform: Optional[str] = None
    options: MapLayerOptions = MapLayerOptions()

class MapLayerData_Features(DataViewResultBase, Generic[_Feat]):
    type: Literal['features'] = 'features'
    timestamp: Optional[datetime]
    options: Optional[MapLayerOptions] = None
    features: list[_Feat]

class MapLayer_Features(
        DataViewBase[
            MapLayerConfig_Features[Feat],
            MapLayerData_Features[Feat]
            ],
        Generic[Feat]):
    TYPE: ClassVar[Literal['features']] = 'features'
    TRANSFORMS: ClassVar[Optional[dict[str, FeatureTransform]]] = None

    async def get(self, context: DataRequestContext):
        store_collection: StoreCollection = await context.project.get_store_collection(self.config.collection)
        collection = store_collection.instantiate(context)
        features = await a.list(collection.all_last_values())
        if self.config.transform:
            if not self.TRANSFORMS:
                raise InternalError(f'MapLayer_Features: missing transforms')
            transform = self.TRANSFORMS.get(self.config.transform)
            if not transform:
                raise ConfigurationError(f'unsupported transform: {self.config.transform}')
            features = [transform(f, context) for f in features]
        options = self.config.options.model_copy()
        options.editable = (
                not context.project.config.frozen
                and options.editable
                and bool(store_collection.roles_for(context.client_permissions).intersection([Role.Editor, Role.Admin, Role.Owner]))
                )
        return MapLayerData_Features(
            type='features',
            timestamp=await collection.last_timestamp(),
            features=features,
            options=options
        )
