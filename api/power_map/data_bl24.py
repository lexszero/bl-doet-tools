import os

from power_map.external_data import ExternalDataLoader
from power_map.power_grid_base import PowerGridItemSize

class PowerGrid_BL24(ExternalDataLoader):
    OFFLINE = True

    KML_URL = 'http://www.google.com/maps/d/kml?forcekml=1&mid=1oS6UFpJMdwnm7UmkaEBRJrC3Mhp80nQ'
    KML_FILENAME = os.path.dirname(__file__)+'/data/bl24_grid.kml'

    KML_FOLDERS_AREAS = ['areas', 'smaller_sub_layers']
    KML_FOLDERS_GRID = [
            'NORTH',
            'SOUTH',
            'EAST',
            'Barn_and_the_hill',
            'Not_measured_Areas'
            ]

    GRID_MISC_ITEMS = {
        'Transformator': PowerGridItemSize.ThreePhase_125A,
        'Barn power room': PowerGridItemSize.ThreePhase_63A,
        'Generator, 35kva': PowerGridItemSize.ThreePhase_63A,
        'Generator 35-40kva': PowerGridItemSize.ThreePhase_63A,
        }

    GRID_AREAS_TOPLEVEL = [
            '8kV Pole and Transformer',
            'Native Grid',
            'DoET',
            'PX1',
            'The Villa',
            'PSC',
            'PSE',
            'PSS',
            'PSW',
            'PE',
            'PNS',
            'PNE',
            'PNW'
            ]

    PLACEMENT_ENTITIES_URL = 'https://placement.freaks.se/api/v1/mapentities'
    PLACEMENT_ENTITIES_FILENAME = os.path.dirname(__file__)+'/data/bl24_entities.json'

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
