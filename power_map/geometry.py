from devtools import debug
from functools import cached_property
from typing import Any, Callable, Iterable, Optional, TypeVar, Generic, Union

from geojson_pydantic.features import Feature, FeatureCollection, Geom, Props
from geojson_pydantic import LineString, Point, Polygon
from pydantic import BaseModel, ConfigDict, Field
from pydantic_extra_types.color import Color

import pyproj
from shapely.geometry import (
        shape,
        Point as ShapelyPoint,
        Polygon as ShapelyPolygon,
        LineString as ShapelyLineString
        )
from shapely.geometry.base import BaseGeometry as ShapelyBaseGeometry
from shapely.ops import transform as coord_transform

CRS_WGS84 = pyproj.CRS('EPSG:4326')
CRS_SWEDEN = pyproj.CRS('EPSG:3152')

XFRM_GEO_TO_PROJ = pyproj.Transformer.from_crs(CRS_WGS84, CRS_SWEDEN, always_xy=True).transform
XFRM_PROJ_TO_GEO = pyproj.Transformer.from_crs(CRS_SWEDEN, CRS_WGS84, always_xy=True).transform

ShapelyGeometryT = TypeVar('ShapelyGeometryT', bound=ShapelyBaseGeometry)

class BaseStyle(BaseModel):
    model_config = ConfigDict(
            populate_by_name=True
            )

class PolygonStyle(BaseStyle):
    fill: Optional[Color] = Field(None, validation_alias='color')
    fill_opacity: Optional[float] = Field(None, ge=0, le=1.0, serialization_alias='fill-opacity')
    stroke_width: Optional[int] = Field(None, validation_alias='weight', ge=0, serialization_alias='stroke-width')

class PointStyle(BaseStyle):
    marker_color: Optional[Color] = Field(None, validation_alias='color', serialization_alias='marker-color')
    marker_size: Optional[int] = Field(None, ge=0, validation_alias='weight', serialization_alias='marker-size')

class LineStyle(BaseStyle):
    stroke: Optional[Color] = Field(None, validation_alias='color')
    stroke_width: Optional[int] = Field(None, validation_alias='weight', ge=0, serialization_alias='stroke-width')

StyleT = TypeVar('StyleT', bound=Union[PolygonStyle, PointStyle, LineStyle])


class GeoObject(BaseModel, Generic[Geom, ShapelyGeometryT, StyleT]):
    geometry: Optional[Geom] = Field(None, repr=False)

    model_config = ConfigDict(
        arbitrary_types_allowed=True
        )

    @cached_property
    def shape(self) -> ShapelyGeometryT:
        return shape(self.geometry)

    @cached_property
    def shape_proj(self) -> ShapelyGeometryT:
        return coord_transform(XFRM_GEO_TO_PROJ, self.shape)

    def to_geojson_feature(self, properties_fn: Callable[[Any], Props]) -> Feature[Geom, Props]:
        props = properties_fn(self)
        if self.geometry:
            self.geometry.bbox = None
        return Feature[Geom, Props](
                type='Feature',
                geometry=self.geometry,
                properties=props
                )

def to_geojson_feature_collection(collection: Iterable[GeoObject[Geom, ShapelyGeometryT, StyleT]], properties_fn: Callable[[GeoObject[Geom, ShapelyGeometryT, StyleT]], Props]) -> FeatureCollection[Feature[Geom, Props]]:
    return FeatureCollection(
            type='FeatureCollection',
            features=[item.to_geojson_feature(properties_fn) for item in collection])

GeometryPoint = GeoObject[Point, ShapelyPoint, PointStyle]

class GeometryPolygon(GeoObject[Polygon, ShapelyPolygon, PolygonStyle]):
    @cached_property
    def geometry_center(self) -> ShapelyPoint:
        if not self.geometry:
            return ShapelyPoint(((0, 0)))
        return self.shape.centroid

    @cached_property
    def center_lon(self) -> Optional[float]:
        return self.geometry and self.geometry_center.coords[0][0]

    @cached_property
    def center_lat(self) -> Optional[float]:
        return self.geometry and self.geometry_center.coords[0][1]

    @cached_property
    def area(self) -> float:
        if not self.geometry:
            return 0
        return coord_transform(XFRM_GEO_TO_PROJ, self.shape).area

    def contains(self, other: ShapelyBaseGeometry) -> bool:
        if not self.geometry:
            return False
        return self.shape.contains(other)

class GeometryLineString(GeoObject[LineString, ShapelyLineString, LineStyle]):
    @cached_property
    def length(self) -> float:
        return self.shape_proj.length

Geometry = TypeVar('Geometry', bound=Union[GeometryPolygon, GeometryPoint, GeometryLineString])
