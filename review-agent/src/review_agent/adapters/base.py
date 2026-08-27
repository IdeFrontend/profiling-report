"""Base adapter ABC and shared prompt builder for review agents."""

from __future__ import annotations

import json
from abc import ABC, abstractmethod

from review_agent.models import PRContext, ReviewResult, InlineComment

# --- JSON output schema the agent must follow ---
REVIEW_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {
            "type": "string",
            "enum": ["APPROVE", "REQUEST_CHANGES", "COMMENT"],
        },
        "body": {"type": "string", "description": "Overall review summary"},
        "comments": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "line": {"type": "integer"},
                    "body": {"type": "string"},
                    "side": {
                        "type": "string",
                        "enum": ["RIGHT", "LEFT"],
                        "default": "RIGHT",
                    },
                },
                "required": ["path", "line", "body"],
            },
        },
    },
    "required": ["verdict", "body"],
}


def build_review_prompt(ctx: PRContext, *, custom_prefix: str = "") -> str:
    """Build the review prompt sent to any agent.

    Includes role description, PR metadata, full diff, and output schema.
    """
    parts: list[str] = []

    if custom_prefix:
        parts.append(custom_prefix.strip())
        parts.append("")

    parts.append(
        "You are an expert code reviewer. "
        "Analyze the following pull request and provide a thorough review."
    )
    parts.append("")
    parts.append("Look for:")
    parts.append("- Bugs and logic errors")
    parts.append("- Security vulnerabilities")
    parts.append("- Style and readability issues")
    parts.append("- Architectural concerns")
    parts.append("- Missing edge-case handling")
    parts.append("")
    parts.append(f"## PR #{ctx.pr_number}: {ctx.title}")
    parts.append(f"Repository: {ctx.repo}")
    parts.append(f"Author: {ctx.author}")
    parts.append(f"Branch: {ctx.head_branch} → {ctx.base_branch}")
    if ctx.labels:
        parts.append(f"Labels: {', '.join(ctx.labels)}")
    parts.append("")

    if ctx.description:
        parts.append("### Description")
        parts.append(ctx.description)
        parts.append("")

    if ctx.existing_comments:
        parts.append("### Existing review comments (for awareness, avoid duplicates)")
        for c in ctx.existing_comments:
            loc = f" ({c.path}:{c.line})" if c.path else ""
            parts.append(f"- @{c.author}{loc}: {c.body[:200]}")
        parts.append("")

    parts.append("### Diff")
    parts.append("```diff")
    parts.append(ctx.diff)
    parts.append("```")
    parts.append("")

    parts.append("### Required output format")
    parts.append(
        "Respond with ONLY a JSON object matching this schema "
        "(no markdown fences, no extra text):"
    )
    parts.append(json.dumps(REVIEW_OUTPUT_SCHEMA, indent=2))

    return "\n".join(parts)


def parse_review_result(raw: str) -> ReviewResult:
    """Parse agent JSON output into a ReviewResult.

    Tolerant: strips markdown fences and leading/trailing junk.
    """
    text = raw.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        # remove opening fence (with optional language tag)
        first_nl = text.index("\n")
        text = text[first_nl + 1 :]
    if text.endswith("```"):
        text = text[: text.rindex("```")]
    text = text.strip()

    # Find the JSON object boundaries
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"No JSON object found in agent output: {text[:200]!r}")
    text = text[start : end + 1]

    data = json.loads(text)

    verdict = data.get("verdict", "COMMENT").upper()
    if verdict not in ("APPROVE", "REQUEST_CHANGES", "COMMENT"):
        verdict = "COMMENT"

    comments = []
    for c in data.get("comments", []):
        comments.append(
            InlineComment(
                path=c["path"],
                line=int(c["line"]),
                body=c["body"],
                side=c.get("side", "RIGHT"),
            )
        )

    return ReviewResult(
        verdict=verdict,
        body=data.get("body", ""),
        comments=comments,
    )


class ReviewAgent(ABC):
    """Base class for all review agent adapters."""

    @abstractmethod
    async def review(self, context: PRContext) -> ReviewResult:
        """Send PR context to the agent and return a structured review."""
        ...
