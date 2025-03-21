import os, logging, platform

# Configure logging
loglevel = {
        'DEBUG': logging.DEBUG,
        'INFO': logging.INFO,
        'WARN': logging.WARNING,
        'ERROR': logging.ERROR
        }.get(os.environ.get('LOG_LEVEL', 'INFO'))
logging.basicConfig(level=loglevel)

STAGE = os.getenv('STAGE', 'unknown')
if os.getenv('IS_OFFLINE'):
    STAGE += '-local@' + platform.node()

root_logger = logging.getLogger()
root_logger.setLevel(loglevel)
Log = logging.getLogger("uvicorn.error")
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
                level=loglevel,
                fmt = '%(asctime)s %(levelname)s %(name)s: %(message)s',
                datefmt = '%H:%M:%S')
    except Exception as e:
        Log.warning("IS_OFFLINE, but no coloredlogs")
else:
    fmt = (
        '%(asctime)s.%(msecs)3d (Z)\t%(aws_request_id)s\t'
        '[%(name)s:%(funcName)s]\t[%(levelname)s]\t%(message)s\n'
    )
    datefmt = '%Y-%m-%d %H:%M:%S'
    for hand in root_logger.handlers:
        hand.setFormatter(logging.Formatter(
            "%(levelname)s %(name)s: %(message)s",
            "%Y-%m-%d %H:%M:%S"))


# Silence libs a bit
logging.getLogger('sqlalchemy').setLevel(logging.WARNING)
