from datetime import datetime
from typing import Optional
from devtools import debug
from pydantic import RootModel, TypeAdapter

from common.db_async import DBSessionDep
from core.store import VersionedCollection
from power_map.placement import PlacementEntityFeature, PlacementEntityFeatureCollection
from power_map.power_area import PowerArea, PowerAreaFeature, PowerAreaFeatureCollection
from power_map.power_consumer import PowerConsumer
from power_map.power_grid_cable import PowerGridCable, PowerGridCableFeature
from power_map.power_grid_pdu import PowerGridPDU, PowerGridPDUFeature
from power_map.utils import log

PowerGridItem = PowerGridCable | PowerGridPDU
PowerGridFeature = PowerGridCableFeature | PowerGridPDUFeature

PowerGridSnapshot = list[PowerGridFeature]

PowerGridFeatureModel = RootModel[PowerGridFeature]

class PowerGridFeatureCollection(VersionedCollection[PowerGridFeature]):
    store_collection_name = 'power_grid'
    store_item_type = 'power_grid_item'
    store_item_class = TypeAdapter(PowerGridFeature)

class PowerGridSnapshotCollection(VersionedCollection[PowerGridSnapshot]):
    store_collection_name = 'power_grid_full'
    store_item_type = 'power_grid_snapshot'
    store_item_class = TypeAdapter(PowerGridSnapshot)



class PowerGrid(PowerArea):
    def __init__(self):
        super().__init__(id="<TopLevel>", name="<TopLevel>", geometry=None)

    def add_area_feature(self, f: PowerAreaFeature) -> PowerArea:
        area = PowerArea.from_feature(f)
        if area.id in self._areas:
            raise ValueError(f"Duplicate area {area.name}")
        self._areas[area.id] = area
        return area

    def add_grid_feature(self, f: PowerGridFeature):
        if isinstance(f, PowerGridCableFeature):
            item = PowerGridCable.from_feature(f)
        elif isinstance(f, PowerGridPDUFeature):
            item = PowerGridPDU.from_feature(f)
        else:
            raise RuntimeError(f"Unexpected PowerGridFeature: {feature}")
        self.add_item(item)

    def print_stats(self):
        log.info("")
        all_cables = {}
        all_pdus = {}
        for item in self.grid_items:
            #log.debug(item)
            if item.native:
                continue
            if isinstance(item, PowerGridPDU):
                all_pdus.setdefault(item.size, []).append(item)
            elif isinstance(item, PowerGridCable):
                all_cables.setdefault(item.size, []).append(item)

        all_total_length = 0
        log.info("Cable lines:")
        for cable_size in sorted(all_cables.keys(), reverse=True):
            cables = all_cables[cable_size]
            total_length = 0
            for cable in cables:
                total_length += cable.length_m
                #log.debug(f"    {cable.name:>20}: {cable.length():>4.0f}m")
            all_total_length += total_length
            log.info(f"  {cable_size:>3}: {total_length:,.0f}m")
        log.info(f"Total cable length: {all_total_length:,.0f}m")

        pdu_count = 0
        log.info("PDUs:")
        for pdu_size in sorted(all_pdus.keys(), reverse=True):
            pdus = all_pdus[pdu_size]
            log.info(f"  PDU {pdu_size}: {len(pdus)}")
            pdu_count += len(pdus)
        log.info(f"Total: {pdu_count}")

    def add_placement_feature(self, f: PlacementEntityFeature):
        self.add_item(PowerConsumer.from_feature(f))

async def get_power_grid(db: DBSessionDep, project: 'Project', timestamp: Optional[datetime] = None) -> PowerGrid:
    collections = await project.awaitable_attrs.collections

    grid = PowerGrid()
    async for f in PowerAreaFeatureCollection(collections['power_areas'], time_end=timestamp).all_last_values(db):
        grid.add_area_feature(f)

    async for f in PowerGridFeatureCollection(collections['power_grid'], time_end=timestamp).all_last_values(db):
        grid.add_grid_feature(f)

    async for f in PlacementEntityFeatureCollection(collections['placement'], time_end=timestamp).all_last_values(db):
        grid.add_placement_feature(f)

    return grid
