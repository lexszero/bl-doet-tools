import os

from power_map.external_data import ExternalDataLoader
from power_map.power_grid_base import PowerGridItemSize

class PowerGrid_BL25(ExternalDataLoader):
    OFFLINE = False

    KML_URL = 'http://www.google.com/maps/d/kml?forcekml=1&mid=1mjli2CA4t6cnU7NQaSPyUL0byiDQO64'
    KML_FILENAME = os.path.dirname(__file__)+'/data/bl25_grid.kml'

    KML_FOLDERS_AREAS = ['Power_Areas']
    KML_FOLDERS_GRID = [
            'HV_and_trafos',
            'Core_grid',
            'PDUs'
            ]

    GRID_MISC_ITEMS = {
        '200 KvA transformer 1': PowerGridItemSize.ThreePhase_250A,
        '200 KvA transformer 2': PowerGridItemSize.ThreePhase_250A,
        '8kV Line': None,
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
            'WET1',
            'FOREST',
            ]

    PLACEMENT_ENTITIES_URL = None #'https://placement.freaks.se/api/v1/mapentities'
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
