"""CLI entry point for review-agent."""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from typing import Any

import uvicorn

from .config import load_config, Config
from .dedup import DeduplicateStore
from .github_client import GitHubClient
from .poller import polling_loop
from .webhook import create_app


def _setup_logging(cfg: Config) -> None:
    from pathlib import Path
    from logging.handlers import RotatingFileHandler

    level = getattr(logging, cfg.logging.level.upper(), logging.INFO)
    fmt = logging.Formatter(
        "%(asctime)s %(levelname)s %(name)s: %(message)s"
    )

    root = logging.getLogger("review_agent")
    root.setLevel(level)

    # stdout handler
    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(fmt)
    root.addHandler(sh)

    # file handler
    log_path = Path(cfg.logging.file).expanduser()
    log_path.parent.mkdir(parents=True, exist_ok=True)
    fh = RotatingFileHandler(
        log_path, maxBytes=cfg.logging.max_bytes,
        backupCount=cfg.logging.backup_count,
    )
    fh.setFormatter(fmt)
    root.addHandler(fh)


async def _handle_event(
    event_type: str, payload: dict[str, Any],
    dedup: DeduplicateStore, client: GitHubClient, cfg: Config,
) -> None:
    """Process a webhook event: dedup → extract → log (agent routing is a sibling task)."""
    logger = logging.getLogger("review_agent.handler")

    pr_data = payload.get("pull_request", {})
    repo = pr_data.get("base", {}).get("repo", {}).get("full_name", "")
    pr_number = pr_data.get("number", 0)
    url = pr_data.get("html_url", "")

    if not repo or not pr_number:
        logger.warning("Malformed payload — missing repo/pr_number")
        return

    await _process_pr(repo, pr_number, url, dedup, client, cfg)


async def _process_pr(
    repo: str, pr_number: int, url: str,
    dedup: DeduplicateStore, client: GitHubClient, cfg: Config,
) -> None:
    logger = logging.getLogger("review_agent.handler")

    if dedup.is_seen(url):
        logger.debug("Already seen %s — skipping", url)
        return

    if cfg.github.repos and repo not in cfg.github.repos:
        logger.debug("Repo %s not in filter — skipping", repo)
        return

    logger.info("Processing %s#%d", repo, pr_number)

    ctx = await client.get_pr_context(repo, pr_number)

    if cfg.review.skip_drafts and ctx.description.startswith("[WIP]"):
        logger.info("Skipping draft PR %s#%d", repo, pr_number)
        return

    if len(ctx.diff) > cfg.review.max_diff_size:
        logger.warning(
            "Diff too large (%d chars) for %s#%d — skipping",
            len(ctx.diff), repo, pr_number,
        )
        return

    # ponytail: agent routing is t_c13b61af's responsibility.
    # For now, log the extracted context as proof of successful extraction.
    logger.info(
        "Extracted context for %s#%d: %d files, %d existing comments, "
        "diff %d chars",
        repo, pr_number, len(ctx.files),
        len(ctx.existing_comments), len(ctx.diff),
    )

    # Mark as seen after successful extraction
    dedup.mark_seen(url)


def main() -> None:
    parser = argparse.ArgumentParser(description="review-agent service")
    parser.add_argument(
        "-c", "--config", help="Path to config YAML", default=None
    )
    parser.add_argument(
        "--mode", choices=["webhook", "poll", "both"], default="both",
        help="Run mode (default: both)",
    )
    args = parser.parse_args()

    cfg = load_config(args.config)

    if not cfg.github.token:
        print("Error: GITHUB_TOKEN env var or github.token in config required",
              file=sys.stderr)
        sys.exit(1)

    _setup_logging(cfg)
    logger = logging.getLogger("review_agent")

    dedup = DeduplicateStore(cfg.state.path, cfg.state.prune_days)
    dedup.prune()
    client = GitHubClient(cfg.github.token)

    run_webhook = args.mode in ("webhook", "both") and cfg.webhook.enabled
    run_poll = args.mode in ("poll", "both") and cfg.polling.enabled

    if not run_webhook and not run_poll:
        print("Error: no mode enabled — enable webhook and/or polling in config",
              file=sys.stderr)
        sys.exit(1)

    async def on_webhook_event(event_type: str, payload: dict) -> None:
        await _handle_event(event_type, payload, dedup, client, cfg)

    async def on_poll_pr(repo: str, pr_number: int, url: str) -> None:
        await _process_pr(repo, pr_number, url, dedup, client, cfg)

    if run_webhook and not run_poll:
        # Webhook only
        app = create_app(cfg.webhook.secret, on_webhook_event)
        logger.info(
            "Starting webhook server on %s:%d",
            cfg.webhook.host, cfg.webhook.port,
        )
        uvicorn.run(app, host=cfg.webhook.host, port=cfg.webhook.port)

    elif run_poll and not run_webhook:
        # Polling only
        logger.info(
            "Starting polling loop (interval=%ds)",
            cfg.polling.interval_seconds,
        )
        asyncio.run(polling_loop(
            cfg.polling.interval_seconds,
            cfg.github.repos or None,
            on_poll_pr,
        ))

    else:
        # Both: run webhook server + polling loop concurrently
        app = create_app(cfg.webhook.secret, on_webhook_event)

        async def run_both() -> None:
            config = uvicorn.Config(
                app, host=cfg.webhook.host, port=cfg.webhook.port,
            )
            server = uvicorn.Server(config)
            await asyncio.gather(
                server.serve(),
                polling_loop(
                    cfg.polling.interval_seconds,
                    cfg.github.repos or None,
                    on_poll_pr,
                ),
            )

        logger.info(
            "Starting webhook (%s:%d) + polling (interval=%ds)",
            cfg.webhook.host, cfg.webhook.port, cfg.polling.interval_seconds,
        )
        asyncio.run(run_both())


if __name__ == "__main__":
    main()
