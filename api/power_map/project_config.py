from geojson_pydantic.types import Position2D

from core.map import MapOptions, MapViewConfig
from core.map_layer_features import MapLayerConfig_Features
from core.map_layer_tile import MapLayerConfig_Tile
from core.permission import Role
from core.project_config import ProjectConfig
from power_map.map_layers_types import MapLayerConfig_Placement, MapLayerConfig_PowerGrid

_default_map_options = MapOptions(
        center=Position2D(57.62377, 14.92715),
        zoom=15,
        zoom_min=0,
        zoom_max=21
        )

_all_elements = {
        'basemap': MapLayerConfig_Tile(
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            ),
        'power_areas': MapLayerConfig_Features(
            collection='power_areas',
            ),
        'power_grid_features': MapLayerConfig_PowerGrid(),
            ),
        'placement': MapLayerConfig_Placement(
            collection='placement',
            transform='redacted',
            editable=False,
            ),
        }

_default_view_elements = {
        'basemap': 'basemap',
        'power_areas': 'power_areas',
        'power_grid': 'power_grid_features',
        'placement': 'placement',
        }

PROJECT_CONFIG = ProjectConfig(
        name='<undefined>',
        elements=_all_elements,
        public=True,
        views={
            'default': MapViewConfig(
                map_options=_default_map_options,
                elements={
                    **_default_view_elements,
                    }
                ),
            }
        )
