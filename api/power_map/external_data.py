import abc
from functools import cached_property
import re
from pydantic_core import PydanticCustomError
import requests

from typing import Iterable, Optional

from fastkml.kml import KML
from fastkml.containers import Folder
from fastkml.features import Placemark

from shapely.geometry import Point as ShapelyPoint
from sqlalchemy import desc

from common.geometry import Point, LineString, ShapelyBaseGeometry, shape
from power_map.utils import *
from power_map.placement import PlacementEntityFeature, PlacementEntityRevision, PlacementEntityRevisionCollection
from power_map.power_area import PowerArea, PowerAreaFeature, PowerAreaProperties
from power_map.power_grid import PowerGrid, PowerGridFeature
from power_map.power_grid_base import PowerGridItemSize
from power_map.power_grid_cable import PowerGridCableFeature, PowerGridCableProperties
from power_map.power_grid_pdu import PowerGridPDUProperties, PowerGridPDUFeature

def feature_name_desc(feature):
    #return feature.properties.get('Name'), feature.properties.get('description')
    return feature.name, feature.description

def feature_desc(feature) -> str:
    name, desc = feature_name_desc(feature)
    if desc:
        return f'{name} / {desc}'.replace('\n', ' ')
    else:
        return name

def find_containing_area(areas: dict[str, PowerArea], item: ShapelyBaseGeometry | Placemark) -> Optional[PowerArea]:
    area_name = None
    if isinstance(item, Placemark):
        desc = item.description or ''
        geometry = item.geometry
        m = re.search(r'area:(\w+)', desc)
        if m:
            area_name = m.group(1)
            if area_name in areas:
                log.info(f"feature {feature_desc(item)} assigned to area {area_name}")
                return areas[area_name]
            else:
                log.warning(f"feature {feature_desc(item)} assigned area {area_name} does not exist")
    else:
        geometry = item

    if isinstance(geometry, Point):
        for area in areas.values():
            if area.contains(shape(geometry)):
                return area
    elif isinstance(geometry, LineString):
        line_areas: dict[str | None, int] = {}
        for p in geometry.coords:
            for area in areas.values():
                if area.contains(ShapelyPoint(p)):
                    line_areas[area.name] = line_areas.setdefault(area.name, 0) + 1
        if line_areas:
            area_name = max(line_areas.items(), key=lambda it: it[1])[0]
        if area_name:
            return areas[area_name]
    else:
        raise RuntimeError(f"Unexpected geometry type {type(geometry)}")

    return None

class ExternalDataLoader():
    OFFLINE: bool = False

    KML_URL: str
    KML_FILENAME: str

    KML_FOLDERS_AREAS: list[str] = ['areas']
    KML_FOLDERS_GRID: list[str] = []

    GRID_AREAS_TOPLEVEL = []
    GRID_MISC_ITEMS: dict[str, PowerGridItemSize] = {}

    PLACEMENT_ENTITIES_URL: str
    PLACEMENT_ENTITIES_FILENAME: str

    @classmethod
    def is_ignored_area(cls, feature) -> bool:
        return feature.geometry.geom_type != 'Polygon'

    @classmethod
    def is_ignored_grid_feature(cls, feature) -> bool:
        if feature.geometry.geom_type not in ['Point', 'LineString']:
            return True
        if cls.GRID_MISC_ITEMS.get(feature.name, 0) == None:
            return True
        return False

    @classmethod
    def is_ignored_consumer(cls, entity: PlacementEntityFeature) -> bool:
        return not entity.properties.name

    @classmethod
    def is_grid_native(cls, feature) -> bool:
        return bool(re.search(r'native', feature.description or '', re.IGNORECASE))

    @classmethod
    def grid_feature_size(cls, feature) -> PowerGridItemSize:
        name, desc = feature_name_desc(feature)

        size = cls.GRID_MISC_ITEMS.get(name.strip())
        if size:
            return size

        try:
            return PowerGridItemSize.parse_str(name)
        except ValueError:
            try:
                return PowerGridItemSize.parse_str(desc)
            except:
                log.warning(f"can't determine item type: {feature_desc(feature)}")
                return PowerGridItemSize.Unknown

    @cached_property
    def _kml_folders(self) -> dict[str, Folder]:
        if self.OFFLINE:
            if not self.KML_FILENAME:
                raise RuntimeError("KML_FILENAME undefined")
            with open(self.KML_FILENAME, 'rb') as f:
                kml_doc = f.read()
        else:
            if not self.KML_URL:
                raise RuntimeError("KML_URL undefined")
            log.info("Fetching power map")
            kml_doc = requests.get(self.KML_URL).content

        kml = KML.from_string(kml_doc)

        kml_folders = {}
        for folder in kml.features[0].features:
            name = str(folder.name).strip().replace(' ', '_')
            log.debug(f"KML folder {name}")
            kml_folders[name] = folder

        return kml_folders

    def power_area_features(self) -> Iterable[PowerAreaFeature]:
        for folder_name in self.KML_FOLDERS_AREAS:
            folder = self._kml_folders.get(folder_name)
            if not folder:
                raise RuntimeError(f"KML folder '{folder_name}' not found")
            for feature in folder.features:
                if self.is_ignored_area(feature):
                    log.debug(f"ignore feature {feature_desc(feature)}")
                    continue
                area_feature = PowerAreaFeature(
                        type='Feature',
                        geometry=feature.geometry,
                        properties=PowerAreaProperties(
                            name=feature.name.strip(),
                            description=feature.description
                            )
                        )
                log.debug(f"area {area_feature.properties.name}")
                yield area_feature
