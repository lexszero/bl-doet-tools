from typing import Annotated

from sqlalchemy import select
import typer

from common.cli import AsyncTyper
from common.db_async import get_db_session
from core.log import log
from core.user import UserInDB, create_user, get_user_db, password_hash


user = AsyncTyper()

@user.command()
async def list():
    async with await get_db_session() as db:
        for u in (await db.scalars(select(UserInDB))).unique():
            perms = await u.awaitable_attrs.permissions
            print(f'''User {u.name}
    active={u.active}, created at {u.created_at.isoformat()}, modified at {u.modified_at.isoformat()}
    password_hash: {u.password_hash}
    profile: {u.profile}
    permissions: {[str(p) for p in perms]}''')

@user.command()
async def create(
        username: str,
        password: Annotated[
            str, typer.Option(prompt=True, confirmation_prompt=True, hide_input=True)
            ]
        ):
    async with await get_db_session() as db:
        user = None
        try:
            user = await get_user_db(db, username)
        except: pass
        if user:
            log.error(f"User {username} already exists")
            raise typer.Exit(1)

        await create_user(db, username, password)

@user.command()
async def set_password(
        username: str,
        password: Annotated[
            str, typer.Option(prompt=True, confirmation_prompt=True, hide_input=True)
            ]
        ):
    async with await get_db_session() as db:
        u = await get_user_db(db, username)
        new_hash = password_hash(password)
        print(f"Setting user {u} password_hash={new_hash}")
        u.password_hash = new_hash
        db.add(u)
        await db.commit()


