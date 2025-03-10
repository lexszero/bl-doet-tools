from cachetools import cached, TTLCache

from power_map.data_loader import DataLoader
from power_map.data_bl24 import PowerGrid_BL24
from power_map.data_bl25 import PowerGrid_BL25
from power_map.power_area import PowerArea
from power_map.power_grid_cable import PowerGridCable
from power_map.power_grid_pdu import PowerGridPDU
from power_map.utils import log

class ProjectData:
    power_grid: PowerArea

    def __init__(self, power_grid: PowerArea):
        self.power_grid = power_grid

    def print_grid_stats(self):
        log.info("")
        all_cables = {}
        all_pdus = {}
        for item in self.power_grid.grid_items:
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


POWER_GRID_DATA: dict[str, type[DataLoader]] = {
        'bl24': PowerGrid_BL24,
        'bl25': PowerGrid_BL25,
        }

@cached(cache=TTLCache(maxsize=10, ttl=600))
def get_project_data(id: str) -> ProjectData:
    result = ProjectData(POWER_GRID_DATA[id]().data)
    result.print_grid_stats()
    return result
