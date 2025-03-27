import contextlib

from typing import Any, Annotated, AsyncGenerator, AsyncIterator
from fastapi import Depends

from sqlalchemy.ext.asyncio import AsyncConnection, AsyncSession, async_sessionmaker, create_async_engine

from common.settings import settings
from common.db import DBModel, DATABASE_URL

DATABASE_URL = f"postgresql+asyncpg://{settings.db_user}:{settings.db_password}@{settings.db_host}/{settings.db_name}"

class AsyncSessionManager:
    def __init__(self, host: str, engine_kwargs: dict[str, Any] = {}):
        self._engine_async = create_async_engine(host, **engine_kwargs)
        self._sessionmaker_async = async_sessionmaker(autocommit=False, bind=self._engine_async)

    #async def close(self):
    #    if self._engine_async is None:
    #        raise Exception("DatabaseSessionManager is not initialized")
    #    await self._engine_async.dispose()

    #    self._engine_async = None
    #    self._sessionmaker_async = None

    @contextlib.asynccontextmanager
    async def connect(self) -> AsyncIterator[AsyncConnection]:
        if self._engine_async is None:
            raise Exception("DatabaseSessionManager is not initialized")

        async with self._engine_async.begin() as connection:
            try:
                yield connection
            except Exception:
                await connection.rollback()
                raise

    @contextlib.asynccontextmanager
    async def session(self) -> AsyncIterator[AsyncSession]:
        if self._sessionmaker_async is None:
            raise Exception("DatabaseSessionManager is not initialized")

        session = self._sessionmaker_async()
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

sessionmanager = AsyncSessionManager(DATABASE_URL)

async def get_db_session_context() -> AsyncGenerator[AsyncSession, Any]:
    async with sessionmanager.session() as session:
        yield session

DBSessionDep = Annotated[AsyncSession, Depends(get_db_session_context)]

async def get_db_session():
    return sessionmanager._sessionmaker_async()

async def create_db_and_tables():
    async with sessionmanager.connect() as conn:
        await conn.run_sync(DBModel.metadata.create_all)

__all__ = ['create_db_and_tables', 'get_db_session', 'DBModel', 'AsyncSession']
