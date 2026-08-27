"""Agent router — selects the configured adapter and invokes it."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from review_agent.models import PRContext, ReviewResult
from review_agent.adapters.base import ReviewAgent
from review_agent.adapters.claude_code import ClaudeCodeAdapter, ClaudeCodeConfig
from review_agent.adapters.generic import GenericAdapter, GenericConfig
from review_agent.adapters.hermes import HermesAdapter, HermesConfig
from review_agent.adapters.opencode import OpenCodeAdapter, OpenCodeConfig

logger = logging.getLogger(__name__)

# Registry of adapter names to (adapter_class, config_class)
ADAPTER_REGISTRY: dict[str, tuple[type[ReviewAgent], type]] = {
    "claude-code": (ClaudeCodeAdapter, ClaudeCodeConfig),
    "hermes": (HermesAdapter, HermesConfig),
    "opencode": (OpenCodeAdapter, OpenCodeConfig),
    "generic": (GenericAdapter, GenericConfig),
}


@dataclass
class AgentRouter:
    """Config-driven agent selection and invocation.

    Usage::

        router = AgentRouter.from_config({
            "name": "claude-code",
            "timeout_seconds": 300,
            "claude_code": {"binary": "claude", "model": "claude-sonnet-4-20250514"},
        })
        result = await router.review(pr_context)
    """

    agent: ReviewAgent
    name: str = ""

    @classmethod
    def from_config(
        cls,
        agent_config: dict[str, Any],
        *,
        prompt_prefix: str = "",
    ) -> AgentRouter:
        """Build a router from the ``agent:`` section of config.yaml."""
        name = agent_config.get("name", "claude-code")
        timeout = float(agent_config.get("timeout_seconds", 300))

        if name not in ADAPTER_REGISTRY:
            raise ValueError(
                f"Unknown agent {name!r}. "
                f"Available: {', '.join(sorted(ADAPTER_REGISTRY))}"
            )

        adapter_cls, config_cls = ADAPTER_REGISTRY[name]

        # Build adapter-specific config from the sub-key
        # e.g. agent_config["claude_code"] → ClaudeCodeConfig(...)
        config_key = name.replace("-", "_")
        raw_cfg = agent_config.get(config_key, {})
        cfg = config_cls(**raw_cfg) if raw_cfg else config_cls()

        agent = adapter_cls(
            config=cfg,
            timeout=timeout,
            prompt_prefix=prompt_prefix,
        )

        logger.info("Agent router initialized: adapter=%s, timeout=%.0fs", name, timeout)
        return cls(agent=agent, name=name)

    async def review(self, context: PRContext) -> ReviewResult:
        """Delegate review to the selected adapter."""
        logger.info(
            "Routing review for %s#%d to %s",
            context.repo,
            context.pr_number,
            self.name,
        )
        return await self.agent.review(context)
