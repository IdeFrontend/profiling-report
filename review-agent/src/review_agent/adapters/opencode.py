"""OpenCode adapter — invokes `opencode` CLI with a prompt file."""

from __future__ import annotations

import asyncio
import logging
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

from review_agent.models import PRContext, ReviewResult
from .base import ReviewAgent, build_review_prompt, parse_review_result

logger = logging.getLogger(__name__)


@dataclass
class OpenCodeConfig:
    binary: str = "opencode"


@dataclass
class OpenCodeAdapter(ReviewAgent):
    config: OpenCodeConfig = field(default_factory=OpenCodeConfig)
    timeout: float = 300.0
    prompt_prefix: str = ""

    async def review(self, context: PRContext) -> ReviewResult:
        prompt = build_review_prompt(context, custom_prefix=self.prompt_prefix)

        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".txt",
            delete=False,
            encoding="utf-8",
        ) as f:
            f.write(prompt)
            prompt_path = f.name

        try:
            cmd: list[str] = [
                self.config.binary,
                "--prompt-file",
                prompt_path,
            ]

            logger.info(
                "Invoking opencode CLI for %s#%d",
                context.repo,
                context.pr_number,
            )

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
                    f"OpenCode CLI timed out after {self.timeout}s"
                ) from None

            if proc.returncode != 0:
                err = stderr.decode(errors="replace").strip()
                raise RuntimeError(
                    f"OpenCode CLI exited with code {proc.returncode}: {err}"
                )

            raw = stdout.decode(errors="replace")
            logger.debug("OpenCode raw output (%d chars)", len(raw))
            return parse_review_result(raw)
        finally:
            Path(prompt_path).unlink(missing_ok=True)
