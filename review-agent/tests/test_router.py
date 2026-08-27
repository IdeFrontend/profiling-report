"""Tests for the agent router (config-based adapter selection)."""

from unittest.mock import AsyncMock, patch

import pytest

from review_agent.router import AgentRouter, ADAPTER_REGISTRY
from review_agent.adapters.claude_code import ClaudeCodeAdapter
from review_agent.adapters.generic import GenericAdapter
from review_agent.adapters.hermes import HermesAdapter
from review_agent.adapters.opencode import OpenCodeAdapter
from review_agent.models import ReviewResult, InlineComment


def test_from_config_claude_code():
    """Default agent is claude-code."""
    router = AgentRouter.from_config({
        "name": "claude-code",
        "timeout_seconds": 120,
        "claude_code": {"binary": "/usr/bin/claude", "model": "test-model"},
    })
    assert router.name == "claude-code"
    assert isinstance(router.agent, ClaudeCodeAdapter)
    assert router.agent.config.binary == "/usr/bin/claude"
    assert router.agent.config.model == "test-model"
    assert router.agent.timeout == 120.0


def test_from_config_generic():
    """Generic adapter with command template."""
    router = AgentRouter.from_config({
        "name": "generic",
        "generic": {"command": "python review.py --diff {diff_file}"},
    })
    assert router.name == "generic"
    assert isinstance(router.agent, GenericAdapter)
    assert "review.py" in router.agent.config.command


def test_from_config_hermes():
    router = AgentRouter.from_config({
        "name": "hermes",
        "hermes": {"profile": "code-review", "binary": "hermes"},
    })
    assert isinstance(router.agent, HermesAdapter)
    assert router.agent.config.profile == "code-review"


def test_from_config_opencode():
    router = AgentRouter.from_config({
        "name": "opencode",
        "opencode": {"binary": "/usr/local/bin/opencode"},
    })
    assert isinstance(router.agent, OpenCodeAdapter)
    assert router.agent.config.binary == "/usr/local/bin/opencode"


def test_from_config_unknown_agent():
    """Unknown agent name → ValueError."""
    with pytest.raises(ValueError, match="Unknown agent"):
        AgentRouter.from_config({"name": "gpt-9000"})


def test_from_config_defaults():
    """Missing name defaults to claude-code, missing timeout defaults to 300."""
    router = AgentRouter.from_config({})
    assert router.name == "claude-code"
    assert isinstance(router.agent, ClaudeCodeAdapter)
    assert router.agent.timeout == 300.0


def test_from_config_prompt_prefix():
    """Prompt prefix flows through to the adapter."""
    router = AgentRouter.from_config(
        {"name": "claude-code"},
        prompt_prefix="Be strict.",
    )
    assert router.agent.prompt_prefix == "Be strict."


@pytest.mark.asyncio
async def test_router_delegates_review(sample_context):
    """Router.review() delegates to the underlying adapter."""
    expected = ReviewResult(
        verdict="APPROVE",
        body="Looks good!",
        comments=[InlineComment(path="a.ts", line=1, body="nit")],
    )

    router = AgentRouter.from_config({"name": "claude-code"})
    router.agent.review = AsyncMock(return_value=expected)

    result = await router.review(sample_context)

    assert result is expected
    router.agent.review.assert_awaited_once_with(sample_context)


def test_registry_covers_all_adapters():
    """All four adapters are registered."""
    assert set(ADAPTER_REGISTRY) == {"claude-code", "hermes", "opencode", "generic"}
