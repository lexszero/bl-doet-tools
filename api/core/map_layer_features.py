from datetime import datetime
from typing import Any, Callable, ClassVar, Generic, Literal, Optional, TypeVar
import asyncstdlib as a

from geojson_pydantic import Feature
from geojson_pydantic.features import Feat

from common.errors import ConfigurationError, InternalError
from core.data_request import DataRequestContext
from core.data_view import DataViewBase, DataViewConfigBase, DataViewResultBase
from core.store import get_versioned_collection

_Feat = TypeVar('_Feat', bound=Feature)

FeatureTransform = Callable[[Feat], Any]

class MapLayerConfig_Features(DataViewConfigBase, Generic[_Feat]):
    type: Literal['features'] = 'features'
    collection: str
    transform: Optional[str] = None
    editable: bool = False

class MapLayerData_Features(DataViewResultBase, Generic[_Feat]):
    type: Literal['features'] = 'features'
    timestamp: Optional[datetime]
    editable: bool = False
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
        collection = await get_versioned_collection(
                context.project,
                self.config.collection,
                context.time_start,
                context.time_end)
        features = await a.list(collection.all_last_values())
        if self.config.transform:
            if not self.TRANSFORMS:
                raise InternalError(f'MapLayer_Features: missing transforms')
            transform = self.TRANSFORMS.get(self.config.transform)
            if not transform:
                raise ConfigurationError(f'unsupported transform: {self.config.transform}')
            features = [transform(f) for f in features]
        return MapLayerData_Features(
            type='features',
            timestamp=await collection.last_timestamp(),
            features=features
        )
