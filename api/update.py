#!/usr/bin/env python3
import asyncio
from power_map.data_bl25 import PowerGrid_BL25
from power_map.updater import Updater

updater = Updater('admin', 'bl25', PowerGrid_BL25)
asyncio.run(updater.run())
