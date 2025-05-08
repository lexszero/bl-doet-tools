from dataclasses import dataclass
from functools import cached_property
from typing import Iterable, Literal, Optional
import re
import warnings

with warnings.catch_warnings():
    warnings.simplefilter('ignore')
    from fastkml.kml import KML
    from fastkml.containers import Folder

from pydantic import Field

from common.errors import NotFoundError
from core.importer.base import ImportContext, LoadFromUrlOrFile, log as _log
from core.importer.matching import ImporterMatching
from power_map.power_area import PowerAreaFeature, PowerAreaProperties
from power_map.power_grid import PowerGrid, PowerGridFeature, PowerGridProcessedFeature
from power_map.power_grid_base import PowerGridItemSize, PowerItemBase
from power_map.power_grid_pdu import PowerGridPDUFeature, PowerGridPDUProperties
from power_map.power_grid_cable import PowerGridCableFeature, PowerGridCableProperties

log = _log.getChild('power_map')

def feature_name_desc(feature):
    #return feature.properties.get('Name'), feature.properties.get('description')
    return feature.name, feature.description

def feature_desc(feature) -> str:
    name, desc = feature_name_desc(feature)
    if desc:
        return f'{name} / {desc}'.replace('\n', ' ')
    else:
        return name

class PowerMapKML(LoadFromUrlOrFile):
    type: Literal['power_map'] = 'power_map'

    @cached_property
    def folders(self) -> dict[str, Folder]:
        kml_doc = self.load().decode()
        kml = KML.from_string(kml_doc)

        kml_folders = {}
        for folder in kml.features[0].features:
            name = str(folder.name).strip().replace(' ', '_')
            log.debug(f"KML folder {name}")
            kml_folders[name] = folder

        return kml_folders

@dataclass
class Override:
    ignore: bool = False
    size: Optional[PowerGridItemSize] = None
    native: Optional[bool] = None
    power_source: Optional[bool] = None

class Importer_PowerGridRaw(ImporterMatching):
    type: Literal['power_grid'] = 'power_grid'
    collection: str = 'power_grid_raw'

    folders: list[str]
    override: dict[str, Override] = Field(default_factory=dict)

    def get_override(self, feature):
        result = self.override.get(feature.name.strip())
        if not result:
            return Override()
        return result;

    def is_ignored(self, feature) -> bool:
        if feature.geometry.geom_type not in ['Point', 'LineString']:
            return True

        return self.get_override(feature).ignore

    def is_native(self, feature) -> bool:
        override = self.get_override(feature).native
        if override is None:
            return bool(re.search(r'native', feature.description or '', re.IGNORECASE))
        else:
            return override

    def is_power_source(self, feature) -> bool:
        override = self.get_override(feature).power_source
        if override is None:
            return bool(re.search(r'power_source', feature.description or '', re.IGNORECASE))
        else:
            return override

    def grid_feature_size(self, feature) -> PowerGridItemSize:
        override = self.get_override(feature).size
        if override:
            return override

        name, desc = feature_name_desc(feature)
        try:
            return PowerGridItemSize.parse_str(name)
        except ValueError:
            try:
                return PowerGridItemSize.parse_str(desc)
            except:
                log.warning(f"can't determine item type: {feature_desc(feature)}")
                return PowerGridItemSize.Unknown

    def get_features(self, ctx: ImportContext) -> Iterable[PowerGridFeature]:
        log.info(self.override)
        if not isinstance(ctx.loader, PowerMapKML):
            raise RuntimeError("Loader is not PowerMapKML")
        kml: PowerMapKML = ctx.loader
        for folder_name in self.folders:
            folder = kml.folders.get(folder_name)
            if not folder:
                raise RuntimeError(f"KML folder '{folder_name}' not found")

            for feature in folder.features:
                #log.debug(f'parsing {feature.geometry.geom_type}: {feature_desc(feature)}')
                if self.is_ignored(feature):
                    log.debug(f"ignore feature {feature_desc(feature)}")
                    continue

                name, desc = feature_name_desc(feature)
                if not name:
                    log.warning("feature doesn't have a name")
                    continue

                if feature.geometry.geom_type == 'Point':
                    yield PowerGridPDUFeature(
                            type='Feature',
                            geometry=feature.geometry.__geo_interface__,
                            properties=PowerGridPDUProperties(
                                type='power_grid_pdu',
                                name=name,
                                description=desc,
                                power_size=self.grid_feature_size(feature),
                                power_native=self.is_native(feature),
                                power_source=self.is_power_source(feature)
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
                                power_native=self.is_native(feature),
                                )
                            )
                else:
                    log.warning(f"unexpected feature: {feature_desc(feature)}")

class Importer_PowerGridProcessed(ImporterMatching[PowerGridProcessedFeature]):
    ASYNC = True

    type: Literal['power_grid_processed'] = 'power_grid_processed'
    source: str = 'power_grid_raw'
    collection: str = 'power_grid_processed'

    async def get_features_async(self, ctx: ImportContext):
        try:
            c_src = await ctx.project.get_versioned_collection(
                    self.source,
                    allow_create=False)
        except:
            raise NotFoundError(f"Source collection {self.source} not found, nothing to do")

        grid = PowerGrid()
        grid.add_grid_features([f async for f in c_src.all_last_values()])
        for f in grid.grid_items:
            yield f.to_geojson_feature(PowerItemBase.feature_properties)

class Importer_PowerAreas(ImporterMatching[PowerAreaFeature]):
    type: Literal['power_areas'] = 'power_areas'
    collection: str = 'power_areas'

    folders: list[str]
    ignore: list[str] = Field(default_factory=list)
    toplevel: list[str] = Field(default_factory=list)

    def is_ignored(self, feature) -> bool:
        if feature.geometry.geom_type != 'Polygon':
            return True

        return feature.name in self.ignore

    def get_features(self, ctx: ImportContext) -> Iterable[PowerAreaFeature]:
        if not isinstance(ctx.loader, PowerMapKML):
            raise RuntimeError("Loader is not PowerMapKML")
        kml: PowerMapKML = ctx.loader
        for folder_name in self.folders:
            folder = kml.folders.get(folder_name)
            if not folder:
                raise RuntimeError(f"KML folder '{folder_name}' not found")
            for feature in folder.features:
                name = feature.name
                if not name:
                    log.warning("feature doesn't have a name")
                    continue
                name = name.strip()
                if self.is_ignored(feature):
                    log.debug(f"ignore feature {feature_desc(feature)}")
                    continue
                area_feature = PowerAreaFeature(
                        type='Feature',
                        geometry=feature.geometry,
                        properties=PowerAreaProperties(
                            name=name,
                            description=feature.description
                            )
                        )
                log.debug(f"area {area_feature.properties.name}")
                yield area_feature

PowerSource_250A = Override(
        size=PowerGridItemSize.ThreePhase_250A,
        power_source=True
        )

PowerSource_125A = Override(
        size=PowerGridItemSize.ThreePhase_125A,
        power_source=True
        )

PowerSource_63A = Override(
        size=PowerGridItemSize.ThreePhase_63A,
        power_source=True
        )
