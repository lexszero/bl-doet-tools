from datetime import datetime, timezone, tzinfo
from dateutil import tz
from typing import Annotated, Any, Optional

from pydantic import PlainValidator

def datetime_with_timezone_validator(tz: Optional[tzinfo] = timezone.utc):
    if not tz:
        tz = timezone.utc
    def validate_timestamp(value: Any) -> datetime:
        if isinstance(value, int):
            return datetime.fromtimestamp(value, tz=tz)
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value).replace(tzinfo=tz)
            except ValueError:
                return datetime.fromtimestamp(int(value), tz=tz)
        else:
            raise ValueError("unable to parse timestamp")
    return validate_timestamp

timezone_cet = tz.gettz('UTC+2')

datetime_utc = Annotated[datetime, PlainValidator(datetime_with_timezone_validator(timezone.utc))]
datetime_cet = Annotated[datetime, PlainValidator(datetime_with_timezone_validator(tz.gettz('UTC+2')))]
