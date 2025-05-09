from datetime import datetime, timezone
import re
from typing import Iterable, Literal

from pydantic import Field, ValidationError
from pydantic_core import PydanticCustomError

from common.datetime import timezone_cet
from core.importer.base import ItemRevisionProtocol, ImportContext, ImporterIncremental, LoadFromUrlOrFile, log as _log
from core.importer.matching import ImporterMatching
from placement.types import PlacementEntityFeature, PlacementEntityProperties, PlacementEntityRevision
from power_map.importer import PowerMapKML

log = _log.getChild('placement')

class PlacementLoader(LoadFromUrlOrFile):
    type: Literal['placement'] = 'placement'
    ignored_names: list[str] = Field(default_factory=list)

    def is_ignored(self, feature: PlacementEntityFeature):
        return (
                not feature.properties or
                not feature.properties.name or
                feature.properties.name in self.ignored_names
                )

    def _get_revisions(self, path: str = "", params: dict[str, str] = {}) -> Iterable[PlacementEntityRevision]:
        for item in self.load_json(path, params):
            try:
                yield PlacementEntityRevision.model_validate(item)
            except ValidationError as e:
                log.warning(f"Validation failed", exc_info=e)

    def get_features(self):
        revs = list(self._get_revisions())
        log.info(f"Got total {len(revs)} placement entities")
        for item in revs:
            if item.deleted:
                continue
            if not item.geojson.properties:
                raise PydanticCustomError('feature_properties_missing', "Feature is missing properties")
            if self.is_ignored(item.feature):
                continue
            item.geojson.id = f"_{item.id}"
            yield item.geojson

    def get_revisions(self, time_start: datetime) -> Iterable[PlacementEntityRevision]:
        if self.offline:
            raise RuntimeError("PlacementLoader: Incremental placement import only possible from live API")
        if not self.url:
            raise RuntimeError("PlacementLoader: URL required")

        req_time_start = time_start.replace(tzinfo=timezone.utc).astimezone(timezone_cet)
        log.debug(f"Request new revisions since {time_start} / {req_time_start}")
        revs = list(self._get_revisions("/raw", {'startTime': req_time_start.replace(tzinfo=None).isoformat()}))
        log.info(f"Got {len(revs)} new entity revisions since {time_start}")
        return revs


class Importer_PlacementFull(ImporterMatching[PlacementEntityFeature]):
    type: Literal['placement_full'] = 'placement_full'
    collection: str = 'placement'

    def get_features(self, ctx: ImportContext) -> Iterable[PlacementEntityFeature]:
        if not isinstance(ctx.loader, PlacementLoader):
            raise RuntimeError("Loader is not PlacementLoader")
        loader: PlacementLoader = ctx.loader
        return loader.get_features()

class Importer_PlacementIncremental(ImporterIncremental[PlacementEntityFeature]):
    type: Literal['placement_incremental'] = 'placement_incremental'
    collection: str = 'placement'

    def get_revisions(self, ctx: ImportContext, time_start: datetime) -> Iterable[ItemRevisionProtocol[PlacementEntityFeature]]:
        if not isinstance(ctx.loader, PlacementLoader):
            raise RuntimeError("Loader is not PlacementLoader")
        loader: PlacementLoader = ctx.loader
        return loader.get_revisions(time_start)

class Importer_PlacementKML(ImporterMatching):
    type: Literal['placement_kml'] = 'placement_kml'
    collection: str = 'placement'

    def get_features(self, ctx: ImportContext) -> Iterable[PlacementEntityFeature]:
        if not isinstance(ctx.loader, PowerMapKML):
            raise RuntimeError("Loader is not PowerMapKML")
        idx = 1000
        for item in ctx.loader.folders['Placement'].features:
            m = re.search(r'id=(\d+)', item.description or "")
            if m:
                item_id = m[1]
            else:
                log.warning(f"placement entity {item.name} is missing id, assigning autogenerated")
                item_id = f"_{idx}"
                idx += 1

            m = re.search(r'powerNeed=(\d+)', item.description or "")
            if m:
                power_need=int(m[1])
            else:
                power_need=-1
            yield PlacementEntityFeature(
                    type='Feature',
                    id=item_id,
                    geometry=item.geometry.__geo_interface__,
                    properties=PlacementEntityProperties.model_validate({
                        'name': item.name,
                        'powerNeed': power_need
                        })
                    )

