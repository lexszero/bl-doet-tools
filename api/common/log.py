import os, logging

from common.settings import settings

# Configure logging
logging.basicConfig(level=settings.log_level)

root_logger = logging.getLogger()
root_logger.setLevel(settings.log_level)
Log = logging.getLogger("uvicorn.error")
print(__name__)
if 'IS_OFFLINE' in os.environ:
    try:
        import coloredlogs
        coloredlogs.DEFAULT_FIELD_STYLES = {
                'asctime': {'color': 'white'},
                'hostname': {'color': 'cyan'},
                'levelname': {'bold': True, 'color': 'black'},
                'name': {'color': 207, 'bold': True},
                'programname': {'color': 'cyan'},
                'username': {'color': 'yellow'},
                }
        coloredlogs.install(
                isatty=True,
                level=settings.log_level,
                fmt = '%(asctime)s %(levelname)s %(name)s: %(message)s',
                datefmt = '%H:%M:%S')
    except Exception as e:
        Log.warning("IS_OFFLINE, but no coloredlogs")

# Silence libs a bit
logging.getLogger('sqlalchemy').setLevel(logging.WARNING)
