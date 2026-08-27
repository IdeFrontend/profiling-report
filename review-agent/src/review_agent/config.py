"""Config loading: YAML file + env var overrides."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

import yaml


_DEFAULT_CONFIG_PATH = Path("~/.config/review-agent/config.yaml").expanduser()


@dataclass
class GithubConfig:
    token: str = ""
    repos: list[str] = field(default_factory=list)
    reviewer: str = "@me"


@dataclass
class WebhookConfig:
    enabled: bool = False
    port: int = 8080
    host: str = "0.0.0.0"
    secret: str = ""


@dataclass
class PollingConfig:
    enabled: bool = True
    interval_seconds: int = 120


@dataclass
class AgentConfig:
    name: str = "claude-code"
    timeout_seconds: int = 300


@dataclass
class ReviewConfig:
    auto_approve: bool = False
    max_diff_size: int = 100_000
    skip_drafts: bool = True
    prompt_prefix: str = ""


@dataclass
class StateConfig:
    path: str = "~/.config/review-agent/seen.json"
    prune_days: int = 30


@dataclass
class LoggingConfig:
    level: str = "INFO"
    file: str = "~/.config/review-agent/logs/review-agent.log"
    max_bytes: int = 10_485_760
    backup_count: int = 5


@dataclass
class Config:
    github: GithubConfig = field(default_factory=GithubConfig)
    webhook: WebhookConfig = field(default_factory=WebhookConfig)
    polling: PollingConfig = field(default_factory=PollingConfig)
    agent: AgentConfig = field(default_factory=AgentConfig)
    review: ReviewConfig = field(default_factory=ReviewConfig)
    state: StateConfig = field(default_factory=StateConfig)
    logging: LoggingConfig = field(default_factory=LoggingConfig)


def _apply_dict(obj: object, d: dict) -> None:
    """Shallow-merge dict keys into a dataclass instance."""
    for k, v in d.items():
        if hasattr(obj, k):
            setattr(obj, k, v)


def load_config(path: str | Path | None = None) -> Config:
    """Load config from YAML, then overlay env vars."""
    p = Path(path) if path else Path(
        os.environ.get("REVIEW_AGENT_CONFIG", str(_DEFAULT_CONFIG_PATH))
    )

    cfg = Config()

    if p.exists():
        with open(p, encoding="utf-8") as f:
            raw = yaml.safe_load(f) or {}
        for section_name in ("github", "webhook", "polling", "agent",
                             "review", "state", "logging"):
            if section_name in raw:
                _apply_dict(getattr(cfg, section_name), raw[section_name])

    # Env var overrides (secrets)
    if token := os.environ.get("GITHUB_TOKEN"):
        cfg.github.token = token
    if secret := os.environ.get("WEBHOOK_SECRET"):
        cfg.webhook.secret = secret

    return cfg
