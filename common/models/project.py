from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.ext.associationproxy import association_proxy
from sqlalchemy.orm import relationship, backref
from sqlalchemy.orm.collections import attribute_mapped_collection

from common.db import Base
from common.model_utils import ModelJson

from common.models.user import User

class ProjectData(BaseModel):
    name: str

class Project(Base):
    __tablename__ = 'project'

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, unique=True)
    data = Column(ModelJson(ProjectData), default={})

    users = association_proxy('project_permissions', 'user',
                                creator=lambda k, v: ProjectPermission(user=k, role=v))

class ProjectPermission(Base):
    __tablename__ = 'project_permissions'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('user.id'), primary_key=True)
    project_id = Column(Integer, ForeignKey('project.id'), primary_key=True)
    role = Column(String, nullable=False)

    project = relationship(Project,
                           backref = backref('project_permissions', cascade='all, delete-orphan')
                           )

    user = relationship(
            User,
            backref=backref('project_permissions', cascade='all, delete-orphan')
            )

    def __init__(self, project=None, user=None, role=None):
        self.project = project
        self.user = user
        self.role = role
