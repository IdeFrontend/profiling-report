"""Generic adapter — runs a user-configured command template."""

from __future__ import annotations

import asyncio
import json
import logging
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

from review_agent.models import PRContext, ReviewResult
from .base import ReviewAgent, build_review_prompt, parse_review_result

logger = logging.getLogger(__name__)


@dataclass
class GenericConfig:
    command: str = ""
    # Placeholders: {diff_file} {context_file} {output_file} {prompt_file}


@dataclass
class GenericAdapter(ReviewAgent):
    config: GenericConfig = field(default_factory=GenericConfig)
    timeout: float = 300.0
    prompt_prefix: str = ""

    async def review(self, context: PRContext) -> ReviewResult:
        if not self.config.command:
            raise ValueError("Generic adapter: 'command' not configured")

        prompt = build_review_prompt(context, custom_prefix=self.prompt_prefix)

        # Prepare context metadata (everything except diff)
        context_data = {
            "repo": context.repo,
            "pr_number": context.pr_number,
            "title": context.title,
            "description": context.description,
            "author": context.author,
            "base_branch": context.base_branch,
            "head_branch": context.head_branch,
            "head_sha": context.head_sha,
            "labels": context.labels,
            "url": context.url,
            "files": [
                {
                    "path": f.path,
                    "status": f.status,
                    "additions": f.additions,
                    "deletions": f.deletions,
                    "previous_path": f.previous_path,
                }
                for f in context.files
            ],
        }

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            diff_file = tmp_path / "diff.patch"
            context_file = tmp_path / "context.json"
            output_file = tmp_path / "output.json"
            prompt_file = tmp_path / "prompt.txt"

            diff_file.write_text(context.diff, encoding="utf-8")
            context_file.write_text(
                json.dumps(context_data, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
            prompt_file.write_text(prompt, encoding="utf-8")

            cmd_str = (
                self.config.command
                .replace("{diff_file}", str(diff_file))
                .replace("{context_file}", str(context_file))
                .replace("{output_file}", str(output_file))
                .replace("{prompt_file}", str(prompt_file))
            )

            logger.info(
                "Running generic command for %s#%d",
                context.repo,
                context.pr_number,
            )
            logger.debug("Command: %s", cmd_str)

            proc = await asyncio.create_subprocess_shell(
                cmd_str,
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
                    f"Generic command timed out after {self.timeout}s"
                ) from None

            if proc.returncode != 0:
                err = stderr.decode(errors="replace").strip()
                raise RuntimeError(
                    f"Generic command exited with code {proc.returncode}: {err}"
                )

            # Read result: prefer {output_file} if it exists, else stdout
            if output_file.exists():
                raw = output_file.read_text(encoding="utf-8")
            else:
                raw = stdout.decode(errors="replace")

            logger.debug("Generic output (%d chars)", len(raw))
            return parse_review_result(raw)
