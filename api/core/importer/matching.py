import asyncstdlib as A
from math import inf
import re
from typing import AsyncGenerator, ClassVar, Generator, Generic, Iterable, Optional, TypeVar

from geojson_pydantic import Feature
from geojson_pydantic.features import Feat, Geom, Props
from pydantic import BaseModel, PrivateAttr
from shapely import distance, equals, intersection
from shapely.coords import CoordinateSequence
from shapely.geometry import Polygon, LineString, Point, shape
from shapely.geometry.base import BaseGeometry

from common.model_utils import ModelT
from core.importer.base import CollectionImporterBase, ImportContext, log as _log

log = _log.getChild('matching')

class FeatureWithShape(Feature[Geom, Props]):
    _shape: BaseGeometry = PrivateAttr()

FeatWithShape = TypeVar('FeatWithShape', bound=FeatureWithShape)

def with_shapes(features: Iterable[Feature[Geom, Props]]) -> Generator[FeatureWithShape[Geom, Props]]:
    for f in features:
        new: FeatureWithShape[Geom, Props] = f.model_copy()
        if new.geometry:
            new._shape = shape(new.geometry)
        yield new

def count_matching_points(a: CoordinateSequence, b: CoordinateSequence):
    n = 0
    for p1 in map(Point, a):
        for p2 in map(Point, b):
            if equals(p1, p2):
                n += 1
    return n

def count_matching_fields(a: Optional[BaseModel], b: Optional[BaseModel]):
    if not a or not b:
        return 0
    n = 0
    for field_name in a.__class__.model_fields.keys():
        if field_name in b.__class__.model_fields:
            va = getattr(a, field_name)
            vb = getattr(b, field_name)
            if va and vb and va == vb:
                n += 1
    if n > 0:
        log.debug(f"Found {n} matching fields")
    return n

def find_exact_matching_feature(feature: FeatWithShape, features: Iterable[FeatWithShape]):
    for f in features:
        if f.id and feature.id and f.id == feature.id:
            return f

        if equals(f._shape, feature._shape):
            return f
    return None

def find_nearest_feature(feature: FeatWithShape, features: Iterable[FeatWithShape]):
    best = None
    best_distance = inf
    for f in features:
        d = distance(f._shape.centroid, feature._shape.centroid)
        if d < best_distance:
            best_distance = d
            best = f

    return best

def is_geometry_similar(a: FeatWithShape, b: FeatWithShape):
    if isinstance(a._shape, Polygon) and isinstance(b._shape, Polygon):
        #debug(a, b)
        mp = count_matching_points(a._shape.exterior.coords, b._shape.exterior.coords)
        if mp > 0:
            log.debug(f"Similar geometry: Polygons has {mp} matching points")
            return True

        # idk let's try comparing area of each polygon with area of their intersection?
        aa = a._shape.area
        ab = a._shape.area
        ai = intersection(a._shape, b._shape).area
        log.debug(f"Polygon areas {aa=} {ab=} {ai=}")
        result = ai > 0 and abs(aa - ai) < 0.1*aa and abs(ab - ai) < 0.1*ab
        if result:
            log.debug(f"Similar geometry: polygon intersection")
            return True

    elif isinstance(a._shape, LineString) and isinstance(b._shape, LineString):
        mp = count_matching_points(a._shape.coords, b._shape.coords)
        if mp > 0:
            log.debug(f"Similar geometry: LineStrings has {mp} matching points")
            return True

    elif isinstance(a._shape, Point):
        result = equals(a._shape, b._shape)
        if result:
            log.debug(f"Similar geometry: Points are the same")
            return True

    return False

def feature_changed(old: FeatWithShape, new: FeatWithShape):
    return not ((old._shape == new._shape) and (old.properties == new.properties))

class ImporterMatching(CollectionImporterBase[Feat], Generic[Feat]):
    ASYNC: ClassVar[bool] = False

    def get_features(self, ctx: ImportContext) -> Iterable[Feat]:
        raise NotImplemented

    def get_features_async(self, ctx: ImportContext) -> AsyncGenerator[Feat]:
        raise NotImplemented

    @classmethod
    def feature_prop_for_id(cls, f: Feat):
        if hasattr(f.properties, 'fid'):
            return str(f.properties.fid)
        return f.properties.name

    @classmethod
    def feature_generate_id(cls, f: Feat, all_ids: Iterable[str]):
        prefix = re.sub(r'[^a-zA-Z0-9_]', '_', cls.feature_prop_for_id(f)).strip('_ ')
        if not prefix or (prefix and prefix[0].isdigit()):
            prefix = '_' + prefix

        max_n = 0
        for v in all_ids:
            m = re.match(f'^{prefix}_(\\d+)$', v)
            if m:
                n = int(m[1])
                if n > max_n:
                    max_n = n
        return f"{prefix}_{max_n+1}"

    async def do_import(self, ctx: ImportContext):
        collection = await self.get_target_collection(ctx, allow_create=True)
        features_known = list(with_shapes(await A.list(collection.all_last_values())))
        if self.ASYNC:
            features = await A.list(self.get_features_async(ctx))
        else:
            features = self.get_features(ctx)
        features_new = list(with_shapes(features))

        pairs = []
        all_ids = [str(item.id) for item in features_known if item.id]

        def match_pair(known, new):
            pairs.append((known, new))
            features_known.remove(known)
            features_new.remove(new)
            if not new.id:
                if known.id:
                    new.id = known.id
                else:
                    log.warning(f"Existing feature {known.properties.name} doesn't have id (this must never happen)")

        for item in features_new.copy():
            found = find_exact_matching_feature(item, features_known)
            if found:
                log.debug(f"Exact match: {item.properties.name} is {found.id}")
                match_pair(found, item)

        for item in features_new.copy():
            found = find_nearest_feature(item, features_known)
            if not found:
                continue
            if found.properties.name == item.properties.name:
                log.warning(f"Name match: {item.properties.name} is {found.id}")
                if is_geometry_similar(found, item) or count_matching_fields(found.properties, item.properties) > 0:
                    match_pair(found, item)

        for item in features_new:
            if not item.id:
                item.id = self.feature_generate_id(item, all_ids)
                all_ids.append(item.id)

            pairs.append((None, item))

        for item in features_known:
            pairs.append((item, None))

        n_added, n_deleted, n_changed = 0, 0, 0
        for known, new in pairs:
            if not new:
                log.debug(f"Deleted: {known.id}")
                await collection.add(ctx.user, known.id, None)
                n_deleted += 1
            elif not known:
                log.debug(f"Added {new.id} ({new.properties.name})")
                await collection.add(ctx.user, new.id, new)
                n_added += 1
            elif feature_changed(known, new):
                #debug(known, new)
                log.debug(f"Updated {new.id} ({new.properties.name})")
                await collection.add(ctx.user, new.id, new)
                n_changed += 1

        log.info(f"{ctx.project.name}/{self.collection}: {n_added} added, {n_deleted} deleted, {n_changed} changed")


