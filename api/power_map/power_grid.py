from dataclasses import dataclass
from datetime import datetime
from typing import Iterable, Optional
from pydantic import BaseModel, PrivateAttr, RootModel, TypeAdapter

from common.db_async import DBSessionDep
from common.geometry import (
        coord_transform, XFRM_GEO_TO_PROJ,
        Feature, FeatureCollection,
        Point, LineString,
        ShapelyPoint, ShapelyLineString,
        )
from core.store import VersionedCollection
from power_map.placement import PlacementEntityFeature, PlacementEntityFeatureCollection
from power_map.power_area import PowerArea, PowerAreaFeature, PowerAreaFeatureCollection
from power_map.power_consumer import PowerConsumer
from power_map.power_grid_cable import (
        PowerGridCable,
        PowerGridCableFeature,
        PowerGridCablePropertiesWithStats
        )
from power_map.power_grid_pdu import (
        PowerGridPDU,
        PowerGridPDUFeature,
        PowerGridPDUPropertiesWithStats
        )
from power_map.utils import log
from power_map.itemized_log import ItemizedLogEntry, ItemizedLogCollector

PowerGridItem = PowerGridCable | PowerGridPDU
PowerGridFeature = PowerGridCableFeature | PowerGridPDUFeature

PowerGridSnapshot = list[PowerGridFeature]

PowerGridFeatureModel = RootModel[PowerGridFeature]

PowerGridFeatureCollectionType = FeatureCollection[Feature[Point, PowerGridPDUPropertiesWithStats] | Feature[LineString, PowerGridCablePropertiesWithStats]]

class PowerGridData(BaseModel):
    timestamp: datetime
    log: list[ItemizedLogEntry]
    features: PowerGridFeatureCollectionType

NEAR_THRESHOLD_M = 1

def cut_line_at_points(line: ShapelyLineString, points: Iterable[ShapelyPoint]) -> list[ShapelyLineString]:
    p_coords = [list(p.coords)[0] for p in points]
    coords = list(line.coords) + p_coords
    distances = [line.project(ShapelyPoint(p)) for p in coords]
    coords = [p for (d, p) in sorted(zip(distances, coords))]
    lines = []
    chunk = []
    for p in coords:
        chunk.append(p)
        if len(chunk) > 1 and p in p_coords:
            lines.append(ShapelyLineString(chunk))
            chunk = [p]
    if len(chunk) > 1:
        lines.append(ShapelyLineString(chunk))
    else:
        last_point = lines[-1].coords[-1]
        d = coord_transform(XFRM_GEO_TO_PROJ, ShapelyPoint(last_point)).distance(coord_transform(XFRM_GEO_TO_PROJ, ShapelyPoint(chunk[0])))
        log.debug(f'leftover point distance {d}')

    return lines

def sort_by_size(items: list[PowerGridItem], descending=True):
    items.sort(key=lambda it: it.size, reverse=descending)

class PowerGridFeatureCollection(VersionedCollection[PowerGridFeature]):
    store_collection_name = 'power_grid'
    store_item_type = 'power_grid_item'
    store_item_class = TypeAdapter(PowerGridFeature)

class PowerGridSnapshotCollection(VersionedCollection[PowerGridSnapshot]):
    store_collection_name = 'power_grid_full'
    store_item_type = 'power_grid_snapshot'
    store_item_class = TypeAdapter(PowerGridSnapshot)


