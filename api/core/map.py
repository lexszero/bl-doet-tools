from typing import Annotated, Optional, Set, Union

from geojson_pydantic.types import Position2D
from pydantic import BaseModel, Field

from core.data_view import DatasetViewConfig
from core.map_layer_features import MapLayerConfig_Features, MapLayerData_Features
from core.map_layer_tile import MapLayerConfig_Tile, MapLayerData_Tile
from power_map.map_layers_types import (
        MapLayerConfig_Placement,
        MapLayerConfig_PowerGrid,
        MapLayerData_Placement,
        MapLayerData_PowerGrid_Features,
        )


AnyMapLayerConfig = Annotated[
        Union[
            MapLayerConfig_Tile,
            MapLayerConfig_Features,
            MapLayerConfig_PowerGrid,
            MapLayerConfig_Placement
            ],
        Field(discriminator="type")
        ]

AnyMapLayerData = Annotated[
        Union[
            MapLayerData_Tile,
            MapLayerData_Features,
            MapLayerData_PowerGrid_Features,
            MapLayerData_Placement
            ],
        Field(discriminator='type')
        ]


class MapOptions(BaseModel):
    center: Position2D
    zoom: float = 21
    zoom_min: float = Field(0, serialization_alias='minZoom')
    zoom_max: float = Field(0, serialization_alias='maxZoom')

class MapViewConfig(DatasetViewConfig):
    map_options: Optional[MapOptions] = None

class MapViewData(BaseModel):
    map_options: Optional[MapOptions]
    layers: dict[str, AnyMapLayerData]
