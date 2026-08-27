"""File-based dedup: tracks which PRs have already been reviewed."""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path

logger = logging.getLogger(__name__)


class DeduplicateStore:
    """JSON-backed set of PR URLs already dispatched for review.

    Format: {"<pr_url>": <epoch_timestamp>, ...}
    """

    def __init__(self, path: str | Path, prune_days: int = 30) -> None:
        self._path = Path(path).expanduser()
        self._prune_seconds = prune_days * 86400
        self._data: dict[str, float] = {}
        self._load()

    def _load(self) -> None:
        if self._path.exists():
            try:
                with open(self._path, encoding="utf-8") as f:
                    self._data = json.load(f)
            except (json.JSONDecodeError, OSError) as exc:
                logger.warning("Failed to load seen.json: %s", exc)
                self._data = {}

    def _save(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with open(self._path, "w", encoding="utf-8") as f:
            json.dump(self._data, f)

    def is_seen(self, pr_url: str) -> bool:
        return pr_url in self._data

    def mark_seen(self, pr_url: str) -> None:
        self._data[pr_url] = time.time()
        self._save()

    def prune(self) -> int:
        """Remove entries older than prune_days. Returns count removed."""
        cutoff = time.time() - self._prune_seconds
        stale = [k for k, ts in self._data.items() if ts < cutoff]
        for k in stale:
            del self._data[k]
        if stale:
            self._save()
            logger.info("Pruned %d stale entries from seen.json", len(stale))
        return len(stale)
