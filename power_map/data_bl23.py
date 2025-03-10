from power_map.data_loader import DataLoader
from power_map.power_grid_base import PowerGridItemSize

class PowerGrid_BL23(DataLoader):
    KML_URL = 'https://www.google.com/maps/d/kml?forcekml=1&mid=1zD_Jj58_9Lq29tYEz6X6zSc2Ag2NSP0'

    KML_FOLDER_AREAS = 'areas'
    KML_FOLDERS = [
            'NORTH',
            'SOUTH',
            'Barn_and_the_hill',
            ]

    GRID_MISC_ITEMS = {
            'Trafo, 200kva': PowerGridItemSize.ThreePhase_250A,
            'Generator': PowerGridItemSize.ThreePhase_63A,
            'Backup generator': PowerGridItemSize.ThreePhase_63A,
            'Generator 35-40kva': PowerGridItemSize.ThreePhase_63A,
            'Garden Line': PowerGridItemSize.ThreePhase_63A,
            'Main sub E': PowerGridItemSize.ThreePhase_63A,
            }

    PLACEMENT_ENTITIES_URL = 'https://web.archive.org/web/20230918115135if_/https://placement.freaks.se/api/v1/mapentities#expand'


