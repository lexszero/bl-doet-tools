from enum import Enum
from typing import Any, Set

from pydantic import BaseModel, ConfigDict, TypeAdapter
from pydantic_core.core_schema import frozenset_schema
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from common.db_async import DBModel

class Role(str, Enum):
    Owner = 'owner'
    Admin = 'admin'
    Editor = 'editor'
    Viewer = 'view'
    Guest = 'guest'

class Permission(BaseModel, frozen=True):
    object_type: str
    object_id: str
    role: Role

    def __eq__(self, other):
        return ((self.object_type == other.object_type) and
                (self.object_id == other.object_id or
                    self.object_id == '*' or
                    other.object_id == '*') and
                (self.role == other.role or
                    self.role == '*' or
                    other.role == '*'))

    def __ne__(self, other):
        return not self.__eq__(other)

    def __str__(self):
        return f"{self.object_type}:{self.object_id}:{self.role.value}"

    def __repr__(self):
        return '<Perm: ' + str(self) + '>'

    def __pretty__(self, fmt, **kwargs):
        yield self.__repr__()

ClientPermissions = frozenset[Permission]

def get_roles(perms: ClientPermissions, object_type: str, object_id: Any) -> Set[Role]:
    object_id_str = str(object_id)
    return set([p.role for p in perms if p.object_type == object_type and p.object_id == object_id_str])


class PermissionInDB(DBModel):
    __tablename__ = 'permission'

    user_id: Mapped[int] = mapped_column(ForeignKey('user.id'), primary_key=True)
    object_type: Mapped[str] = mapped_column(nullable=False, primary_key=True)
    object_id: Mapped[str] = mapped_column(nullable=False, primary_key=True)
    role: Mapped[Role] = mapped_column(nullable=False, primary_key=True)

    user: Mapped['UserInDB'] = relationship(back_populates='_permissions')

    def __repr__(self):
        return f"<Perm: {self.user.name} / {self.object_type}:{self.object_id}:{self.role}>"
