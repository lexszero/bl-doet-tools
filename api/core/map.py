from dataclasses import dataclass
from typing import Annotated, Iterable, Optional, Union

from geojson_pydantic.types import Position2D
from pydantic import BaseModel, ConfigDict, Field

from core.data_view import ElementMapping
from core.map_layer_features import MapLayerConfig_Features, MapLayerData_Features
from core.map_layer_tile import MapLayerConfig_Tile, MapLayerData_Tile
from power_map.map_layer_types import (
        MapLayerConfig_PowerGrid,
        MapLayerData_PowerGrid_Features,
        )
from placement.map_layer_types import (
        MapLayerConfig_Placement,
        MapLayerData_Placement,
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

@dataclass
class MapDisplayOptions:
    center: Position2D
    zoom: float = 21
    zoom_min: float = Field(0, serialization_alias='minZoom')
    zoom_max: float = Field(0, serialization_alias='maxZoom')

class MapViewConfig(ElementMapping):
    map_options: Optional[MapDisplayOptions] = Field(None)
    layers: dict[str, str] = Field(default_factory=dict)

    def element(self, key: str) -> str:
        l = self.layers.get(key)
        if l:
            return l
        raise KeyError(f"No {key} in MapViewConfig.layers")

    def elements(self) -> Iterable[str]:
        return self.layers.keys()

class MapViewData(BaseModel):
    map_options: Optional[MapDisplayOptions] = Field(None, serialization_alias='mapOptions')
    layers: dict[str, AnyMapLayerData]
