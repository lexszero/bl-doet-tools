from functools import cached_property
from typing import Any, ClassVar, Literal

from pydantic import Field, computed_field

from power_map.geometry import GeometryLineString, LineStyle
from power_map.power_grid_base import PowerGridBaseProperties, PowerGridItem

class PowerGridCableProperties(PowerGridBaseProperties):
    type: Literal['power_grid_cable'] = Field('power_grid_cable', repr=False)

class PowerGridCablePropertiesWithStats(PowerGridCableProperties):
    length_m: float

class PowerGridCablePropertiesWithStatsStyled(PowerGridCablePropertiesWithStats, LineStyle):
    pass

class PowerGridCable(PowerGridItem, GeometryLineString, PowerGridCableProperties):
    _PropertiesModel = PowerGridCablePropertiesWithStats
    _PropertiesStyledModel = PowerGridCablePropertiesWithStatsStyled

    @computed_field
    @cached_property
    def length_m(self) -> float:
        return int(self.length)

    CSV_COLUMNS: ClassVar = ['area', 'name', 'size', 'length_m']
    def csv_row_properties(self) -> list[Any]:
        return [
                self._areas[1].name,
                f"{self.name_description}",
                self.size,
                self.length_m
                ]



__all__ = [
        'PowerGridCableProperties',
        'PowerGridCablePropertiesWithStats',
        'PowerGridCablePropertiesWithStatsStyled',
        'PowerGridCable'
        ]
