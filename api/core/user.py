from devtools import debug
from enum import Enum
from datetime import datetime
from typing import Set
from numpy import select
from pydantic import ConfigDict
from sqlalchemy import ForeignKey, select
from sqlalchemy.sql import func
from sqlalchemy.orm import Mapped, Session, mapped_column, relationship

from common.errors import NotFoundError
from common.db_async import AsyncSession, DBSessionDep, DBModel
from common.model_utils import BaseModel, ModelJson

class UserProfile(BaseModel):
    model_config = ConfigDict(extra='allow')

class User(DBModel):
    __tablename__ = 'user'

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, index=True)
    name: Mapped[str] = mapped_column(unique=True, nullable=False, index=True)
    password_hash: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    modified_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
    active: Mapped[bool] = mapped_column(default=False)
    profile: Mapped[UserProfile] = mapped_column(ModelJson(UserProfile))

    permissions: Mapped[Set['Permission']] = relationship(back_populates='user')

    def __repr__(self) -> str:
        return f"<User[{self.id}]: {self.name}>"

class UserRole(str, Enum):
    Owner = 'owner'
    Admin = 'admin'
    Editor = 'editor'
    Viewer = 'view'

class Permission(DBModel):
    __tablename__ = 'permission'

    user_id: Mapped[int] = mapped_column(ForeignKey('user.id'), primary_key=True)
    object_type: Mapped[str] = mapped_column(nullable=False, primary_key=True)
    object_id: Mapped[str] = mapped_column(nullable=False, primary_key=True)
    role: Mapped[UserRole] = mapped_column(nullable=False, primary_key=True)

    user: Mapped['User'] = relationship(back_populates='permissions')

    def __repr__(self):
        return f"<Perm: {self.user.name} / {self.object_type}:{self.object_id}:{self.role}>"

async def get_user(db: DBSessionDep, name: str) -> User:
    result = await db.scalar(select(User).where(User.name == name))
    if not result:
        raise NotFoundError(f"User {name} not found")
    return result

async def create_user(db: DBSessionDep, name: str, password: str) -> User:
    user = User(
            name=name,
            password_hash='',
            active=True
            )
    db.add(user)
    await db.flush()
    return user