class PowerGrid(PowerArea):
    _log: ItemizedLogCollector = PrivateAttr()
    _timestamp: datetime = PrivateAttr()

    def __init__(self, timestamp=None):
        super().__init__(id="<TopLevel>", name="<TopLevel>", geometry=None)
        self._log = ItemizedLogCollector(log.getChild('validation'))
        self._timestamp = timestamp or datetime.now(tz=None)

    def add_area_feature(self, f: PowerAreaFeature) -> PowerArea:
        area = PowerArea.from_feature(f)
        if area.id in self._areas:
            raise ValueError(f"Duplicate area {area.name}")
        self._areas[area.id] = area
        return area

    def add_grid_features(self, features: Iterable[PowerGridFeature]):
        pdus = []
        cables = []
        for f in features:
            if isinstance(f, PowerGridCableFeature):
                cables.append(PowerGridCable.from_feature(f))
            elif isinstance(f, PowerGridPDUFeature):
                pdus.append(PowerGridPDU.from_feature(f))

        sort_by_size(pdus)
        sort_by_size(cables)

        # Step 1: assign PDUs to cables by proximity
        sources = []
        for pdu in pdus:
            found = False
            if pdu.power_source:
                sources.append(pdu)
            for cable in cables:
                if cable.size > pdu.size:
                    continue
                d = cable.distance_m(pdu)
                if d < NEAR_THRESHOLD_M and (
                        pdu.power_source or cable.size <= pdu.size):
                    cable._pdus.append(pdu)
                    found = True
            if not found:
                self._log.error(pdu.id, f"Unable to assign PDU to any cable line")
                continue

        for cable in cables:
            cable._pdus.sort(key=lambda p: p.size, reverse=True)

        # Step 2: split cables that have multiple PDUs into simple separate pieces
        # from one PDU to the next
        cables_split = []
        for cable in cables:
            n_pdus = len(cable._pdus)
            if n_pdus > 2:
                mid_points = []
                for p in cable._pdus:
                    if not any([p.shape_proj.distance(ep) < NEAR_THRESHOLD_M for ep in cable.end_points_proj]) and p.size == cable.size:
                        mid_points.append(p.shape)
                segments = cut_line_at_points(cable.shape, mid_points)
                seg_lengths = []
                ok = True
                new_cables = []
                for idx, segment in enumerate(segments):
                    length = coord_transform(XFRM_GEO_TO_PROJ, segment).length
                    if length < 1:
                        continue
                    c = PowerGridCable(
                            type='power_grid_cable',
                            id=f"{cable.id}_{idx}",
                            geometry=segment.__geo_interface__,
                            name=f"{cable.name} #{idx}",
                            description=cable.description,
                            power_size=cable.size,
                            power_native=cable.native
                            )
                    eps = c.end_points_proj
                    np = 0
                    for p in cable._pdus:
                        if any([p.shape_proj.distance(e) < NEAR_THRESHOLD_M for e in eps]):
                            c._pdus.append(p)
                            np += 1
                    if len(c._pdus) != 2:
                        ok = False
                    new_cables.append(c)
                    seg_lengths.append(int(length))
                    idx += 1
                if ok:
                    self._log.warning(cable.id, f"Cable has {n_pdus} PDUs, split it into parts of {seg_lengths} meters (total length {cable.length_m}m)")
                    for c in new_cables:
                        c.print_info()
                    cables_split += new_cables
                else:
                    self._log.error(cable.id, f"Failed to split cable with {n_pdus} PDUs correctly")
                    cables_split.append(cable)
            else:
                if n_pdus == 2:
                    cables_split.append(cable)
                else:
                    self._log.error(cable.id, f"Cable doesn't have at least 2 PDUs assigned")

        cables = cables_split

        # Step 3: assign cables to pdus
        for cable in cables:
            for pdu in cable._pdus:
                pdu._cables.append(cable)

        for pdu in pdus:
            sort_by_size(pdu._cables)

        # Step 4: connect the pdus with cables and do final checks
        if not len(sources):
            self._log.error(None, f"No power sources found, unable to connect anything")
        else:
            for pdu in sources:
                pdu.connect(log=self._log)

            for pdu in pdus:
                if not pdu.power_source and not pdu._cable_in:
                    self._log.error(pdu.id, f"PDU is not getting power")

            for cable in cables:
                if not cable._pdu_from:
                    self._log.error(cable.id, "Cable is not connected to source")
                if not cable._pdu_to:
                    self._log.error(cable.id, "Cable is not connected to load")

        for pdu in pdus:
            self.add_item(pdu)

        for cable in cables:
            self.add_item(cable)

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

    grid = PowerGrid(timestamp=await project.get_last_change_timestamp(db))
    async for f in PowerAreaFeatureCollection(collections['power_areas'], time_end=timestamp).all_last_values(db):
        grid.add_area_feature(f)

    grid.add_grid_features([f async for f in PowerGridFeatureCollection(collections['power_grid'], time_end=timestamp).all_last_values(db)])

    async for f in PlacementEntityFeatureCollection(collections['placement'], time_end=timestamp).all_last_values(db):
        grid.add_placement_feature(f)

    return grid
