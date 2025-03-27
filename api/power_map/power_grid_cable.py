from functools import cached_property
from typing import Any, ClassVar, Literal

from pydantic import Field, computed_field

from common.geometry import Feature, GeometryLineString, LineStyle, LineString
from power_map.power_grid_base import PowerGridItemPropertiesBase, PowerItemBase

class PowerGridCableProperties(PowerGridItemPropertiesBase):
    type: Literal['power_grid_cable'] = Field('power_grid_cable', repr=False)

class PowerGridCablePropertiesWithStats(PowerGridCableProperties):
    length_m: float

class PowerGridCablePropertiesWithStatsStyled(PowerGridCablePropertiesWithStats, LineStyle):
    pass

PowerGridCableFeature = Feature[LineString, PowerGridCableProperties]

class PowerGridCable(
        PowerItemBase,
        GeometryLineString,
        PowerGridCableProperties
        ):
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
