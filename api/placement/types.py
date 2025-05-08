from dataclasses import dataclass
from datetime import timezone
from typing import Annotated, Any, Optional, Self

from geojson_pydantic import Feature, Polygon
from geojson_pydantic.geometries import Geometry
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, ValidationInfo, field_validator, model_validator
from pydantic.alias_generators import to_camel
from pydantic_extra_types.color import Color

from common.datetime import datetime_cet
from common.log import Log
from common.types import NameDescriptionModel
from core.importer.feature_collection import AnyFeature
from core.store import VersionedCollection
from power_map.power_grid_base import PowerPlugType

log = Log.getChild('placement')

WeakInt = Annotated[Optional[int], BeforeValidator(lambda v: v)]
WeakFloat = Annotated[Optional[float], BeforeValidator(lambda v: v)]

@dataclass
class PowerAppliance:
    name: str
    watt: WeakInt = Field(0)
    amount: WeakInt = Field(1)

class PlacementEntityProperties(NameDescriptionModel):
    name: str = ''
    contact_info: Optional[str] = Field("")
    nr_of_people: WeakInt = Field(0)
    nr_of_vehicles: WeakInt = Field(0, alias='nrOfVechiles')
    additional_sqm: WeakFloat = Field(0)
    amplified_sound: WeakInt = Field(0)
    color: Optional[Color] = Field(None)
    suppressWarnings: Optional[bool] = Field(False)

    tech_contact_info: Optional[str] = None
    power_plug_type: Optional[PowerPlugType] = None
    power_extra_info: Optional[str] = None
    power_image: Optional[str] = None
    power_need: WeakInt = Field(0)
    power_appliances: list[PowerAppliance] = Field(default_factory=list)

    model_config = ConfigDict(
            alias_generator=to_camel,
            populate_by_name=True,
            extra='allow'
            )

#    @field_validator('nr_of_people', 'nr_of_vehicles', 'additional_sqm', 'power_need', 'amplified_sound'

    @field_validator('power_need', mode='after')
    @classmethod
    def validate_power_need(cls, power_need: int, info: ValidationInfo):
        name = info.data.get('name', '<Unknown>')
        if not power_need or power_need == -1:
            return 0
        elif power_need < 0:
            log.warning(f"Negative power: '{name}' wants {power_need} W, fixing up")
            return -power_need
        elif power_need > 100000:
            log.warning(f"Unrealistically high power need: '{name}' wants {power_need} W, ignoring")
            return 0
        return power_need

    @field_validator('power_plug_type', mode='before')
    @classmethod
    def validate_power_plug_type(cls, value: Any):
        if not value:
            return None
        return PowerPlugType(value)

PlacementEntityFeature = Feature[Polygon, PlacementEntityProperties]


class PlacementEntityRevision(BaseModel):
    id: int
    revision: int
    geojson: PlacementEntityFeature = Field(alias='geoJson')
    timestamp: datetime_cet = Field(alias='timeStamp')
    deleted: bool = Field(False, alias='isDeleted')
    delete_reason: Optional[str] = Field(None, alias='deleteReason')

    @field_validator('geojson', mode='before')
    @classmethod
    def validate_geojson(cls, geojson: str | dict[str, Any]) -> PlacementEntityFeature:
        if isinstance(geojson, str):
            return PlacementEntityFeature.model_validate_json(geojson)
        else:
            return PlacementEntityFeature.model_validate(geojson)

    @model_validator(mode='after')
    def update_feature_id(self) -> Self:
        if not self.geojson.id:
            self.geojson.id = self.id
        return self

    @property
    def item(self):
        return self.geojson

    @property
    def timestamp_utc(self):
        return self.timestamp.astimezone(timezone.utc)

    model_config = ConfigDict(
            alias_generator=to_camel,
            populate_by_name=True
            )

class PlacementEntityFeatureCollection(VersionedCollection[PlacementEntityFeature]):
    store_collection_name = 'placement'
    store_item_type = 'placement_entity'
    store_item_class = PlacementEntityFeature

class RoadsFeatureCollection(VersionedCollection[AnyFeature]):
    store_collection_name = 'roads'
    store_item_type = 'feature'
    store_item_class = AnyFeature
