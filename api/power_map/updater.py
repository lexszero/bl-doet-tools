from dataclasses import dataclass
import re
from math import inf
from typing import Any, Optional
import asyncstdlib as A

from pydantic import BaseModel
from shapely import LineString, Point, Polygon, distance, equals, equals_exact, intersection
from shapely.geometry import shape
from sqlalchemy.ext.asyncio import AsyncSession

from common.db_async import get_db_session
from common.log import Log
from core.dependencies import get_project
from core.project import Project
from core.store import VersionedCollection
from core.user import User, get_user
from power_map.loader import Loader
from power_map.placement import PlacementEntityFeatureCollection
from power_map.power_area import PowerAreaFeatureCollection
from power_map.power_grid import PowerGridFeatureCollection

log = Log.getChild('updater')

def with_shapes(items):
    result = []
    for it in items:
        new = it.copy()
        new._shape = shape(it.geometry)
        result.append(new)
    return result

def find_exact_matching_feature(feature, features):
    for f in features:
        if f.id and feature.id and f.id == feature.id:
            return f

        if equals(f._shape, feature._shape):
            return f

    return None

def find_closest_feature(feature, features):
    best = None
    best_distance = inf
    for f in features:
        d = distance(f._shape.centroid, feature._shape.centroid)
        if d < best_distance:
            best_distance = d
            best = f

    return best

def matching_points(a, b):
    n = 0
    for p1 in map(Point, a):
        for p2 in map(Point, b):
            if equals(p1, p2):
                n += 1
    return n

def is_geometry_similar(a, b):
    if isinstance(a._shape, Polygon):
        #debug(a, b)
        mp = matching_points(a._shape.exterior.coords, b._shape.exterior.coords)
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

    elif isinstance(a._shape, LineString):
        mp = matching_points(a._shape.coords, b._shape.coords)
        if mp > 0:
            log.debug(f"Similar geometry: LineStrings has {mp} matching points")
            return True

    elif isinstance(a._shape, Point):
        result = equals(a._shape, b._shape)
        if result:
            log.debug(f"Similar geometry: Points are the same")
            return True

    return False

def matching_fields(a: Optional[BaseModel], b: Optional[BaseModel]):
    if not a or not b:
        return 0
    n = 0
    for field_name in a.model_fields.keys():
        if field_name in b.model_fields:
            va = getattr(a, field_name)
            vb = getattr(b, field_name)
            if va and vb and va == vb:
                n += 1
    if n > 0:
        log.debug(f"Found {n} matching fields")
    return n

def feature_changed(old, new):
    return not ((old._shape == new._shape) and (old.properties == new.properties))

def make_new_id(all_ids: list[str], s: str):
    prefix = re.sub(r'[^a-zA-Z0-9_]', '_', s).strip('_ ')
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

@dataclass
class UpdateContext:
    db: AsyncSession
    user: User
    project: Project
    loader: Loader

    async def _update_collection_with_features(self, collection: VersionedCollection, features: list[Any]):
        features_known = with_shapes(await A.list(collection.all_last_values(self.db)))
        features_new = with_shapes(features)

        pairs = []
        all_ids = [item.id for item in features_known if item.id]

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
            found = find_closest_feature(item, features_known)
            if not found:
                continue
            if found.properties.name == item.properties.name:
                log.warning(f"Name match: {item.properties.name} is {found.id}")
                if is_geometry_similar(found, item) or matching_fields(found.properties, item.properties) > 0:
                    match_pair(found, item)

        for item in features_new:
            if not item.id:
                item.id = make_new_id(all_ids, item.properties.name)
                all_ids.append(item.id)

            pairs.append((None, item))

        for item in features_known:
            pairs.append((item, None))

        for known, new in pairs:
            if not new:
                log.debug(f"Deleted: {known.id}")
                await collection.add(self.db, self.user, known.id, None)
            elif not known:
                log.debug(f"Added {new.id} ({new.properties.name})")
                await collection.add(self.db, self.user, new.id, new)
            elif feature_changed(known, new):
                #debug(known, new)
                log.debug(f"Updated {new.id} ({new.properties.name})")
                await collection.add(self.db, self.user, new.id, new)


    async def update_areas(self):
        await self._update_collection_with_features(
                await PowerAreaFeatureCollection.bind(self.db, self.project, allow_create=True),
                list(self.loader.power_area_features())
                )

    async def update_grid(self):
        await self._update_collection_with_features(
                await PowerGridFeatureCollection.bind(self.db, self.project, allow_create=True),
                list(self.loader.power_grid_features())
                )

    async def update_placement(self):
        await self._update_collection_with_features(
                await PlacementEntityFeatureCollection.bind(self.db, self.project, allow_create=True),
                list(self.loader.placement_features())
                )

    async def update_all(self):
        try:
            await self.update_areas()
        except Exception as e:
            log.error(e)

        try:
            await self.update_grid()
        except Exception as e:
            log.error(e)

        try:
            await self.update_placement()
        except Exception as e:
            log.error(e)

class Updater:
    _user_name: str
    _project_name: str
    _loader: type[Loader]

    def __init__(self, user_name: str, project_name: str, loader: type[Loader]):
        self._user_name = user_name
        self._project_name = project_name
        self._loader = loader

    async def run(self, db: Optional[AsyncSession] = None, commit: bool = True):
        if not db:
            db = await get_db_session()
        async with db:
            ctx = UpdateContext(
                    db,
                    user=await get_user(db, self._user_name),
                    project=await get_project(db, self._project_name),
                    loader=self._loader()
                    )
            await ctx.update_all()
            if commit:
                await db.commit()
            else:
                await db.rollback()
