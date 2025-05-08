from typing import Literal

from pydantic import Field

from core.data_view import DataViewConfigBase
from core.map_layer_features import MapLayerData_Features
from power_map.itemized_log import ItemizedLogEntry
from power_map.power_grid import PowerGridProcessedFeature

class MapLayerConfig_PowerGrid(DataViewConfigBase):
    type: Literal['power_grid'] = 'power_grid'

class MapLayerData_PowerGrid_Features(MapLayerData_Features[PowerGridProcessedFeature]):
    type: Literal['power_grid'] = 'power_grid'
    log: list[ItemizedLogEntry] = Field(default_factory=list)

__all__ = [
        'MapLayerConfig_PowerGrid',
        'MapLayerData_PowerGrid_Features'
        ]
