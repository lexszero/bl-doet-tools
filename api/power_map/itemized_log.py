from dataclasses import dataclass
import logging
from typing import Optional

from pydantic import BaseModel, validator

@dataclass
class ItemizedLogEntry:
    item_id: Optional[str]
    level: int
    message: str

class ItemizedLogCollector:
    entries: list[ItemizedLogEntry]

    def __init__(self, logger: logging.Logger):
        self.entries = []
        self.logger = logger

    def _add_entry(self, item_id: Optional[str], level: int, message: str):
        self.logger.log(level, f"{item_id}: {message}")
        self.entries.append(ItemizedLogEntry(item_id, level, message))

    def debug(self, item_id: Optional[str], message: str):
        self._add_entry(item_id, logging.DEBUG, message)

    def info(self, item_id: Optional[str], message: str):
        self._add_entry(item_id, logging.INFO, message)

    def warning(self, item_id: Optional[str], message: str):
        self._add_entry(item_id, logging.WARNING, message)

    def error(self, item_id: Optional[str], message: str):
        self._add_entry(item_id, logging.ERROR, message)


