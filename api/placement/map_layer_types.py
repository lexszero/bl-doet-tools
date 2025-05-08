from typing import Literal
from core.map_layer_features import MapLayerConfig_Features, MapLayerData_Features
from placement.types import PlacementEntityFeature

class MapLayerConfig_Placement(MapLayerConfig_Features[PlacementEntityFeature]):
    type: Literal['placement'] = 'placement'

class MapLayerData_Placement(MapLayerData_Features[PlacementEntityFeature]):
    type: Literal['placement'] = 'placement'


