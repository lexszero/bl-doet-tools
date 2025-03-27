#!/usr/bin/env python3
# type: ignore
from IPython.terminal.embed import InteractiveShellEmbed
from traitlets.config.loader import Config as IPythonConfig

from devtools import debug
import asyncio

from common.db_async import DBSessionDep, get_db_session, create_db_and_tables

from common.errors import NotFoundError
from core.dependencies import get_project
from core.user import create_user, get_user
from core.project import create_project

from power_map.data_bl24 import PowerGrid_BL24
from power_map.data_bl25 import PowerGrid_BL25
from power_map.data_bl25_test import PowerGrid_BL25_Test
from power_map.external_data import ExternalDataLoader
from power_map.updater import Updater
from power_map.utils import *

#_db_engine = create_engine(DATABASE_URL)
#Session = sessionmaker(_db_engine)

ADMIN_USER_NAME = 'admin'

async def initialize():
    await create_db_and_tables()
    async with await get_db_session() as db:
        await create_user(db, ADMIN_USER_NAME, '')
        await db.commit()

async def db_import_grid(db: DBSessionDep, project_name: str, loader: type[ExternalDataLoader]):
    user = await get_user(db, ADMIN_USER_NAME)

    try:
        project = await get_project(db, project_name)
    except NotFoundError:
        project = await create_project(db, project_name, user)

    updater = Updater(ADMIN_USER_NAME, project_name, loader)
    await updater.run(db)

    await db.commit()

async def import_all_data():
    try:
        async with await get_db_session() as db:
            user = await get_user(db, ADMIN_USER_NAME)
        debug(user)
    except:
        await initialize()

    for name, loader in [
            ('bl24', PowerGrid_BL24),
            ('bl25', PowerGrid_BL25),
            ('bl25_test', PowerGrid_BL25_Test),
            ]:
        async with await get_db_session() as db:
            await db_import_grid(db, name, loader)

def repl():
    c = IPythonConfig()
    c.InteractiveShell.colors = 'linux'
    embed = InteractiveShellEmbed(config=c)
    embed()

if __name__ == '__main__':
    asyncio.run(import_all_data())
    #repl()
