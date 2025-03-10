from cachetools import cached, TTLCache

from power_map.data_loader import DataLoader
from power_map.data_bl24 import PowerGrid_BL24
from power_map.data_bl25 import PowerGrid_BL25
from power_map.power_area import PowerArea

class ProjectData:
    power_grid: PowerArea

    def __init__(self, power_grid: PowerArea):
        self.power_grid = power_grid

POWER_GRID_DATA: dict[str, type[DataLoader]] = {
        'bl24': PowerGrid_BL24,
        'bl25': PowerGrid_BL25,
        }

@cached(cache=TTLCache(maxsize=10, ttl=600))
def get_project_data(id: str) -> ProjectData:
    return ProjectData(POWER_GRID_DATA[id]().data)
