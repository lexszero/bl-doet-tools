#!/usr/bin/env python3
from typing import Optional

import asyncstdlib as a
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from common.db_async import DBSessionDep
from common.errors import AuthError
from core.auth import OptionalUserDep
from core.data_api import router as data_api_router
from core.project import list_projects
from core.user import User
from core.user_api import router as user_api_router
from core.project_api import router as project_api_router
from power_map.api import router as power_map_api_router

from power_map.map_layers import *

app = FastAPI(
    title="BL DoET data service"
        )

app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        )

@app.exception_handler(AuthError)
async def auth_error_handler(request, exc: AuthError):
    response = JSONResponse(exc.detail, status_code=exc.status_code)
    response.headers.append('WWW-Authorization', f'Bearer error="{exc.code}" error_description="{exc.description}"')
    return response

@app.exception_handler(HTTPException)
async def error_handler(request, exc: HTTPException):
    return JSONResponse(exc.detail, status_code=exc.status_code)

@app.get("/ping")
async def ping():
    return {
            "result": "pong"
            }

app.include_router(power_map_api_router,
                   prefix="/{project_name}/power_map")
app.include_router(project_api_router,
                   prefix="/{project_name}")
app.include_router(data_api_router,
                   prefix="/{project_name}/data")
app.include_router(user_api_router,
                   prefix="/_auth")

class Info(BaseModel):
    user: Optional[User]
    projects: list[str]

@app.get("/info")
async def info(db: DBSessionDep, user: OptionalUserDep):
    pp = await a.list(await list_projects(db, user and user.id))
    projects = [p.name for p in pp]
    return Info(
            user=user,
            projects=projects
            )

if __name__ == '__main__':
    uvicorn.run(app)
