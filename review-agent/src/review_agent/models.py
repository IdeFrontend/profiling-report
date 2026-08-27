"""Data models for the review-agent service."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class FileChange:
    path: str
    status: str  # "added" | "modified" | "removed" | "renamed"
    patch: str  # per-file diff hunk
    additions: int = 0
    deletions: int = 0
    previous_path: str | None = None


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
    description: str
    author: str
    base_branch: str
    head_branch: str
    head_sha: str
    diff: str
    files: list[FileChange] = field(default_factory=list)
    existing_comments: list[Comment] = field(default_factory=list)
    labels: list[str] = field(default_factory=list)
    url: str = ""


@dataclass
class InlineComment:
    path: str
    line: int  # line number in the diff (new-file side)
    body: str
    side: str = "RIGHT"


@dataclass
class ReviewResult:
    verdict: str  # "APPROVE" | "REQUEST_CHANGES" | "COMMENT"
    body: str
    comments: list[InlineComment] = field(default_factory=list)
