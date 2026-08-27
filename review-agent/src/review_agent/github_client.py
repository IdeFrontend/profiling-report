"""GitHub API client: PR context extraction + review publishing."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from .models import Comment, FileChange, InlineComment, PRContext, ReviewResult

logger = logging.getLogger(__name__)

_API = "https://api.github.com"
_RETRY_STATUSES = {403, 429, 500, 502, 503}
_MAX_RETRIES = 3


class GitHubClient:
    """Thin async wrapper around GitHub REST API for PR operations."""

    def __init__(self, token: str) -> None:
        self._headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        self._client = httpx.AsyncClient(
            headers=self._headers, timeout=30.0
        )

    async def close(self) -> None:
        await self._client.aclose()

    # -- internal helpers --------------------------------------------------

    async def _get(
        self, url: str, *, accept: str | None = None
    ) -> httpx.Response:
        headers = {"Accept": accept} if accept else {}
        backoff = 1.0
        for attempt in range(_MAX_RETRIES):
            resp = await self._client.get(url, headers=headers)
            if resp.status_code not in _RETRY_STATUSES:
                resp.raise_for_status()
                return resp
            logger.warning(
                "GitHub API %s returned %d (attempt %d/%d)",
                url, resp.status_code, attempt + 1, _MAX_RETRIES,
            )
            if attempt < _MAX_RETRIES - 1:
                import asyncio
                await asyncio.sleep(backoff)
                backoff *= 2
        resp.raise_for_status()
        return resp  # unreachable but keeps mypy happy

    async def _post(self, url: str, json: Any) -> httpx.Response:
        backoff = 1.0
        for attempt in range(_MAX_RETRIES):
            resp = await self._client.post(url, json=json)
            if resp.status_code not in _RETRY_STATUSES:
                resp.raise_for_status()
                return resp
            logger.warning(
                "GitHub API POST %s returned %d (attempt %d/%d)",
                url, resp.status_code, attempt + 1, _MAX_RETRIES,
            )
            if attempt < _MAX_RETRIES - 1:
                import asyncio
                await asyncio.sleep(backoff)
                backoff *= 2
        resp.raise_for_status()
        return resp

    # -- PR context extraction ---------------------------------------------

    async def get_pr_context(self, repo: str, pr_number: int) -> PRContext:
        """Fetch full PR context (5 API calls)."""
        base = f"{_API}/repos/{repo}/pulls/{pr_number}"

        # 1. PR metadata
        pr_resp = await self._get(base)
        pr = pr_resp.json()

        # 2. Full diff
        diff_resp = await self._get(
            base, accept="application/vnd.github.v3.diff"
        )
        diff = diff_resp.text

        # 3. Files
        files_resp = await self._get(f"{base}/files")
        files = [
            FileChange(
                path=f["filename"],
                status=f["status"],
                patch=f.get("patch", ""),
                additions=f.get("additions", 0),
                deletions=f.get("deletions", 0),
                previous_path=f.get("previous_filename"),
            )
            for f in files_resp.json()
        ]

        # 4. Review comments (inline)
        review_comments_resp = await self._get(f"{base}/comments")
        comments: list[Comment] = [
            Comment(
                author=c["user"]["login"],
                body=c["body"],
                path=c.get("path"),
                line=c.get("line"),
                created_at=c["created_at"],
            )
            for c in review_comments_resp.json()
        ]

        # 5. Issue comments (top-level)
        issue_url = f"{_API}/repos/{repo}/issues/{pr_number}/comments"
        issue_comments_resp = await self._get(issue_url)
        comments.extend(
            Comment(
                author=c["user"]["login"],
                body=c["body"],
                created_at=c["created_at"],
            )
            for c in issue_comments_resp.json()
        )

        return PRContext(
            repo=repo,
            pr_number=pr_number,
            title=pr["title"],
            description=pr.get("body") or "",
            author=pr["user"]["login"],
            base_branch=pr["base"]["ref"],
            head_branch=pr["head"]["ref"],
            head_sha=pr["head"]["sha"],
            diff=diff,
            files=files,
            existing_comments=comments,
            labels=[lb["name"] for lb in pr.get("labels", [])],
            url=pr["html_url"],
        )

    # -- review publishing -------------------------------------------------

    async def publish_review(
        self, repo: str, pr_number: int, result: ReviewResult,
        *, valid_paths: set[str] | None = None,
    ) -> None:
        """Post a review to a PR.  Drops inline comments with bad paths."""
        url = f"{_API}/repos/{repo}/pulls/{pr_number}/reviews"

        comments_payload: list[dict] = []
        for c in result.comments:
            if valid_paths and c.path not in valid_paths:
                logger.warning(
                    "Dropping comment on invalid path %s (not in PR files)",
                    c.path,
                )
                continue
            comments_payload.append({
                "path": c.path,
                "line": c.line,
                "body": c.body,
                "side": c.side,
            })

        body: dict[str, Any] = {
            "event": result.verdict,
            "body": result.body,
        }
        if comments_payload:
            body["comments"] = comments_payload

        await self._post(url, json=body)
        logger.info(
            "Published review on %s#%d: %s (%d inline comments)",
            repo, pr_number, result.verdict, len(comments_payload),
        )

    async def reply_to_comment(
        self, repo: str, pr_number: int,
        comment_id: int, body: str,
    ) -> None:
        """Reply to an existing inline review comment thread."""
        url = (
            f"{_API}/repos/{repo}/pulls/{pr_number}"
            f"/comments/{comment_id}/replies"
        )
        await self._post(url, json={"body": body})
