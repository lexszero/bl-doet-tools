from typing import Literal, Optional

from pydantic import Field, PrivateAttr, computed_field

from common.geometry import XFRM_PROJ_TO_GEO, Feature, GeometryPoint, Point, PointStyle, Polygon, coord_transform
from power_map.log import log as log_default
from power_map.power_grid_base import PowerGridItemPropertiesBase, PowerItemBase

class PowerGridPDUProperties(PowerGridItemPropertiesBase):
    type: Literal['power_grid_pdu'] = Field('power_grid_pdu', repr=False)
    power_source: bool = False

class PowerGridProcessedPDUProperties(PowerGridPDUProperties):
    cable_in: Optional[str]
    cables_out: list[str] = Field(default_factory=list)

class PowerGridPDUPropertiesWithStatsStyled(PowerGridProcessedPDUProperties, PointStyle):
    pass

PowerGridPDUFeature = Feature[Point, PowerGridPDUProperties]

class PowerGridPDU(
        PowerItemBase,
        GeometryPoint,
        PowerGridPDUProperties):
    _PropertiesModel = PowerGridProcessedPDUProperties
    _PropertiesStyledModel = PowerGridPDUPropertiesWithStatsStyled

    _consumers: list['PowerConsumer'] = PrivateAttr(default_factory=list)
    _cables: list['PowerGridCable'] = PrivateAttr(default_factory=list)
    _cable_in: Optional['PowerGridCable'] = None
    _cables_out: list['PowerGridCable'] = PrivateAttr(default_factory=list)

    @computed_field
    @property
    def nr_consumers(self) -> int:
        return len(self._consumers)

    @computed_field
    @property
    def cable_in(self) -> Optional[str]:
        return self._cable_in and self._cable_in.id

    @computed_field
    @property
    def cables_out(self) -> list[str]:
        return [item.id for item in self._cables_out]

    def coverage_geometry(self, radius: float = 50) -> Polygon:
        return coord_transform(XFRM_PROJ_TO_GEO,
            self.shape_proj.buffer(radius, quad_segs=8))

    def connect(self, log, cable_in: Optional['PowerGridCable'] = None, indent: str = ''):
        if cable_in:
            if self.power_source:
                log.error(self.id, f"PDU is already power_source, can't also energize it from elsewhere")
                return False
            if cable_in.size != self.size:
                log.error(self.id, f"Can't power PDU from {cable_in.id}: size mismatch")
                return False
            cable_in._pdu_to = self
            self._cable_in = cable_in
            log_default.debug(f"{indent} connected {cable_in._pdu_from.id} >-[{cable_in.id}]-> {self.id}")
        else:
            if not self.power_source:
                log.error(self.id, "Cannot distribute power from PDU that is not power_source and doesn't have cable_in")
            log.debug(self.id, f"PDU is a power source")

        connected = []
        for cable in self._cables:
            if cable is cable_in:
                continue
            if cable.connect(log, self, indent+'[]'):
                connected.append(cable)
        self._cables_out = connected

        return True


__all__ = [
        'PowerGridPDUProperties',
        'PowerGridProcessedPDUProperties',
        'PowerGridPDUPropertiesWithStatsStyled',
        'PowerGridPDUFeature',
        'PowerGridPDU'
        ]
