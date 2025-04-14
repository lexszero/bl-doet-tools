from typing import Literal

from pydantic import Field

from core.data_view import DataViewConfigBase
from core.map_layer_features import MapLayerConfig_Features, MapLayerData_Features
from power_map.itemized_log import ItemizedLogEntry
from power_map.placement import PlacementEntityFeature
from power_map.power_grid import PowerGridFeatureWithStats


class MapLayerConfig_PowerGrid(DataViewConfigBase):
    type: Literal['power_grid'] = 'power_grid'

class MapLayerData_PowerGrid_Features(MapLayerData_Features[PowerGridFeatureWithStats]):
    type: Literal['power_grid'] = 'power_grid'
    log: list[ItemizedLogEntry] = Field(default_factory=list)

class MapLayerConfig_Placement(MapLayerConfig_Features[PlacementEntityFeature]):
    type: Literal['placement'] = 'placement'

class MapLayerData_Placement(MapLayerData_Features[PlacementEntityFeature]):
    type: Literal['placement'] = 'placement'


__all__ = [
        'MapLayerConfig_PowerGrid',
        'MapLayerData_PowerGrid_Features'
        ]