#                if area.name in self.GRID_AREAS_TOPLEVEL:
#                    areas[area.name] = area
#                else:
#                    misc_areas.append(area)

    def power_grid_features(self) -> Iterable[PowerGridFeature]:
        for folder_name in self.KML_FOLDERS_GRID:
            folder = self._kml_folders.get(folder_name)
            if not folder:
                raise RuntimeError(f"KML folder '{folder_name}' not found")

            for feature in folder.features:
                #log.debug(f'parsing {feature.geometry.geom_type}: {feature_desc(feature)}')
                if self.is_ignored_grid_feature(feature):
                    log.debug(f"ignore feature {feature_desc(feature)}")
                    continue

                name, desc = feature_name_desc(feature)
                if feature.geometry.geom_type == 'Point':
                    yield PowerGridPDUFeature(
                            type='Feature',
                            geometry=feature.geometry.__geo_interface__,
                            properties=PowerGridPDUProperties(
                                type='power_grid_pdu',
                                name=name,
                                description=desc,
                                power_size=self.grid_feature_size(feature),
                                power_native=self.is_grid_native(feature)
                                )
                            )
                elif feature.geometry.geom_type == 'LineString':
                    yield PowerGridCableFeature(
                            type='Feature',
                            geometry=feature.geometry.__geo_interface__,
                            properties=PowerGridCableProperties(
                                type='power_grid_cable',
                                name=name,
                                description=desc,
                                power_size=self.grid_feature_size(feature),
                                power_native=self.is_grid_native(feature),
                                )
                            )
                else:
                    log.warning(f"unexpected feature: {feature_desc(feature)}")

    @classmethod
    def _placement_entities(cls) -> Iterable[PlacementEntityRevision]:
        if cls.OFFLINE or not cls.PLACEMENT_ENTITIES_URL:
            if not cls.PLACEMENT_ENTITIES_FILENAME:
                return []
            with open(cls.PLACEMENT_ENTITIES_FILENAME, 'r') as f:
                data = f.read()
        else:
            data = requests.get(cls.PLACEMENT_ENTITIES_URL).content
        result = PlacementEntityRevisionCollection.validate_json(data)
        log.info(f"Got {len(result)} placement entities")
        return result

    def placement_features(self) -> Iterable[PlacementEntityFeature]:
        for item in self._placement_entities():
            if item.deleted:
                continue
            if not item.geojson.properties:
                raise PydanticCustomError('feature_properties_missing', "Feature is missing properties")
            if self.is_ignored_consumer(item.geojson):
                continue
            item.geojson.id = f"_{item.id}"
            yield item.geojson

    def build(self) -> PowerGrid:
        grid = PowerGrid()
        for f in self.power_area_features():
            grid.add_area_feature(f)

        for f in self.power_grid_features():
            grid.add_grid_feature(f)

        for f in self.placement_features():
            grid.add_placement_feature(f)

        return grid


