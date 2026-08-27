"""Abstract base for review agent adapters."""

from __future__ import annotations

from abc import ABC, abstractmethod

from ..models import PRContext, ReviewResult


class ReviewAgent(ABC):
    """Base class for all review agent adapters."""

    @abstractmethod
    async def review(self, context: PRContext) -> ReviewResult:
        """Run a code review and return structured results."""
        ...
