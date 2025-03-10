from typing import Annotated, Any, Callable, Iterable, Literal

import io
import csv
from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse

from power_map.data import ProjectData, get_project_data
from power_map.geometry import Feature, FeatureCollection, Polygon, Point, LineString, to_geojson_feature_collection
from power_map.power_area import PowerArea, PowerAreaStats, PowerAreaInfo
from power_map.power_consumer import PowerConsumer, PowerConsumerPropertiesWithStats, PowerConsumerPropertiesWithStatsStyled
from power_map.power_grid_base import PowerGridItem, PowerItem
from power_map.power_grid_cable import PowerGridCablePropertiesWithStats, PowerGridCablePropertiesWithStatsStyled
from power_map.power_grid_pdu import PowerGridPDUPropertiesWithStats, PowerGridPDUPropertiesWithStatsStyled

power_map_api = APIRouter()

@power_map_api.get("/ping")
async def ping():
    return {
            "result": "pong"
            }

async def get_project_by_id(project_id: str) -> ProjectData:
    return get_project_data(project_id)

ProjectDep = Annotated[ProjectData, Depends(get_project_by_id)]

def write_csv(f, collection: Iterable[Any], properties_fn: Callable[[Any], list[Any]], columns: list[str]):
    writer = csv.writer(f, delimiter=";")
    writer.writerow(columns)
    for item in collection:
        writer.writerow(properties_fn(item))

@power_map_api.get("/{project_id}/power_areas.geojson")
async def get_power_areas_geojson(project: ProjectDep) -> FeatureCollection[Feature[Polygon, PowerAreaStats]]:
    return to_geojson_feature_collection(
            project.power_grid.areas_recursive(),
            lambda area: PowerAreaStats.model_validate(area, from_attributes=True)
            )

@power_map_api.get("/{project_id}/power_areas.json")
async def get_power_areas_json(project: ProjectDep) -> list[PowerAreaInfo]:
    return [PowerAreaInfo.model_validate(
        area,
        from_attributes=True
        ) for area in project.power_grid.areas_recursive()]

@power_map_api.get("/{project_id}/power_areas.csv")
async def get_power_areas_csv(project: ProjectDep) -> PlainTextResponse:
    with io.StringIO() as b:
        write_csv(b,
                  project.power_grid.areas_recursive(),
                  PowerArea.csv_row_properties,
                  PowerArea.CSV_COLUMNS)
        return PlainTextResponse(b.getvalue(), media_type="text/csv")

@power_map_api.get("/{project_id}/power_grid.geojson")
async def get_power_grid_geojson(project: ProjectDep) -> FeatureCollection[Feature[Point, PowerGridPDUPropertiesWithStats] | Feature[LineString, PowerGridCablePropertiesWithStats]]:
    return to_geojson_feature_collection(
            project.power_grid.grid_items,
            PowerGridItem.feature_properties,
            )

def style_grid_item(item: PowerItem):
    r = item._PropertiesStyledModel.model_validate(item, from_attributes=True)
    return r

@power_map_api.get("/{project_id}/power_grid_styled.geojson")
async def get_power_grid_styled_geojson(project: ProjectDep) -> FeatureCollection[Feature[Point, PowerGridPDUPropertiesWithStatsStyled] | Feature[LineString, PowerGridCablePropertiesWithStatsStyled]]:
    return to_geojson_feature_collection(
            project.power_grid.grid_items,
            PowerGridItem.feature_properties_styled)

@power_map_api.get("/{project_id}/placement_entities.geojson", response_model_exclude_none=True)
async def get_placement_entities_geojson(project: ProjectDep, coloring: PowerConsumer.ColoringMode = 'power_need') -> FeatureCollection[Feature[Polygon, PowerConsumerPropertiesWithStatsStyled]]:
    return to_geojson_feature_collection(
            project.power_grid._consumers,
            lambda consumer: consumer.feature_properties_styled(coloring))
