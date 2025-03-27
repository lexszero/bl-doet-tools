from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    db_host: str = 'localhost:5432'
    db_name: str = 'bl-doet'
    db_user: str = 'bl-doet'
    db_password: str
    secret_key: str

    log_level: str = 'DEBUG'

    model_config = SettingsConfigDict(
            env_file="../.env",
            extra='ignore'
            )

settings = Settings()
print(settings)

__all__ = ['Settings', 'settings']
