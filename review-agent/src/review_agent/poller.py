"""Polling loop: uses `gh` CLI to discover pending review requests."""

from __future__ import annotations

import asyncio
import json
import logging
import subprocess

logger = logging.getLogger(__name__)


async def poll_once(
    repos_filter: list[str] | None = None,
) -> list[dict]:
    """Run `gh search prs --review-requested=@me --state=open`.

    Returns list of {repo, pr_number, url} dicts.
    """
    cmd = [
        "gh", "search", "prs",
        "--review-requested=@me",
        "--state=open",
        "--json", "repository,number,url",
    ]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
    except FileNotFoundError:
        logger.error("gh CLI not found on PATH — polling unavailable")
        return []

    if proc.returncode != 0:
        logger.error("gh search prs failed: %s", stderr.decode().strip())
        return []

    try:
        items = json.loads(stdout)
    except json.JSONDecodeError:
        logger.error("Failed to parse gh output")
        return []

    results = []
    for item in items:
        repo_name = item.get("repository", {}).get("nameWithOwner", "")
        if repos_filter and repo_name not in repos_filter:
            continue
        results.append({
            "repo": repo_name,
            "pr_number": item["number"],
            "url": item["url"],
        })

    logger.info("Poll found %d pending review requests", len(results))
    return results


async def polling_loop(
    interval: int,
    repos_filter: list[str] | None,
    callback,  # async callable(repo, pr_number, url)
) -> None:
    """Run poll_once in a loop, invoking callback for each new PR."""
    while True:
        try:
            prs = await poll_once(repos_filter)
            for pr in prs:
                await callback(pr["repo"], pr["pr_number"], pr["url"])
        except Exception:
            logger.exception("Polling loop error")
        await asyncio.sleep(interval)
