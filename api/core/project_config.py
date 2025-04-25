from typing import Any, Mapping
from pydantic import BaseModel, ConfigDict, Field

from common.errors import InternalError, NotFoundError
from core.data_view import DataViewBase
from core.map import AnyMapLayerConfig, MapViewConfig
from core.permission import Role

def get_all_subclasses(cls):
    all_subclasses = []

    for subclass in cls.__subclasses__():
        all_subclasses.append(subclass)
        all_subclasses.extend(get_all_subclasses(subclass))

    return all_subclasses

class ProjectConfig(BaseModel):
    name: str
    frozen: bool = False
    elements: dict[str, AnyMapLayerConfig]
    views: dict[str, MapViewConfig] = Field(default_factory=dict)
    public: bool = False

    model_config = ConfigDict(extra='allow')

    def get_element_generator(
            self,
            name: str,
            roles: frozenset[Role]
            ) -> DataViewBase:
        config = self.elements.get(name)
        if not config:
            raise NotFoundError(f"Data element {name} not found")
        config.check_permissions(roles)

        classes: list[DataViewBase] = get_all_subclasses(DataViewBase)
        for cls in classes:
            if config.type == cls.TYPE:
                return cls(config)
        raise InternalError(f"No class for data element config {config}")

def merge_config(base: ProjectConfig, update: Mapping[str, Any]):
    result = base.model_copy()
    update_views = update.get('views')
    if update_views:
        for view_name, view_config in update_views.items():
            r_view_config = result.views.setdefault(view_name, view_config)
            for layer_name, layer_config in r_view_config.layers.items():
                r_layer = r_view_config.layers.get(layer_name)
                if not r_layer:
                    r_layer = layer_config
                r_view_config.layers[layer_name] = r_layer.model_copy(update=layer_config.model_dump())
        return result



