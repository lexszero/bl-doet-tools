from typing import Any, Callable, Iterable, Optional

import csv
import geojson
import json

from .base import GeoObject, PowerGridItem, PowerGridPDU
from .power_area import PowerArea
from .power_grid import DataLoader


def to_geojson_feature_collection(collection: Iterable[GeoObject], properties_fn: Optional[Callable[[Any], dict[str, Any]]] = None) -> geojson.FeatureCollection:
    return geojson.FeatureCollection([item.to_geojson(properties_fn) for item in collection])

def to_json_array(collection: Iterable[Any], properties_fn: Callable[[Any], dict[str, Any]]) -> list[Any]:
    return [properties_fn(item) for item in collection]

def write_geojson(f, data: geojson.FeatureCollection):
    geojson.dump(data, f, indent=2)

def write_json(f, data: Any):
    json.dump(data, f, indent=2)

def write_csv(f, collection: Iterable[Any], properties_fn: Callable[[Any], list[Any]], columns: list[str]):
    writer = csv.writer(f, delimiter=";")
    writer.writerow(columns)
    for item in collection:
        writer.writerow(properties_fn(item))

def area_json(area: PowerArea) -> dict[str, Any]:
    center = area.shape.centroid.coords[0]
    total_power_kw = area.total_power() / 1000
    return {
            'id': area.name,
            'lon': center[0],
            'lat': center[1],
            'total_power_kw': total_power_kw,
            'total_power_kw_div3': total_power_kw/3,
            'total_power_kw_div6': total_power_kw/6
            }

def area_csv(area: PowerArea) -> list[Any]:
    return [area.name, area.area(), area.total_population(), area.total_power()/1000]

def grid_geojson_full(item: PowerGridItem):
    result = {
            'name': item.name,
            'description': item.description,
            'power_areas': [area.name for area in item.areas if area.name],
            'power_size': item.size.value
            }
    if isinstance(item, PowerGridPDU):
        result['power_consumers_num'] = len(item.consumers)
        result['power_consumers_kw'] = sum([consumer.power_need for consumer in item.consumers])/1000
    return result

def gen_outputs_grid(area: PowerArea, output_dir: str):
    write_geojson(area.areas.values(), output_dir+'/power_areas.geojson')
    write_json(area.areas.values(), output_dir+'/power_areas.json', area_json)
    write_csv(area.areas.values(), output_dir+'/power_areas.csv', area_csv, ['id', 'area', 'population', 'total_power_kw'])
    write_geojson(area.grid_items, output_dir+'/power_grid.geojson', grid_geojson_full)
