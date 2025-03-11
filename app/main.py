#!/usr/bin/env python3
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import uvicorn

from power_map.api import power_map_api

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

app.include_router(power_map_api,
                   prefix="/power_map")

if __name__ == '__main__':
    uvicorn.run(app)
