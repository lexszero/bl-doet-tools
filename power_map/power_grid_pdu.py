from typing import Literal

from pydantic import Field, PrivateAttr, computed_field

from power_map.geometry import GeometryPoint, PointStyle
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

__all__ = [
        'PowerGridPDUProperties',
        'PowerGridPDUPropertiesWithStats',
        'PowerGridPDUPropertiesWithStatsStyled',
        'PowerGridPDU'
        ]
