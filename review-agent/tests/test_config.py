"""Tests for config loading."""

from __future__ import annotations

import os

import pytest

from review_agent.config import load_config


class TestConfigLoad:
    def test_defaults(self, tmp_path):
        """Loading a nonexistent file returns defaults."""
        cfg = load_config(tmp_path / "nope.yaml")
        assert cfg.webhook.port == 8080
        assert cfg.polling.enabled is True
        assert cfg.polling.interval_seconds == 120
        assert cfg.github.token == ""

    def test_yaml_file(self, tmp_path):
        p = tmp_path / "config.yaml"
        p.write_text(
            "github:\n  token: ghp_test\nwebhook:\n  enabled: true\n  port: 9090\n"
        )
        cfg = load_config(p)
        assert cfg.github.token == "ghp_test"
        assert cfg.webhook.enabled is True
        assert cfg.webhook.port == 9090

    def test_env_override(self, tmp_path, monkeypatch):
        p = tmp_path / "config.yaml"
        p.write_text("github:\n  token: from-file\n")
        monkeypatch.setenv("GITHUB_TOKEN", "from-env")
        cfg = load_config(p)
        assert cfg.github.token == "from-env"

    def test_webhook_secret_env(self, tmp_path, monkeypatch):
        monkeypatch.setenv("WEBHOOK_SECRET", "s3cret")
        cfg = load_config(tmp_path / "nope.yaml")
        assert cfg.webhook.secret == "s3cret"
