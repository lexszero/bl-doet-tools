from typing import Optional
from common.model_utils import BaseModel

class NameDescriptionModel(BaseModel):
    name: str
    description: Optional[str] = None

    @property
    def name_description(self):
        if self.description:
            return f"{self.name} / {self.description}".replace("\n", " ")
        else:
            return self.name



