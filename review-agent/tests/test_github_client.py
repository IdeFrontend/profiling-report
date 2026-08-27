"""Tests for GitHubClient context extraction and review publishing."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock

import httpx
import pytest

from review_agent.github_client import GitHubClient
from review_agent.models import InlineComment, ReviewResult


# -- helpers ----------------------------------------------------------------

def _mock_response(data=None, text="", status_code=200):
    """Create a fake httpx.Response."""
    kwargs: dict = {
        "status_code": status_code,
        "request": httpx.Request("GET", "https://api.github.com/test"),
    }
    if data is not None:
        kwargs["json"] = data
    else:
        kwargs["text"] = text
    return httpx.Response(**kwargs)


_PR_JSON = {
    "title": "Fix bug",
    "body": "Fixes #123",
    "user": {"login": "alice"},
    "base": {"ref": "main"},
    "head": {"ref": "fix-bug", "sha": "abc123"},
    "html_url": "https://github.com/owner/repo/pull/1",
    "labels": [{"name": "bug"}],
}

_FILES_JSON = [
    {
        "filename": "src/foo.ts",
        "status": "modified",
        "patch": "@@ -1,3 +1,4 @@\n+fix",
        "additions": 1,
        "deletions": 0,
    },
]

_REVIEW_COMMENTS_JSON = [
    {
        "user": {"login": "bob"},
        "body": "LGTM",
        "path": "src/foo.ts",
        "line": 1,
        "created_at": "2024-01-01T00:00:00Z",
    },
]

_ISSUE_COMMENTS_JSON = [
    {
        "user": {"login": "charlie"},
        "body": "Please review",
        "created_at": "2024-01-01T00:00:00Z",
    },
]

_DIFF_TEXT = "diff --git a/src/foo.ts b/src/foo.ts\n--- a/src/foo.ts\n+++ b/src/foo.ts\n@@ -1,3 +1,4 @@\n+fix\n"


class TestGetPRContext:
    @pytest.fixture()
    def client(self):
        c = GitHubClient("fake-token")
        return c

    @pytest.mark.asyncio
    async def test_extracts_full_context(self, client):
        calls = []

        async def mock_get(url, *, accept=None, **kw):
            calls.append(url)
            if accept and "diff" in accept:
                return _mock_response(text=_DIFF_TEXT)
            if "/files" in url:
                return _mock_response(data=_FILES_JSON)
            if "/pulls/" in url and "/comments" in url:
                return _mock_response(data=_REVIEW_COMMENTS_JSON)
            if "/issues/" in url:
                return _mock_response(data=_ISSUE_COMMENTS_JSON)
            return _mock_response(data=_PR_JSON)

        client._get = mock_get

        ctx = await client.get_pr_context("owner/repo", 1)

        assert ctx.repo == "owner/repo"
        assert ctx.pr_number == 1
        assert ctx.title == "Fix bug"
        assert ctx.author == "alice"
        assert ctx.head_sha == "abc123"
        assert len(ctx.files) == 1
        assert ctx.files[0].path == "src/foo.ts"
        assert len(ctx.existing_comments) == 2  # 1 review + 1 issue
        assert "fix" in ctx.diff
        assert ctx.labels == ["bug"]


class TestPublishReview:
    @pytest.fixture()
    def client(self):
        return GitHubClient("fake-token")

    @pytest.mark.asyncio
    async def test_posts_review(self, client):
        posted = []

        async def mock_post(url, *, json, **kw):
            posted.append({"url": url, "json": json})
            return _mock_response(data={}, status_code=200)

        client._post = mock_post

        result = ReviewResult(
            verdict="COMMENT",
            body="Looks good overall",
            comments=[
                InlineComment(path="src/foo.ts", line=1, body="Nice"),
            ],
        )

        await client.publish_review(
            "owner/repo", 1, result,
            valid_paths={"src/foo.ts"},
        )

        assert len(posted) == 1
        assert posted[0]["json"]["event"] == "COMMENT"
        assert len(posted[0]["json"]["comments"]) == 1

    @pytest.mark.asyncio
    async def test_drops_invalid_paths(self, client):
        posted = []

        async def mock_post(url, *, json, **kw):
            posted.append(json)
            return _mock_response(data={})

        client._post = mock_post

        result = ReviewResult(
            verdict="COMMENT",
            body="Review",
            comments=[
                InlineComment(path="nonexistent.ts", line=1, body="Bad"),
                InlineComment(path="src/foo.ts", line=1, body="Good"),
            ],
        )

        await client.publish_review(
            "owner/repo", 1, result,
            valid_paths={"src/foo.ts"},
        )

        assert len(posted[0]["comments"]) == 1
        assert posted[0]["comments"][0]["path"] == "src/foo.ts"
