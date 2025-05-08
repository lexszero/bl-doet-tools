from typing import ClassVar, Literal
from pydantic import BaseModel

from core.data_request import DataRequestContext
from core.data_view import DataViewBase, DataViewConfigBase, DataViewResultBase

class _MapTileLayer(BaseModel):
    type: Literal['tile'] = 'tile'
    url: str
    minZoom: float = 0
    maxZoom: float = 21
    minNativeZoom: float = 0
    maxNativeZoom: float = 20
    tms: bool = False

class MapLayerConfig_Tile(DataViewConfigBase, _MapTileLayer):
    type: Literal['tile'] = 'tile'
    pass

class MapLayerData_Tile(DataViewResultBase, _MapTileLayer):
    type: Literal['tile'] = 'tile'
    pass

class MapLayer_Tile(
        DataViewBase[
            MapLayerConfig_Tile,
            MapLayerData_Tile
            ]):
    TYPE: ClassVar[Literal['tile']] = 'tile'
    async def get(self, context: DataRequestContext):
        return MapLayerData_Tile.model_validate(self.config.model_dump())
