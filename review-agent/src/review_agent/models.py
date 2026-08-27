"""Data models shared across the review-agent service.

Matches the architecture spec (architecture.md §Components).
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class FileChange:
    path: str
    status: str  # "added" | "modified" | "removed" | "renamed"
    patch: str  # per-file diff hunk
    additions: int = 0
    deletions: int = 0
    previous_path: str | None = None  # for renames


@dataclass
class Comment:
    author: str
    body: str
    path: str | None = None  # None for top-level PR comments
    line: int | None = None
    created_at: str = ""


@dataclass
class PRContext:
    repo: str  # "owner/repo"
    pr_number: int
    title: str
    description: str  # PR body markdown
    author: str
    base_branch: str
    head_branch: str
    head_sha: str
    diff: str  # full unified diff
    files: list[FileChange] = field(default_factory=list)
    existing_comments: list[Comment] = field(default_factory=list)
    labels: list[str] = field(default_factory=list)
    url: str = ""


@dataclass
class InlineComment:
    path: str  # file path relative to repo root
    line: int  # line number in the diff (new-file side)
    body: str
    side: str = "RIGHT"  # "RIGHT" (default) or "LEFT"


@dataclass
class ReviewResult:
    verdict: str  # "APPROVE" | "REQUEST_CHANGES" | "COMMENT"
    body: str  # overall review summary
    comments: list[InlineComment] = field(default_factory=list)
