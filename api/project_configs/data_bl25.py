from core.importer.config import ProjectImportConfig
from placement.importer import Importer_PlacementIncremental, PlacementLoader
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

BL25_LOADERS = {
        'power_map': PowerMapKML(
            url='http://www.google.com/maps/d/kml?forcekml=1&mid=1mjli2CA4t6cnU7NQaSPyUL0byiDQO64',
            filename='bl25_grid.kml'
            ),
        'placement': PlacementLoader(
            filename='bl25_entities.json',
            url='https://robnowa.runasp.net/api/v1/mapentities'
            ),
        }

BL25_IMPORTERS_POWER_MAP = [
        Importer_PowerAreas(
            loader='power_map',
            folders=[
                'Power_Areas',
                ],
            toplevel=[
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
            ),
        Importer_PowerGridRaw(
            loader='power_map',
            collection='power_grid',
            folders=[
                'West_Transformer',
                'WEST_Grid',
                'WEST_Grid_PDUs',
                'EAST_Grid',
                'EAST_Grid_PDUs',
                ],
            override={
                '200 KvA transformer 1': PowerSource_250A,
                '200 KvA transformer 2': PowerSource_250A,
                'Generator, 35kva': PowerSource_63A,
                'Generator 35-40kva': PowerSource_63A,
                '8kV Line': Override(ignore=True),
                'Barn power room': Override(size=PowerGridItemSize.ThreePhase_63A)
                }
            ),
        Importer_PowerGridProcessed(
            loader=None,
            source='power_grid',
            )
        ]


BL25_IMPORTERS = [
    *BL25_IMPORTERS_POWER_MAP,
    Importer_PlacementIncremental(
        loader='placement',
        ),
    ]

Data_bl25 = ProjectImportConfig(
            loaders=BL25_LOADERS,
            importers=BL25_IMPORTERS)

__all__ = ["Data_bl25"]
