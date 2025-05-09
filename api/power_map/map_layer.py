import logging
from typing import ClassVar, Literal

from core.data_request import DataRequestContext
from core.data_view import DataViewBase
from core.map_layer_features import MapLayer_Features
from core.permission import Role
from power_map.dependencies import get_power_grid_cached
from power_map.power_grid import PowerGridProcessedFeature
from power_map.power_grid_base import PowerItemBase

from power_map.map_layer_types import MapLayerConfig_PowerGrid, MapLayerData_PowerGrid_Features

class MapLayer_PowerGrid(MapLayer_Features[PowerGridProcessedFeature],
        DataViewBase[
            MapLayerConfig_PowerGrid,
            MapLayerData_PowerGrid_Features
            ]):
    TYPE: ClassVar[Literal['power_grid']] = 'power_grid'

    async def get(
            self,
            context: DataRequestContext,
            min_log_level: int = logging.WARNING
            ):
        power_grid = await get_power_grid_cached(context.project.name, context.time_end)
        return MapLayerData_PowerGrid_Features(
            timestamp=power_grid._timestamp,
            log=[x for x in power_grid._log.entries if x.level >= min_log_level],
            features=[item.to_geojson_feature(PowerItemBase.feature_properties) for item in power_grid.grid_items],
            editable=bool(context.client_project_roles.intersection([Role.Editor, Role.Admin, Role.Owner]))
            )

__all__ = [
        'MapLayer_PowerGrid',
        ]
