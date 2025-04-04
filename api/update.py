#!/usr/bin/env python3
import asyncio
from power_map.updater import Updater

from power_map.data_bl25 import PowerGrid_BL25
updater = Updater('admin', 'bl25', PowerGrid_BL25)

#from power_map.data_bl25_test import PowerGrid_BL25_Test
#updater = Updater('admin', 'bl25_test', PowerGrid_BL25_Test)

asyncio.run(updater.run())


