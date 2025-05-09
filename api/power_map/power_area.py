from functools import cached_property
from typing import Any, ClassVar, Iterable, Self
from geojson_pydantic import Feature, Polygon
from pydantic import Field, PrivateAttr, computed_field

from common.geometry import GeometryPolygon, ShapelyPoint
from common.types import NameDescriptionModel
from core.store import VersionedCollection
from power_map.log import log
from power_map.power_grid_cable import PowerGridCable
from power_map.power_grid_pdu import PowerGridPDU
from power_map.power_consumer import PowerConsumer

class PowerAreaProperties(NameDescriptionModel):
    pass

PowerAreaFeature = Feature[Polygon, PowerAreaProperties]

class PowerAreaStats(PowerAreaProperties):
    population: int
    total_power: float
    area: float

class PowerAreaStatsHuman(PowerAreaStats):
    total_power: float = Field(exclude=True)

    @computed_field
    def total_power_kw(self) -> float:
        return int(self.total_power / 1000.0)

    @computed_field
    def total_power_kw_div3(self) -> float:
        return int(self.total_power / 1000.0)

    @computed_field
    def total_power_kw_div6(self) -> float:
        return int(self.total_power / 1000.0 / 3)

class PowerAreaInfo(PowerAreaStats):
    id: str = Field(alias='name')
    center_lon: float = 0.0
    center_lat: float = 0.0

class PowerArea(
        GeometryPolygon,
        PowerAreaProperties,
        ):
    _store_item_type = 'power_area'

    _areas: dict[str, 'PowerArea'] = PrivateAttr(default_factory=dict)
    _pdus: list[PowerGridPDU] = PrivateAttr(default_factory=list)
    _cables: list[PowerGridCable] = PrivateAttr(default_factory=list)
    _consumers: list[PowerConsumer] = PrivateAttr(default_factory=list)

    nest_level: int = 0

    @classmethod
    def from_feature(cls, data: PowerAreaFeature) -> Self:
        if not data.properties:
            raise ValueError(f"Power area feature {data} is missing properties")
        return cls(id=data.id, geometry=data.geometry, **data.properties.model_dump())

    @computed_field
    @cached_property
    def population(self) -> int:
        return sum([item.nr_of_people or 0 for item in self._consumers])

    @computed_field
    @cached_property
    def total_power(self) -> float:
        return sum([item.power_need or 0 for item in self._consumers])

    def areas_recursive(self: Self, skip_empty_geometry=False) -> Iterable['PowerArea']:
        if (not skip_empty_geometry) or self.geometry:
            yield self
        for area in self._areas.values():
            for it in area.areas_recursive(skip_empty_geometry):
                yield it

    @property
    def grid_items(self) -> Iterable[PowerGridPDU | PowerGridCable]:
        for item in self._pdus:
            yield item
        for item in self._cables:
            yield item

    def add_item(self, item: PowerGridPDU | PowerGridCable | PowerConsumer, debug=False):
        item._areas.append(self)
        sub_area_found = False
        if isinstance(item, PowerGridPDU):
            if debug:
                log.debug(f"{self.name}: PDU: [{item.size}] {item}")
            self._pdus.append(item)
            for sub_area in self._areas.values():
                if sub_area.contains(item.shape):
                    sub_area.add_item(item, debug=False)
                    sub_area_found = True
        elif isinstance(item, PowerGridCable):
            if debug:
                log.debug(f"{self.name}: Cable: [{item.size}] {item}")
            self._cables.append(item)
            cable_areas = []
            for p in item.shape.coords:
                for sub_area in self._areas.values():
                    if sub_area.contains(ShapelyPoint(p)) and sub_area.name not in cable_areas:
                        sub_area.add_item(item, debug=False)
                        sub_area_found = True
                        cable_areas.append(sub_area.name)
        elif isinstance(item, PowerConsumer):
            if debug:
                log.debug(f"{self.name}: Consumer: {item}")
            if not item._up_to_date:
                item.find_pdus(self._pdus)
            self._consumers.append(item)
            for sub_area in self._areas.values():
                if sub_area.contains(item.shape.centroid):
                    sub_area.add_item(item, debug=False)
                    sub_area_found = True

        if self._areas and not sub_area_found:
            #log.warning(f"{self.name}: Can't find sub-area for {item}")
            misc_name = f"{self.name}-misc"
            if misc_name not in self._areas:
                self._areas[misc_name] = PowerArea(id=misc_name, name=misc_name, geometry=None)
            self._areas[misc_name].add_item(item)

    def print(self, dump_grid=False, level=0):
        if level == 0:
            log.info("Area            | PDUs  | Cables| Users |")
        indent = '  '*level
        prefix_name = f"{indent}{self.name}"
        log.info(f"{prefix_name:15} | {len(self._pdus):5} | {len(self._cables):5} | {len(self._consumers):5}")
        if self._areas:
            for area in self._areas.values():
                area.print(level=level+1)
        else:
            if dump_grid:
                for item in self._pdus:
                    log.info(f"{indent:15} | PDU {item}")

    CSV_COLUMNS: ClassVar = ['name', 'area', 'population', 'total_power_kw']
    def csv_row_properties(self) -> list[Any]:
        return [
                self.name,
                self.area,
                self.population,
                self.total_power
                ]

    def __repr__(self) -> str:
        return f"<PowerArea {self.name}>"

class PowerAreaFeatureCollection(VersionedCollection[PowerAreaFeature]):
    store_collection_name = 'power_areas'
    store_item_type = 'power_area'
    store_item_class = PowerAreaFeature

#    def geojson_grid_coverage(self):
#        result = []
#        for pdu in self.pdus:
#            poly = coord_transform(
#                    XFRM_PROJ_TO_GEO,
#                    coord_transform(XFRM_GEO_TO_PROJ, pdu.geometry).buffer(50, quad_segs=8))
#            result.append(geojson.Feature(
#                geometry=poly,
#                properties={
#                    'name': pdu.name
#                    }))
#        return geojson.FeatureCollection(result)

PowerGridPDU.model_rebuild()
PowerGridCable.model_rebuild()
