from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    db_host: str = 'localhost:5432'
    db_name: str = 'doet-web'
    db_user: str = 'doet-web'
    db_password: str
    secret_key: str

    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()

__all__ = ['Settings', 'settings']
