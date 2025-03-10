import os

from power_map.data_loader import DataLoader
from power_map.power_grid_base import PowerGridItemSize

class PowerGrid_BL25(DataLoader):
    KML_URL = 'http://www.google.com/maps/d/kml?forcekml=1&mid=1mjli2CA4t6cnU7NQaSPyUL0byiDQO64'
    KML_FILENAME = os.path.dirname(__file__)+'/data/bl25_grid.kml'

    KML_FOLDERS_AREAS = ['Power_Areas']
    KML_FOLDERS_GRID = [
            'Core_grid',
            ]

    GRID_MISC_ITEMS = {
        '250 KvA transformer': PowerGridItemSize.ThreePhase_125A,
        'Barn power room': PowerGridItemSize.ThreePhase_63A,
        'Generator, 35kva': PowerGridItemSize.ThreePhase_63A,
        'Generator 35-40kva': PowerGridItemSize.ThreePhase_63A,
        }

    GRID_AREAS_TOPLEVEL = [
            '½Playa',
            'Trafo island',
            'EAST',
            'SOUTH',
            'DoET',
            'TOWN SQUARE',
            'MUMI FIELDS',
            'VERY NORTH',
            'THRESHOLD',
            'VILLA',
            'FOREST',
            ]

    PLACEMENT_ENTITIES_URL = 'https://placement.freaks.se/api/v1/mapentities'
    PLACEMENT_ENTITIES_FILENAME = None #os.path.dirname(__file__)+'/data/bl24_entities.json'

    @classmethod
    def is_ignored_area(cls, feature) -> bool:
        return super().is_ignored_area(feature) or (
                feature.name in [
                    'primary vedge'
                    ])

    @classmethod
    def is_ignored_entity(cls, entity) -> bool:
        return super().is_ignored_consumer(entity) or (
                entity.properties.get('name') in [
                    'Offlimit',
                    'The Void'
                    ])
