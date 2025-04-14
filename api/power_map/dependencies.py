from datetime import datetime
from typing import Annotated, Optional
from cachetools import TTLCache
from cachetools_async import cached
from fastapi import Depends

from common.db_async import get_db_session
from power_map.power_grid import PowerGrid, get_power_grid
from core.dependencies import get_project

@cached(TTLCache(maxsize=64, ttl=30))
async def get_power_grid_cached(project_name: str, time_end: Optional[datetime] = None):
    async with await get_db_session() as db:
        project = await get_project(db, project_name)
        return await get_power_grid(project, timestamp=time_end)

PowerGridDep = Annotated[PowerGrid, Depends(get_power_grid_cached)]

