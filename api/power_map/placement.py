import abc
from dataclasses import dataclass
import enum
from typing import Annotated, Any, Generic, Optional, Self

from pydantic import BeforeValidator, ConfigDict, Field, TypeAdapter, ValidationInfo, field_validator, model_validator
from pydantic.alias_generators import to_camel
from pydantic_extra_types.color import Color

from common.datetime import datetime_cet
from common.model_utils import ModelT
from common.geometry import Feature, Polygon
from core.store import VersionedCollection
from power_map.power_grid_base import PowerPlugType
from power_map.utils import BaseModel, NameDescriptionModel, log

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

#class PlacementEntityFeature(
#        _PlacementEntityFeature,
#        StorableItem[_PlacementEntityFeature]):
#
#    def to_dto(self) -> _PlacementEntityFeature:
#        return self
#
#    @classmethod
#    def from_dto(cls, data: _PlacementEntityFeature) -> Self:
#        return cls.model_validate(data)

class FeatureRevision(abc.ABC, Generic[ModelT]):
    @property
    @abc.abstractmethod
    def feature(self) -> ModelT:
        pass

class PlacementEntityRevision(BaseModel, FeatureRevision[PlacementEntityFeature]):
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
    def feature(self):
        return self.geojson

    model_config = ConfigDict(
            alias_generator=to_camel,
            populate_by_name=True
            )

PlacementEntityRevisionCollection = TypeAdapter(list[PlacementEntityRevision])

class PlacementEntityFeatureCollection(VersionedCollection[PlacementEntityFeature]):
    store_collection_name = 'placement'
    store_item_type = 'placement_entity'
    store_item_class = PlacementEntityFeature

def transform_placement_scrub_private_data(f: PlacementEntityFeature) -> PlacementEntityFeature:
    props = f.properties
    if props:
        if props.contact_info:
            props.contact_info = "<redacted>"
        if props.tech_contact_info:
            props.tech_contact_info = "<redacted>"

    return f
