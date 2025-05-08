from core.importer.config import ProjectImportConfig
from placement.importer import Importer_PlacementKML
from power_map.importer import PowerMapKML
from project_configs.data_bl25 import BL25_IMPORTERS_POWER_MAP

LOADERS = {
        'power_map': PowerMapKML(
            url='http://www.google.com/maps/d/kml?forcekml=1&mid=18ttaWJe3AVcVMuF4xWxHvII5Xhp0CUE'
            ),
        }

IMPORTERS = [
    *BL25_IMPORTERS_POWER_MAP,
    Importer_PlacementKML(
        loader='power_map',
        )
    ]


Data_bl25_test = ProjectImportConfig(
            loaders=LOADERS,
            importers=IMPORTERS)

__all__ = ["Data_bl25_test"]
