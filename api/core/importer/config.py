from typing import Annotated, Mapping, Union

from pydantic import BaseModel, Field

from core.importer.base import LoadFromUrlOrFile
from core.importer.feature_collection import Importer_StaticCollections
from placement.importer import (
        Importer_PlacementFull,
        Importer_PlacementIncremental,
        Importer_PlacementKML,
        PlacementLoader
        )
from power_map.importer import (
        Importer_PowerAreas,
        Importer_PowerGridRaw,
        Importer_PowerGridProcessed,
        PowerMapKML
        )

AnyLoader = Annotated[
        Union[
            LoadFromUrlOrFile,
            PlacementLoader,
            PowerMapKML
            ],
        Field(discriminator='type')
        ]

AnyImporter = Annotated[
        Union[
            Importer_StaticCollections,
            Importer_PlacementFull,
            Importer_PlacementIncremental,
            Importer_PlacementKML,
            Importer_PowerAreas,
            Importer_PowerGridRaw,
            Importer_PowerGridProcessed
            ],
        Field(discriminator='type')
        ]

class ProjectImportConfig(BaseModel):
    loaders: Mapping[str, AnyLoader]
    importers: list[AnyImporter]

ProjectImportConfig.model_rebuild()
