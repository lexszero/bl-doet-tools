from power_map.data_bl24 import PowerGrid_BL24

class PowerGrid_BL24_Test(PowerGrid_BL24):
    OFFLINE = False

    #KML_FILENAME = os.path.dirname(__file__)+'/data/bl25_grid.kml'

    PLACEMENT_ENTITIES_URL = 'https://robnowa.runasp.net/api/v1/mapentities'
    PLACEMENT_ENTITIES_INCREMENTAL = True
