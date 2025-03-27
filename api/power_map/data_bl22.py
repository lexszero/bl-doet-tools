from power_map.external_data import ExternalDataLoader
from power_map.power_grid_base import PowerGridItemSize

class PowerGrid_BL22(ExternalDataLoader):
    KML_URL = 'https://www.google.com/maps/d/kml?forcekml=1&mid=1CU7xpeCD3B1KMvya81Dem1n-tmv85xke'

    KML_FOLDER_AREAS = 'Areas'
    KML_FOLDERS = [
        'native_grid',
        'forrest_generator',
        'BLUE_Supply',
        'RED_supply',
        ]

    GRID_MISC_ITEMS = {
            'Local grid power': PowerGridItemSize.ThreePhase_63A,
            'Generator Mumi': PowerGridItemSize.ThreePhase_63A,
            'Generator': PowerGridItemSize.ThreePhase_63A,
            'Generator BLUE': PowerGridItemSize.ThreePhase_125A,
            'Generator RED': PowerGridItemSize.ThreePhase_125A,
            }

    @classmethod
    def is_ignored_grid_feature(cls, feature) -> bool:
        return super().is_ignored_grid_feature(feature) or ('FUEL STORAGE' in feature.name)


