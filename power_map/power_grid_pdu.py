from typing import Literal

from pydantic import Field, PrivateAttr, computed_field

from power_map.geometry import XFRM_PROJ_TO_GEO, GeometryPoint, PointStyle, Polygon, coord_transform
from power_map.power_grid_base import PowerGridBaseProperties, PowerGridItem

class PowerGridPDUProperties(PowerGridBaseProperties):
    type: Literal['power_grid_pdu'] = Field('power_grid_pdu', repr=False)

class PowerGridPDUPropertiesWithStats(PowerGridPDUProperties):
    nr_consumers: int

class PowerGridPDUPropertiesWithStatsStyled(PowerGridPDUPropertiesWithStats, PointStyle):
    pass

class PowerGridPDU(PowerGridItem, GeometryPoint, PowerGridPDUProperties):
    _PropertiesModel = PowerGridPDUPropertiesWithStats
    _PropertiesStyledModel = PowerGridPDUPropertiesWithStatsStyled

    _consumers: list['PowerConsumer'] = PrivateAttr(default_factory=list)

    @computed_field
    @property
    def nr_consumers(self) -> int:
        return len(self._consumers)

    def coverage_geometry(self, radius: float = 50) -> Polygon:
        return coord_transform(XFRM_PROJ_TO_GEO,
            self.shape_proj.buffer(radius, quad_segs=8))

__all__ = [
        'PowerGridPDUProperties',
        'PowerGridPDUPropertiesWithStats',
        'PowerGridPDUPropertiesWithStatsStyled',
        'PowerGridPDU'
        ]
