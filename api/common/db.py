from sqlalchemy.orm import DeclarativeMeta, declarative_base

from common.settings import settings

DATABASE_URL = f"postgresql://{settings.db_user}:{settings.db_password}@{settings.db_host}/{settings.db_name}"

DBModel: DeclarativeMeta = declarative_base()


