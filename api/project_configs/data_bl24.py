from core.importer.base import LoadFromUrlOrFile
from core.importer.config import ProjectImportConfig
from core.importer.feature_collection import Importer_StaticCollections
from placement.importer import Importer_PlacementFull, PlacementLoader
from power_map.importer import (
        Importer_PowerGridProcessed,
        PowerMapKML,
        Importer_PowerAreas,
        Importer_PowerGridRaw,
        Override,
        PowerSource_250A,
        PowerSource_63A,
        )
from power_map.power_grid_base import PowerGridItemSize

BL24_LOADERS = {
        'static': LoadFromUrlOrFile(
            url='https://raw.githubusercontent.com/theborderland/map/refs/heads/main/public/data/bl24/'
            ),
        'power_map': PowerMapKML(
            url='http://www.google.com/maps/d/kml?forcekml=1&mid=1oS6UFpJMdwnm7UmkaEBRJrC3Mhp80nQ'
        ),
        'placement': PlacementLoader(
            offline=True,
            filename='bl24_entities.json'
            #url='https://placement.freaks.se/api/v1/mapentities',
            )
        }

BL24_IMPORTERS_POWER_MAP = [
        Importer_PowerAreas(
            loader='power_map',
            folders=[
                'areas',
                'smaller_sub_layers'
                ]
            ),
        Importer_PowerGridRaw(
            collection='power_grid',
            loader='power_map',
            folders=[
                'NORTH',
                'SOUTH',
                'EAST',
                'Barn_and_the_hill',
                'Not_measured_Areas'
                ],
            override={
                'Transformator': PowerSource_250A,
                'Generator, 35kva': PowerSource_63A,
                'Generator 35-40kva': PowerSource_63A,
                'Barn power room': Override(
                    size=PowerGridItemSize.ThreePhase_63A,
                    )
                },
            ),
        Importer_PowerGridProcessed(
            loader=None,
            source='power_grid'
            )
        ]

BL24_IMPORTERS = [
        Importer_StaticCollections(
            loader='static',
            collections={
                'roads': 'roads_and_distances.geojson',
                }
            ),
        *BL24_IMPORTERS_POWER_MAP,
        #Importer_PlacementFull(
        #    loader='placement',
        #    ),
        ]

Data_bl24 = ProjectImportConfig(
            loaders=BL24_LOADERS,
            importers=BL24_IMPORTERS)

__all__ = ["Data_bl24"]
