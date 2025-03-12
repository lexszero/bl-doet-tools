import logging
from typing import Any, Self, Optional, TypeVar

from common.log import Log
from common.model_utils import BaseModel

log = Log.getChild('power_map')
log.setLevel(logging.DEBUG)

class NameDescriptionModel(BaseModel):
    name: str
    description: Optional[str] = None

    @property
    def name_description(self):
        if self.description:
            return f"{self.name} / {self.description}".replace("\n", " ")
        else:
            return self.name



