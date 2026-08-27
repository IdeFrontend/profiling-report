"""Shared test fixtures for adapter tests."""

import pytest
from review_agent.models import PRContext, FileChange, Comment


@pytest.fixture()
def sample_context() -> PRContext:
    """Minimal PRContext for adapter tests."""
    return PRContext(
        repo="owner/repo",
        pr_number=42,
        title="Fix null check in parser",
        description="This PR fixes a null pointer issue in the JSON parser.",
        author="alice",
        base_branch="main",
        head_branch="fix-null-check",
        head_sha="abc1234",
        diff=(
            "diff --git a/src/parser.ts b/src/parser.ts\n"
            "--- a/src/parser.ts\n"
            "+++ b/src/parser.ts\n"
            "@@ -10,3 +10,5 @@\n"
            " function parse(input: string) {\n"
            "-  return JSON.parse(input);\n"
            "+  if (!input) return null;\n"
            "+  return JSON.parse(input);\n"
            " }\n"
        ),
        files=[
            FileChange(
                path="src/parser.ts",
                status="modified",
                patch="@@ -10,3 +10,5 @@\n ...",
                additions=2,
                deletions=1,
            ),
        ],
        existing_comments=[
            Comment(
                author="bob",
                body="Consider using a guard clause here",
                path="src/parser.ts",
                line=12,
            ),
        ],
        labels=["bugfix"],
        url="https://github.com/owner/repo/pull/42",
    )


# A valid agent JSON response
VALID_REVIEW_JSON = """{
  "verdict": "REQUEST_CHANGES",
  "body": "Found a potential issue with the null check.",
  "comments": [
    {
      "path": "src/parser.ts",
      "line": 11,
      "body": "Consider returning undefined instead of null for consistency."
    }
  ]
}"""

# Same thing wrapped in markdown fences (agents often do this)
FENCED_REVIEW_JSON = "```json\n" + VALID_REVIEW_JSON + "\n```"

# Minimal approve with no comments
APPROVE_JSON = '{"verdict": "APPROVE", "body": "LGTM!"}'
