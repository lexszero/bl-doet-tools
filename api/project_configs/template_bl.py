from geojson_pydantic.types import Position2D
from core.map import MapDisplayOptions, MapViewConfig
from core.map_layer_features import MapLayerConfig_Features, MapLayerControls, MapLayerOptions
from core.map_layer_tile import MapLayerConfig_Tile
from placement.map_layer_types import MapLayerConfig_Placement

BL_ELEMENTS = {
        'basemap': MapLayerConfig_Tile(
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            ),
        'roads': MapLayerConfig_Features(
            collection='roads',
            options=MapLayerOptions(
                controls=MapLayerControls.Full,
                editable=False,
                )
            ),
        'neighbourhoods': MapLayerConfig_Features(
            collection='neighbourhoods',
            options=MapLayerOptions(
                controls=MapLayerControls.Simple,
                editable=False,
                )
            ),
        'power_areas': MapLayerConfig_Features(
            collection='power_areas',
            options=MapLayerOptions(
                controls=MapLayerControls.Full
                )
            ),
        'power_grid': MapLayerConfig_Features(
            collection='power_grid_processed',
            options=MapLayerOptions(
                controls=MapLayerControls.Full
                )
            ),
        'placement': MapLayerConfig_Placement(
            collection='placement',
            transform='redacted',
            options=MapLayerOptions(
                controls=MapLayerControls.Full,
                editable=False,
                )
            ),
        }

BL_MAP_OPTIONS = MapDisplayOptions(
        center=Position2D(57.62377, 14.92715),
        zoom=16,
        zoom_min=0,
        zoom_max=21,
        )


BL_VIEWS = {
        'default': MapViewConfig(
            options=BL_MAP_OPTIONS,
            layers={
                'basemap': 'basemap',
                'roads': 'roads',
                'power_areas': 'power_areas',
                'power_grid': 'power_grid',
                'placement': 'placement',
                }
            )
        }
