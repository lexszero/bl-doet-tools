import sys
from typing import Annotated, Optional
from devtools import pformat

from sqlalchemy import select
import typer
from rich import print

from common.cli import AsyncTyper
from common.db_async import get_db_session
from core.dependencies import get_project
from core.log import log
from core.project import Project
from core.project_config import ProjectConfig
from core.project_default_config import DEFAULT_PROJECT_CONFIG

project = AsyncTyper()

@project.command()
async def list():
    async with await get_db_session() as db:
        for p in await db.scalars(select(Project)):
            perms = await p.get_all_permissions()
            print(f'''[bold]Project: {p.name}[/bold] [id={p.id}]

    Configuration:
    {pformat(p.data, indent=2)}

    Permissions: {[str(p) for p in perms]}
=====================================
''')

@project.command()
async def data_update(project_name: str, commit: bool = typer.Option(False)):
    from power_map.updater import Updater
    from power_map.data_bl24 import PowerGrid_BL24
    from power_map.data_bl25 import PowerGrid_BL25
    from power_map.data_bl25_test import PowerGrid_BL25_Test

    updatable_projects = {
        'bl24': PowerGrid_BL24,
        'bl25': PowerGrid_BL25,
        'bl25_test': PowerGrid_BL25_Test
        }

    if commit:
        log.warning(f"Fetched changes will be stored to the DB")

    loader = updatable_projects.get(project_name)
    if not loader:
        log.error(f"No known loader for project {project_name}")
        raise typer.Exit(1)

    updater = Updater('admin', project_name, loader)
    await updater.run(commit=commit)

@project.command()
async def config_reset(project_name: str):
    async with await get_db_session() as db:
        project = await get_project(db, project_name)
        await project.set_config(DEFAULT_PROJECT_CONFIG)
        print("Updated config: ", project.config)
        await db.commit()

@project.command()
async def config_get(project_name: str):
    async with await get_db_session() as db:
        project = await get_project(db, project_name)
        print(project.data.model_dump_json(indent=2))

@project.command()
async def config_get(project_name: str):
    async with await get_db_session() as db:
        project = await get_project(db, project_name)
        print(project.data.model_dump_json(indent=2))

@project.command()
async def config_set(
        project_name: str,
        filename: Annotated[Optional[str], typer.Option('--filename', '-f')]):
    data = None
    if filename:
        with open(filename, 'r') as f:
            data = f.read();
    else:
        data = sys.stdin.read()
    config = ProjectConfig.model_validate_json(data)
    async with await get_db_session() as db:
        project = await get_project(db, project_name)
        project.data = config
        db.add(project)
        await db.commit()

@project.command()
async def set_public(project_name: str, public: bool):
    async with await get_db_session() as db:
        project = await get_project(db, project_name)
        project.config.public = public
        project.data = project.config
        db.add(project)
        print("Updated config: ", project.config)
        await db.commit()


