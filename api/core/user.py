from datetime import datetime
from typing import Optional, Set

from pydantic import ConfigDict, Field

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.sql import func
from sqlalchemy.orm import Mapped, exc, mapped_column, relationship
import bcrypt

from common.db_async import AsyncSession, AsyncSessionMixin, DBSessionDep, DBModel
from common.errors import NotFoundError
from common.log import Log
from common.model_utils import BaseModel, ModelJson

from core.permission import ClientPermissions, Permission, PermissionInDB

log = Log.getChild('user')

def password_hash(password: str):
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password=pwd_bytes, salt=salt)
    return hashed_password.decode('utf-8')

def password_verify(plain_password: str, hashed_password: str):
    pwd_bytes = plain_password.encode('utf-8')
    hash_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password=pwd_bytes, hashed_password=hash_bytes)

class UserProfile(BaseModel):
    model_config = ConfigDict(extra='allow')

class User(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    created_at: datetime
    modified_at: datetime
    active: bool
    profile: Optional[UserProfile]
    permissions: ClientPermissions = Field(exclude=True)

class UserInDB(DBModel, AsyncAttrs, AsyncSessionMixin):
    __tablename__ = 'user'

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, index=True)
    name: Mapped[str] = mapped_column(unique=True, nullable=False, index=True)
    password_hash: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    modified_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
    active: Mapped[bool] = mapped_column(default=False)
    profile: Mapped[UserProfile] = mapped_column(ModelJson(UserProfile))

    _permissions: Mapped[Set[PermissionInDB]] = relationship(back_populates='user', lazy='joined')

    def __repr__(self) -> str:
        return f"<User[{self.id}]: {self.name}>"

    @property
    def permissions(self) -> ClientPermissions:
        return {
                Permission(object_id=p.object_id, object_type=p.object_type, role=p.role)
                for p in self._permissions
                }

    async def set_password(self, db: AsyncSession, password: str):
        new_hash = password_hash(password)
        log.info(f"Setting user {self} password_hash={new_hash}")
        self.password_hash = new_hash
        db.add(self)
        await db.flush()

    async def grant_permission(self, db: AsyncSession, perm: Permission):
        db.add(PermissionInDB(
            user=self,
            object_type=perm.object_type,
            object_id=perm.object_id,
            role=perm.role
            ))

        await db.flush()


async def get_user_db(db: DBSessionDep, name: str):
    user = await db.scalar(select(UserInDB).where(UserInDB.name == name))
    if not user:
        raise NotFoundError(f"User {name} not found")
    return user

async def get_user(db: DBSessionDep, name: str):
    user = await get_user_db(db, name)
    return User.model_validate(user)

async def authenticate_user(db: DBSessionDep, username: str, password: str):
    user = await get_user_db(db, username)
    if not user:
        return None
    if not password_verify(password, user.password_hash):
        return None
    return user

async def create_user(db: DBSessionDep, name: str, password: str) -> User:
    user = UserInDB(
            name=name,
            password_hash=password_hash(password),
            active=True
            )
    db.add(user)
    await db.flush()
    return user
