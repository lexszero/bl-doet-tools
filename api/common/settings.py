import os
from pydantic_settings import BaseSettings, SettingsConfigDict

_base_dir = os.path.dirname(os.path.dirname(__file__))

class Settings(BaseSettings):
    db_host: str = 'localhost:5432'
    db_name: str = 'bl-doet'
    db_user: str = 'bl-doet'
    db_password: str
    secret_key: str

    data_dir: str = _base_dir + '/project_data'
    project_config_dir: str = _base_dir + '/project_configs'

    log_level: str = 'INFO'

    model_config = SettingsConfigDict(
            env_file="../.env",
            extra='ignore'
            )

settings = Settings()

__all__ = ['Settings', 'settings']
