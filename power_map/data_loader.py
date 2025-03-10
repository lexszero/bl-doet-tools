from dataclasses import field
import json
import re
from pydantic_core import PydanticCustomError
import requests

from typing import Any, Optional

from fastkml.kml import KML
from fastkml.features import Placemark

from shapely.geometry import Point as ShapelyPoint

from power_map.power_consumer import PowerConsumer
from power_map.power_grid_base import PowerGridItemSize
from power_map.power_grid_cable import PowerGridCable
from power_map.power_grid_pdu import PowerGridPDU

from power_map.geometry import Point, LineString, ShapelyBaseGeometry, shape
from power_map.utils import *
from power_map.placement import PlacementEntityFeature
from power_map.power_area import PowerArea

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
        return areas[area_name]

    return None

def print_areas(areas: dict[str, PowerArea], level=1):
    for area in areas.values():
        log.info('  '*level + f"{area.name}")
        print_areas(area.areas, level=level+1)

class DataLoader:
    KML_URL: str
    KML_FILENAME: str

    KML_FOLDERS_AREAS: list[str] = ['areas']
    KML_FOLDERS_GRID: list[str] = []

    GRID_AREAS_TOPLEVEL = []
    GRID_MISC_ITEMS: dict[str, PowerGridItemSize] = {}

    PLACEMENT_ENTITIES_URL: str
    PLACEMENT_ENTITIES_FILENAME: str

    kml_folders: dict[str, Any] = field(default_factory=dict)
    data: PowerArea

    def __init__(self, offline: bool = True):
        self.data = PowerArea(name="<TopLevel>", geometry=None)
        self.loaded_grid = False
        self.loaded_consumers = False

        log.info("Reloading grid & placement data")
        self.load_grid(offline)
        self.load_consumers(offline)

    @classmethod
    def is_ignored_area(cls, feature) -> bool:
        return feature.geometry.geom_type != 'Polygon'

    @classmethod
    def is_ignored_grid_feature(cls, feature) -> bool:
        return feature.geometry.geom_type not in ['Point', 'LineString']

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

    def load_grid(self, offline: bool = False):
        if offline:
            if not self.KML_FILENAME:
                raise RuntimeError("KML_FILENAME undefined")
            with open(self.KML_FILENAME, 'rb') as f:
                kml_doc = f.read()
        else:
            if not self.KML_URL:
                raise RuntimeError("KML_URL undefined")
            log.info("Fetching power map")
            kml_doc = requests.get(self.KML_URL).content

        kml = KML().from_string(kml_doc)

        self.kml_folders = {}
        for folder in kml.features[0].features:
            name = str(folder.name).strip().replace(' ', '_')
            log.debug(f"KML folder {name}")
            self.kml_folders[name] = folder

        self.data._areas = {}
        misc_areas = []
        for folder_name in self.KML_FOLDERS_AREAS:
            folder = self.kml_folders.get(folder_name)
            if not folder:
                raise RuntimeError(f"KML folder '{folder_name}' not found")
            for feature in folder.features:
                if self.is_ignored_area(feature):
                    log.debug(f"ignore feature {feature_desc(feature)}")
                    continue
                area = PowerArea(
                        name=feature.name.strip(),
                        geometry=feature.geometry.__geo_interface__,
                        description=feature.description
                        )
                log.debug(f"area {area.name}")
                if area.name in self.GRID_AREAS_TOPLEVEL:
                    self.data._areas[area.name] = area
                else:
                    misc_areas.append(area)

        for area in misc_areas:
            parent = find_containing_area(self.data._areas, area.shape.centroid)
            if parent:
                parent._areas[area.name] = area
                area.nest_level = parent.nest_level+1
            else:
                log.error(f"Unable to find parent area for {area.name}, assigning to toplevel")
                self.data._areas[area.name] = area


        for folder_name in self.KML_FOLDERS_GRID:
            folder = self.kml_folders.get(folder_name)
            if not folder:
                raise RuntimeError(f"KML folder '{folder_name}' not found")

            for feature in folder.features:
                #log.debug(f'parsing {feature.geometry.geom_type}: {feature_desc(feature)}')
                if self.is_ignored_grid_feature(feature):
                    log.debug(f"ignore feature {feature_desc(feature)}")
                    continue

                name, desc = feature_name_desc(feature)
                if feature.geometry.geom_type == 'Point':
                    self.data.add_item(
                            PowerGridPDU(
                                name=name,
                                description=desc,
                                geometry=feature.geometry.__geo_interface__,
                                power_size=self.grid_feature_size(feature),
                                power_native=self.is_grid_native(feature)
                                ))
                elif feature.geometry.geom_type == 'LineString':
                    self.data.add_item(
                            PowerGridCable(
                                name=name,
                                description=desc,
                                geometry=feature.geometry.__geo_interface__,
                                power_size=self.grid_feature_size(feature),
                                power_native=self.is_grid_native(feature),
                            ))
                else:
                    log.warning(f"unexpected feature: {feature_desc(feature)}")

        self.loaded_grid = True

    def load_consumers(self, offline: bool = False):
        j = None
        if offline:
            if not self.PLACEMENT_ENTITIES_FILENAME:
                return
            with open(self.PLACEMENT_ENTITIES_FILENAME, 'r') as f:
                j = json.load(f)
        else:
            j = requests.get(self.PLACEMENT_ENTITIES_URL).json()
            log.info(f"Fetched {len(j)} entities")

        for item in j:
            if item['isDeleted']:
                continue
            feature = PlacementEntityFeature.model_validate_json(item['geoJson'])
            if not feature.properties:
                raise PydanticCustomError('feature_properties_missing', "Feature is missing properties")
            if self.is_ignored_consumer(feature):
                continue
            consumer = PowerConsumer(
                    geometry=feature.geometry,
                    **feature.properties.model_dump())
            self.data.add_item(consumer)

        self.loaded_consumers = True


