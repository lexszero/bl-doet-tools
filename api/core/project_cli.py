import sys
from typing import Annotated, Optional
from devtools import pformat

from sqlalchemy import delete as sql_delete, select
import typer
from rich import print

from common.cli import AsyncTyper
from common.db_async import get_db_session
from core.dependencies import get_project
from core.log import log
from core.permission import grant_permission
from core.project import Project, create_project
from core.project_config import ProjectConfig
from core.store import StoreCollection, StoreItemRevision
from core.user import get_user_db
from project_configs.bl import get_default_project_config

project = AsyncTyper()

async def print_project_info(p: Project):
    perms = await p.get_all_permissions()
    colls = await p.awaitable_attrs.collections
    print(f'''[bold]Project: {p.name}[/bold] [id={p.id}]

    Configuration:
    {pformat(p.data, indent=2)}

    Permissions: {[str(p) for p in perms]}
    Collections: {[str(c) for c in colls]}
=====================================
''')

@project.command()
async def list():
    async with await get_db_session() as db:
        for p in await db.scalars(select(Project)):
            await print_project_info(p)

@project.command()
async def create(name: str, username: str):
    async with await get_db_session() as db:
        user = await get_user_db(db, username)
        project = await create_project(db, name, owner=user, config=get_default_project_config(name))
        await print_project_info(project)
        await db.commit()

@project.command()
async def clone(existing_name: str, new_name: str, link_collections: bool = False, copy_permissions: bool = False):
    async with await get_db_session() as db:
        p_existing = await get_project(db, existing_name)
        p_new = await create_project(db, new_name, p_existing.owner_user, p_existing.config)

        if link_collections:
            collections_src = await p_existing.awaitable_attrs.collections
            collections_dst = await p_new.awaitable_attrs.collections
            for name, collection in collections_src.items():
                collections_dst[name] = collection

        if copy_permissions:
            for p in await p_existing.get_all_permissions():
                if p.object_type == 'project':
                    p.object_id = str(p_new.id)
                    await grant_permission(db, p.user_id, p)

@project.command()
async def delete(name: str):
    async with await get_db_session() as db:
        project = await get_project(db, name)

        typer.confirm(f"This will IRREVERSIBLY delete all data in {project.name}. Proceed?", abort=True)
        await db.delete(project)
        await db.commit()

@project.command()
async def data_update(name: str, loader: Optional[str] = typer.Option(None), commit: bool = typer.Option(False)):
    async with await get_db_session() as db:
        user = await get_user_db(db, 'admin')
        project = await get_project(db, name)
        await project.update_data(user=user, loader_name=loader)
        if commit:
            log.info("Saving updates to the database")
            await db.commit()
        else:
            log.warning("Updates are not saved")

@project.command()
async def config_reset(project_name: str):
    async with await get_db_session() as db:
        config = get_default_project_config(project_name)
        project = await get_project(db, project_name)
        await project.set_config(config)
        print("Updated config: ", project.config)
        await db.commit()

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

@project.command()
async def data_list(project_name: str):
    async with await get_db_session() as db:
        project = await get_project(db, project_name)
        print(f"Project {project.name} collections:")
        colls = await project.awaitable_attrs.collections
        for name, c in colls.items():
            info = await c.info()
            print(f"    {name}: item_type={info.item_type}, {info.num_items} items, {info.num_revisions} revisions")

@project.command()
async def data_delete(project_name: str, collection: str):
    async with await get_db_session() as db:
        project = await get_project(db, project_name)
        colls = await project.awaitable_attrs.collections
        if collection not in colls:
            log.error(f"Collection {collection} doesn't exist")
            typer.Exit(1)
        c = colls.get(collection)
        info = await c.info()
        print(f"Found collection {project.name}/{collection}\nitem_type={info.item_type}, {info.num_items} items, {info.num_revisions} revisions")
        typer.confirm(f"This will IRREVERSIBLY delete all data in {project.name}/{collection}. Proceed?", abort=True)
        await db.execute(sql_delete(StoreItemRevision).where(StoreItemRevision.collection_id == c.id))
        await db.execute(sql_delete(StoreCollection).where(StoreCollection.id == c.id))
        await db.commit()
