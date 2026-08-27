"""Claude Code adapter — invokes `claude` CLI in non-interactive mode."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field

from review_agent.models import PRContext, ReviewResult
from .base import ReviewAgent, build_review_prompt, parse_review_result

logger = logging.getLogger(__name__)


@dataclass
class ClaudeCodeConfig:
    binary: str = "claude"
    model: str = ""  # optional override
    max_tokens: int = 8192


@dataclass
class ClaudeCodeAdapter(ReviewAgent):
    config: ClaudeCodeConfig = field(default_factory=ClaudeCodeConfig)
    timeout: float = 300.0
    prompt_prefix: str = ""

    async def review(self, context: PRContext) -> ReviewResult:
        prompt = build_review_prompt(context, custom_prefix=self.prompt_prefix)

        cmd: list[str] = [
            self.config.binary,
            "-p",
            prompt,
            "--output-format",
            "text",
        ]
        if self.config.model:
            cmd.extend(["--model", self.config.model])

        logger.info(
            "Invoking claude CLI for %s#%d", context.repo, context.pr_number
        )
        logger.debug("Command: %s", cmd)

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=self.timeout
            )
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            raise TimeoutError(
                f"Claude CLI timed out after {self.timeout}s"
            ) from None

        if proc.returncode != 0:
            err = stderr.decode(errors="replace").strip()
            raise RuntimeError(
                f"Claude CLI exited with code {proc.returncode}: {err}"
            )

        raw = stdout.decode(errors="replace")
        logger.debug("Claude raw output (%d chars)", len(raw))
        return parse_review_result(raw)
