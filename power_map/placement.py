from typing import Optional

from pydantic import ConfigDict, Field, ValidationInfo, field_validator
from pydantic.alias_generators import to_camel
from pydantic_extra_types.color import Color

from .geometry import Feature, Polygon
from .utils import NameDescriptionModel, log

class PlacementEntityProperties(NameDescriptionModel):
    contact_info: Optional[str] = Field("")
    nr_of_people: Optional[int] = Field(0)
    nr_of_vehicles: Optional[int] = Field(0, alias='nrOfVechiles')
    additional_sqm: Optional[int] = Field(0)
    power_need: Optional[int] = Field(0)
    amplified_sound: Optional[int] = Field(0)
    color: Optional[Color] = Field(None)

    model_config = ConfigDict(
            alias_generator=to_camel,
            populate_by_name=True
            )

    @field_validator('power_need', mode='after')
    @classmethod
    def validate_power_need(cls, power_need: int, info: ValidationInfo):
        name = info.data.get('name', '<Unknown>')
        if power_need == -1:
            return 0
        elif power_need < 0:
            log.warning(f"Negative power: '{name}' wants {power_need} W, fixing up")
            return -power_need
        elif power_need > 100000:
            log.warning(f"Unrealisticly high power need: '{name}' wants {power_need} W, ignoring")
            return 0
        return power_need

PlacementEntityFeature = Feature[Polygon, PlacementEntityProperties]
