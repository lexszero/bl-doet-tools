import re
from enum import Enum
from typing import Any, Optional, Self

from pydantic import ConfigDict, Field, PrivateAttr

from common.geometry import Feature, GeoObject
from power_map.utils import NameDescriptionModel

PowerGridItemSizeOrder: list[str] = ['unknown', '1f', '16', '32', '63', '125', '250']

class PowerGridItemSize(str, Enum):
    Unknown = 'unknown'
    SinglePhase_16A = '1f'
    ThreePhase_16A = '16'
    ThreePhase_32A = '32'
    ThreePhase_63A = '63'
    ThreePhase_125A = '125'
    ThreePhase_250A = '250'

    def __ge__(self, other):
        if self.__class__ is other.__class__:
            return self.value == other.value or other < self
        return NotImplemented

    def __gt__(self, other):
        if self.__class__ is other.__class__:
            return other < self
        return NotImplemented

    def __le__(self, other):
        if self.__class__ is other.__class__:
            return self.value == other.value or self < other
        return NotImplemented

    def __lt__(self, other):
        if self.__class__ is other.__class__:
            return PowerGridItemSizeOrder.index(self.value) < PowerGridItemSizeOrder.index(other.value)
        return NotImplemented

    def __str__(self):
        return self.value

    def __repr__(self):
        return self.value

    @classmethod
    def parse_str(cls, s) -> 'PowerGridItemSize':
        if not s:
            raise ValueError
        if 'KVA' in s:
            raise ValueError
        m = re.match(r'(\d+)\s?A', s)
        if m:
            amps = m.groups(1)[0]
        else:
            m = re.match(r'^(.*?)\s?(\d+)', s)
            if not m:
                raise ValueError
            txt, val = m.groups(1)
            if txt in ['Point', 'Line']:
                raise ValueError
            amps = val

        if amps == '64' or amps == '50':
            amps = '63'

        if amps == '230':
            amps = '1f'

        return PowerGridItemSize(amps)

class PowerGridItemPropertiesBase(NameDescriptionModel):
    #type: Literal['power_grid_pdu'] | Literal['power_grid_cable'] = Field(repr=False)

    size: PowerGridItemSize = Field(PowerGridItemSize.Unknown, alias="power_size")
    native: bool = Field(False, alias="power_native")

    model_config = ConfigDict(
            populate_by_name=True
            )

class PowerItemBase(GeoObject):
    _PropertiesModel: type
    _PropertiesStyledModel: type

    _areas: list['PowerArea'] = PrivateAttr(default_factory=list)

    @classmethod
    def from_feature(cls, feature: Feature) -> Self:
        if not feature.properties:
            raise ValueError(f"Placement entity feature {feature} is missing properties")
        return cls(id=feature.id, geometry=feature.geometry, **feature.properties.model_dump())

    def feature_properties(self, context: Optional[Any] = None):
        return self._PropertiesModel.model_validate(self.model_dump(), context=context)

    def feature_properties_styled(self, context: Optional[Any] = None):
        return self._PropertiesStyledModel.model_validate({**self.model_dump(), **STYLE_GRID_ITEM_SIZE[self.size]}, context=context)

COLOR_NATIVE = "#00B9DF"
STYLE_GRID_ITEM_SIZE = {
    PowerGridItemSize.ThreePhase_125A: {
        'weight': 5,
        'color': '#C4162A',
        },
    PowerGridItemSize.ThreePhase_63A: {
        'weight': 4,
        'color': '#F2495C',
        },
    PowerGridItemSize.ThreePhase_32A: {
        'weight': 3,
        'color': '#FF9830',
        },
    PowerGridItemSize.ThreePhase_16A: {
        'weight': 2,
        'color': '#FADE2A'
        },
    PowerGridItemSize.SinglePhase_16A: {
        'weight': 1,
        'color': '#5794F2'
        },
    PowerGridItemSize.Unknown: {
        'weight': 5,
        'color': '#FF0000'
        },
    }

__all__ = [
        'PowerGridItemSize',
        'PowerGridItemPropertiesBase',
        'PowerItemBase',
        ]
