#!/usr/bin/env python3
import asyncio
from power_map.updater import Updater
from power_map.data_bl24 import PowerGrid_BL24
from power_map.data_bl25 import PowerGrid_BL25
from power_map.data_bl25_test import PowerGrid_BL25_Test

update_projects = {
        'bl24': PowerGrid_BL24,
        'bl25': PowerGrid_BL25,
        'bl25_test': PowerGrid_BL25_Test
        }

async def update_all():
    for project_name, loader in update_projects.items():
        updater = Updater('admin', project_name, loader)
        await updater.run()

asyncio.run(update_all())


