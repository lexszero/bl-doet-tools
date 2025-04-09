from functools import cached_property
from typing import Any, ClassVar, Literal, Optional

from pydantic import Field, PrivateAttr, computed_field

from common.geometry import Feature, GeometryLineString, LineStyle, LineString, ShapelyPoint, coord_transform, XFRM_GEO_TO_PROJ
from power_map.power_grid_base import PowerGridItemPropertiesBase, PowerItemBase
from power_map.utils import log as log_default

class PowerGridCableProperties(PowerGridItemPropertiesBase):
    type: Literal['power_grid_cable'] = Field('power_grid_cable', repr=False)

class PowerGridCablePropertiesWithStats(PowerGridCableProperties):
    length_m: float
    pdu_from: Optional[str]
    pdu_to: Optional[str]

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

    _pdu_from: Optional['PowerGridPDU'] = None
    _pdu_to: Optional['PowerGridPDU'] = None
    _pdus: list['PowerGridPDU'] = PrivateAttr(default_factory=list)

    @computed_field
    @cached_property
    def length_m(self) -> float:
        return int(self.length)

    @computed_field
    @property
    def pdu_from(self) -> Optional[str]:
        return self._pdu_from and self._pdu_from.id

    @computed_field
    @property
    def pdu_to(self) -> Optional[str]:
        return self._pdu_to and self._pdu_to.id

    CSV_COLUMNS: ClassVar = ['area', 'name', 'size', 'length_m']
    def csv_row_properties(self) -> list[Any]:
        return [
                self._areas[1].name,
                f"{self.name_description}",
                self.size,
                self.length_m
                ]

    def print_info(self, output=log_default.debug):
        output(f"Cable {self.id}: [{self.size}] {self.name} (length {self.length_m}m)")
        for pdu in self._pdus:
            output(f"  PDU {pdu.id}")

    @property
    def end_points(self) -> tuple[ShapelyPoint, ShapelyPoint]:
        return ShapelyPoint(self.shape.coords[0]), ShapelyPoint(self.shape.coords[-1])

    @property
    def end_points_proj(self) -> tuple[ShapelyPoint, ShapelyPoint]:
        ep = self.end_points
        return coord_transform(XFRM_GEO_TO_PROJ, ep[0]), coord_transform(XFRM_GEO_TO_PROJ, ep[1])

    def has_pdu(self, pdu: 'PowerGridPDU') -> bool:
        return any([p is pdu for p in self._pdus])

    def connect(self, log, pdu_from: 'PowerGridPDU', indent: str = '') -> bool:
        log_default.debug(f"{indent} Trying to energize {self.id} from PDU {pdu_from.id}")
        if self._pdu_from:
            log.error(self.id, f"Cable is already energized from {self._pdu_from.id}")
            return False
        self._pdu_from = pdu_from
        results = []
        for pdu in self._pdus:
            if (pdu is not pdu_from) and (not pdu._cable_in) and not (pdu.power_source):
                return pdu.connect(log, self, indent+' → ')

        return any(results)


__all__ = [
        'PowerGridCableProperties',
        'PowerGridCablePropertiesWithStats',
        'PowerGridCablePropertiesWithStatsStyled',
        'PowerGridCable'
        ]
