from geojson_pydantic.types import Position2D
from core.map import MapDisplayOptions, MapViewConfig
from core.map_layer_features import MapLayerConfig_Features, MapLayerControls, MapLayerDisplayOptions, MapLayerOptions
from core.map_layer_tile import MapLayerConfig_Tile
from placement.map_layer_types import MapLayerConfig_Placement

BL_MAP_BASE_URL = 'https://theborderland.se/map'

BL_AFTERMATH_ELEMENTS = {
        'aftermath_bl24': MapLayerConfig_Tile(
            url=BL_MAP_BASE_URL + '/data/bl24/aftermath/{z}/{x}/{y}.png',
            maxNativeZoom=19,
            ),
        'aftermath_bl23': MapLayerConfig_Tile(
            url=BL_MAP_BASE_URL + '/data/bl23/aftermath/{z}/{x}/{y}.png',
            ),
        'aftermath_bl22': MapLayerConfig_Tile(
            url=BL_MAP_BASE_URL + '/data/bl22/aftermath/{z}/{x}/{y}.png',
            )
        }

BL_ELEMENTS = {
        **BL_AFTERMATH_ELEMENTS,
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
        'roads_simplified': MapLayerConfig_Features(
            collection='roads',
            options=MapLayerOptions(
                controls=MapLayerControls.Simple,
                editable=False,
                display_options=MapLayerDisplayOptions(
                    types=['fireroad', 'minorroad']
                    )
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
        'power_grid_simplified': MapLayerConfig_Features(
            collection='power_grid_processed',
            options=MapLayerOptions(
                controls=MapLayerControls.Simple
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
                'aftermath_bl22': 'aftermath_bl22',
                'aftermath_bl23': 'aftermath_bl23',
                'aftermath_bl24': 'aftermath_bl24',
                'roads': 'roads',
                'power_areas': 'power_areas',
                'power_grid': 'power_grid',
                'placement': 'placement',
                }
            ),
        'power_rollout': MapViewConfig(
            options=BL_MAP_OPTIONS,
            layers={
                'basemap': 'basemap',
                'roads': 'roads_simplified',
                'power_grid': 'power_grid_simplified'
                }
            )
        }
