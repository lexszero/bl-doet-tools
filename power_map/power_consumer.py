from enum import Enum
from math import inf
from typing import Any, ClassVar, Iterable, Literal, Optional

import matplotlib as mpl

from pydantic import PrivateAttr
from pydantic_extra_types.color import Color

from power_map.geometry import GeometryPolygon, PolygonStyle
from power_map.placement import PlacementEntityProperties
from power_map.power_grid_base import PowerItem
from power_map.power_grid_pdu import PowerGridPDU
from power_map.utils import log

class PowerConsumerColoringMode(str, Enum):
    power_need = 'power_need'
    grid_coverage = 'grid_coverage'
    sound = 'sound'

class PowerConsumerProperties(PlacementEntityProperties):
    type: Literal['power_consumer'] = 'power_consumer'

class PowerConsumerPropertiesWithStats(PowerConsumerProperties):
    power_nr_pdus: Optional[int] = None
    power_nearest_pdu_distance: Optional[float] = None

class PowerConsumerPropertiesWithStatsStyled(PowerConsumerPropertiesWithStats, PolygonStyle):
    pass

class PowerConsumer(PowerItem, GeometryPolygon, PowerConsumerPropertiesWithStats):
    _up_to_date: bool = PrivateAttr(False)

    ColoringMode: ClassVar[type] = Literal['power_need'] | Literal['grid_coverage'] | Literal['sound']

    def find_pdus(self, pdus: Iterable[PowerGridPDU]):
        p_item = self.shape_proj.centroid
        best_distance = inf
        nr_pdus = 0
        if not self.power_need:
            self._up_to_date = True
            return
        for pdu in pdus:
            distance = p_item.distance(pdu.shape_proj)
            if distance < best_distance:
                best_distance = distance
            if distance > 50:
                continue
            nr_pdus += 1
            pdu._consumers.append(self)
        if best_distance > 50:
            log.warning(f"Nearest PDU is too far ({best_distance:.0f}m) for '{self}'")
        self.power_nearest_pdu_distance = int(best_distance)
        self.power_nr_pdus = nr_pdus
        self._up_to_date = True

    def feature_properties(self) -> PowerConsumerPropertiesWithStats:
        return PowerConsumerPropertiesWithStats.model_validate(self, from_attributes=True)

    def feature_properties_styled(self, mode: PowerConsumerColoringMode = PowerConsumerColoringMode.power_need, context: Optional[Any] = None) -> PowerConsumerPropertiesWithStatsStyled:

        return PowerConsumerPropertiesWithStatsStyled.model_validate({
            **self.model_dump(exclude_none=True, exclude_unset=True),
            **PolygonStyle(fill=getattr(self, '_color_by_'+mode)()).model_dump(exclude_none=True)
            })

    def _color_by_power_need(self) -> Color:
        power = self.power_need or 0
        if power == 0:
            color = [0, 0, 0]
        elif power <= 1000:
            color = COLORMAP_PWR_LOW(1-COLORNORM_PWR_LOW(power), bytes=True)
        else:
            color = COLORMAP_PWR_HIGH(COLORNORM_PWR_HIGH(power), bytes=True)
        return Color('#'+bytes(color)[:3].hex())

    def _color_by_grid_coverage(self) -> Color:
        if not self.power_need:
            nr_pdus = 10
        else:
            nr_pdus = self.power_nr_pdus
        return Color('#'+bytes(COLORMAP_PWR_HIGH(1-COLORNORM_PWR_COVERAGE(nr_pdus), bytes=True))[:3].hex())

    def _color_by_sound(self) -> Color:
        return Color('#'+bytes(COLORMAP_SOUND(COLORNORM_SOUND(self.amplified_sound), bytes=True))[:3].hex())


COLORMAP_PWR_HIGH = mpl.colormaps['plasma']
COLORNORM_PWR_HIGH= mpl.colors.Normalize(vmin=0, vmax=7400)
COLORMAP_PWR_LOW = mpl.colormaps['winter']
COLORNORM_PWR_LOW= mpl.colors.Normalize(vmin=0, vmax=1250)
COLORMAP_PWR_COVERAGE = mpl.colormaps['inferno']
COLORNORM_PWR_COVERAGE= mpl.colors.Normalize(vmin=0, vmax=5)
COLORMAP_SOUND = mpl.colormaps['cool']
COLORNORM_SOUND= mpl.colors.Normalize(vmin=0, vmax=10000)

POWER_CONSUMER_COLOR_FUNCTIONS = {
        }


