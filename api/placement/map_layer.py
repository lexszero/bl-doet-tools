from typing import ClassVar, Literal

from core.data_request import DataRequestContext
from core.map_layer_features import MapLayer_Features, MapLayerConfig_Features, MapLayerData_Features
from core.permission import Role
from placement.types import PlacementEntityFeature

class MapLayerConfig_Placement(MapLayerConfig_Features[PlacementEntityFeature]):
    type: Literal['placement'] = 'placement'

class MapLayerData_Placement(MapLayerData_Features[PlacementEntityFeature]):
    type: Literal['placement'] = 'placement'


RolesNonPublic = frozenset([Role.Owner, Role.Admin, Role.Editor, Role.Viewer])

def transform_placement_scrub_private_data(f: PlacementEntityFeature, context: DataRequestContext) -> PlacementEntityFeature:
    props = f.properties
    if context.client_project_roles.intersection(RolesNonPublic):
        return f
    if props:
        if props.contact_info:
            props.contact_info = "<redacted>"
        if props.tech_contact_info:
            props.tech_contact_info = "<redacted>"

    return f

class MapLayer_Placement(MapLayer_Features[PlacementEntityFeature]):
    TYPE: ClassVar[Literal['placement']] = 'placement'
    TRANSFORMS = {
            "redacted": transform_placement_scrub_private_data
            }

__all__ = [
        'MapLayer_Placement',
        ]
