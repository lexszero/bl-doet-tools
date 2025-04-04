from datetime import datetime
import logging
from typing import Annotated, Any, Callable, Iterable, Optional

import io
import csv
from cachetools import TTLCache
from cachetools_async import cached
from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse

from common.db_async import get_db_session
from common.geometry import Feature, FeatureCollection, Polygon, Point, LineString, to_geojson_feature_collection
from core.dependencies import get_project
from power_map.power_area import PowerArea, PowerAreaStats, PowerAreaInfo
from power_map.power_consumer import PowerConsumerColoringMode, PowerConsumerPropertiesWithStatsStyled
from power_map.power_grid import PowerGrid, PowerGridData, get_power_grid
from power_map.power_grid_base import PowerGridItemSizeOrder, PowerItemBase
from power_map.power_grid_cable import PowerGridCable, PowerGridCablePropertiesWithStats, PowerGridCablePropertiesWithStatsStyled
from power_map.power_grid_pdu import PowerGridPDU, PowerGridPDUPropertiesWithStats, PowerGridPDUPropertiesWithStatsStyled
from power_map.utils import NameDescriptionModel

router = APIRouter()

def write_csv(f, collection: Iterable[Any], properties_fn: Callable[[Any], list[Any]], columns: Optional[Iterable[str]]):
    writer = csv.writer(f, delimiter=";")
    if columns:
        writer.writerow(columns)
    for item in collection:
        writer.writerow(properties_fn(item))

@cached(TTLCache(maxsize=64, ttl=30))
async def get_power_grid_cached(project_name: str, time_end: Optional[datetime] = None):
    async with await get_db_session() as db:
        project = await get_project(db, project_name)
        return await get_power_grid(db, project, timestamp=time_end)

PowerGridDep = Annotated[PowerGrid, Depends(get_power_grid_cached)]

@router.get("/areas.geojson")
async def get_power_areas_geojson(
        power_grid: PowerGridDep,
        ) -> FeatureCollection[Feature[Polygon, PowerAreaStats]]:
    return to_geojson_feature_collection(
            power_grid.areas_recursive(),
            lambda area: PowerAreaStats.model_validate(area, from_attributes=True)
            )

@router.get("/areas.json")
async def get_power_areas_json(
        power_grid: PowerGridDep,
        ) -> list[PowerAreaInfo]:
    return [PowerAreaInfo.model_validate(
        area,
        from_attributes=True
        ) for area in power_grid.areas_recursive() if area.geometry]

@router.get("/areas.csv")
async def get_power_areas_csv(
        power_grid: PowerGridDep,
        ) -> PlainTextResponse:
    with io.StringIO() as b:
        write_csv(b,
                  power_grid.areas_recursive(),
                  PowerArea.csv_row_properties,
                  PowerArea.CSV_COLUMNS)
        return PlainTextResponse(b.getvalue(), media_type="text/csv")

@router.get("/grid.geojson")
async def get_power_grid_geojson(
        power_grid: PowerGridDep,
        ) -> FeatureCollection[Feature[Point, PowerGridPDUPropertiesWithStats] | Feature[LineString, PowerGridCablePropertiesWithStats]]:
    return to_geojson_feature_collection(
            power_grid.grid_items,
            PowerItemBase.feature_properties,
            )

@router.get("/grid")
async def get_power_grid_full(
        power_grid: PowerGridDep,
        log_level: str = 'WARNING'
        ) -> PowerGridData:
    min_level = logging.getLevelNamesMapping().get(log_level, logging.WARNING)
    return PowerGridData(
            timestamp=power_grid._timestamp,
            log=[x for x in power_grid._log.entries if x.level >= min_level],
            features=to_geojson_feature_collection(
                power_grid.grid_items,
                PowerItemBase.feature_properties,
                ))


@router.get("/grid_styled.geojson")
async def get_power_grid_styled_geojson(
        power_grid: PowerGridDep
        ) -> FeatureCollection[Feature[Point, PowerGridPDUPropertiesWithStatsStyled] | Feature[LineString, PowerGridCablePropertiesWithStatsStyled]]:
    return to_geojson_feature_collection(
            power_grid.grid_items,
            PowerItemBase.feature_properties_styled)

@router.get("/grid_coverage.geojson")
async def get_power_grid_coverage_geojson(
        power_grid: PowerGridDep,
        ) -> FeatureCollection[Feature[Polygon, NameDescriptionModel]]:
    def pdu_coverage_feature(pdu: PowerGridPDU) -> Feature[Polygon, NameDescriptionModel]:
        return Feature(
                type='Feature',
                geometry=pdu.coverage_geometry(),
                properties=NameDescriptionModel(
                    name=pdu.name
                    )
                )

    return FeatureCollection(
            type='FeatureCollection',
            features=list(map(pdu_coverage_feature, power_grid._pdus))
            )

@router.get("/grid_cables.csv")
async def get_power_grid_cables_csv(
        power_grid: PowerGridDep,
        csv_header: bool = False,
        include_native: bool = False) -> PlainTextResponse:
    with io.StringIO() as b:
        write_csv(b,
                  filter(lambda x: include_native or not x.native, power_grid._cables),
                  PowerGridCable.csv_row_properties,
                  csv_header and PowerGridCable.CSV_COLUMNS or None)
        return PlainTextResponse(b.getvalue(), media_type="text/csv")

@router.get("/grid_pdus.csv")
async def get_power_grid_pdus_csv(
        power_grid: PowerGridDep,
        csv_header: bool = False,
        include_native: bool = False) -> PlainTextResponse:
    pdus = {}
    for pdu in power_grid._pdus:
        if pdu.native and not include_native:
            continue
        pdus.setdefault(pdu.size, []).append(pdu)

    columns = list(reversed(PowerGridItemSizeOrder))[1:]
    result = [len(pdus.get(power_size, [])) for power_size in columns]
    with io.StringIO() as b:
        write_csv(b,
                  [result],
                  lambda x: x,
                  csv_header and columns or None)
        return PlainTextResponse(b.getvalue(), media_type="text/csv")


@router.get("/placement_entities.geojson", response_model_exclude_none=True)
async def get_placement_entities_geojson(
        power_grid: PowerGridDep,
        coloring: PowerConsumerColoringMode = PowerConsumerColoringMode.power_need) -> FeatureCollection[Feature[Polygon, PowerConsumerPropertiesWithStatsStyled]]:
    return to_geojson_feature_collection(
            power_grid._consumers,
            lambda consumer: consumer.feature_properties_styled(coloring))
