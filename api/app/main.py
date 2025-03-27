#!/usr/bin/env python3
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import uvicorn

from core.data_api import router as data_api_router
from power_map.api import router as power_map_api_router

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

@app.get("/ping")
async def ping():
    return {
            "result": "pong"
            }

app.include_router(power_map_api_router,
                   prefix="/{project_name}/power_map")
app.include_router(data_api_router,
                   prefix="/{project_name}/data")

if __name__ == '__main__':
    uvicorn.run(app)
