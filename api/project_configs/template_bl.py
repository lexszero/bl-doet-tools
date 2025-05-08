from geojson_pydantic.types import Position2D
from core.map import MapDisplayOptions, MapViewConfig
from core.map_layer_features import MapLayerConfig_Features, MapLayerControls, MapLayerDisplayOptions
from core.map_layer_tile import MapLayerConfig_Tile
from placement.map_layer_types import MapLayerConfig_Placement

BL_ELEMENTS = {
        'basemap': MapLayerConfig_Tile(
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            ),
        'roads': MapLayerConfig_Features(
            collection='roads',
            display_options=MapLayerDisplayOptions(
                controls=MapLayerControls.Simple
                )
            ),
        'neighbourhoods': MapLayerConfig_Features(
            collection='neighbourhoods',
            display_options=MapLayerDisplayOptions(
                controls=MapLayerControls.Simple
                )
            ),
        'power_areas': MapLayerConfig_Features(
            collection='power_areas',
            display_options=MapLayerDisplayOptions(
                controls=MapLayerControls.Full
                )
            ),
        'power_grid': MapLayerConfig_Features(
            collection='power_grid_processed',
            display_options=MapLayerDisplayOptions(
                controls=MapLayerControls.Full
                )
            ),
        'placement': MapLayerConfig_Placement(
            collection='placement',
            transform='redacted',
            editable=False,
            display_options=MapLayerDisplayOptions(
                controls=MapLayerControls.Full
                )
            ),
        }

BL_MAP_OPTIONS = MapDisplayOptions(
        center=Position2D(57.62377, 14.92715),
        zoom=15,
        zoom_min=0,
        zoom_max=21,
        )


BL_VIEWS = {
        'default': MapViewConfig(
            map_options=BL_MAP_OPTIONS,
            layers={
                'basemap': 'basemap',
                'roads': 'roads',
                'power_areas': 'power_areas',
                'power_grid': 'power_grid',
                'placement': 'placement',
                }
            )
        }
