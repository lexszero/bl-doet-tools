from core.project_config import ProjectConfig

from project_configs.data_bl24 import Data_bl24
from project_configs.data_bl25 import Data_bl25
from project_configs.data_bl25_test import Data_bl25_test
from project_configs.template_bl import *

ProjectConfig_bl24 = ProjectConfig(
        name="bl24",
        elements=BL_ELEMENTS,
        public=True,
        views=BL_VIEWS,
        external=Data_bl24
        )

ProjectConfig_bl24_test = ProjectConfig(
        name="bl24_test",
        elements=BL_ELEMENTS,
        public=True,
        views=BL_VIEWS,
        external=Data_bl24
        )

ProjectConfig_bl25 = ProjectConfig(
        name="bl25",
        elements=BL_ELEMENTS,
        public=False,
        views=BL_VIEWS,
        external=Data_bl25
        )

ProjectConfig_bl25_test = ProjectConfig(
        name="bl25_test",
        elements=BL_ELEMENTS,
        public=False,
        views=BL_VIEWS,
        external=Data_bl25_test
        )

PROJECTS = {
        'bl24': ProjectConfig_bl24,
        'bl24_test': ProjectConfig_bl24_test,
        'bl25': ProjectConfig_bl25,
        'bl25_test': ProjectConfig_bl25_test
        }

def get_default_project_config(name: str) -> ProjectConfig:
    return PROJECTS[name]
