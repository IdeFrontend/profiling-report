"""Tests for models and the shared prompt/parse utilities."""

import json
import pytest

from review_agent.models import PRContext, FileChange, Comment, ReviewResult, InlineComment
from review_agent.adapters.base import build_review_prompt, parse_review_result
from tests.conftest import VALID_REVIEW_JSON, FENCED_REVIEW_JSON, APPROVE_JSON


def test_parse_valid_json():
    result = parse_review_result(VALID_REVIEW_JSON)
    assert result.verdict == "REQUEST_CHANGES"
    assert "null check" in result.body
    assert len(result.comments) == 1
    assert result.comments[0].path == "src/parser.ts"
    assert result.comments[0].line == 11
    assert result.comments[0].side == "RIGHT"


def test_parse_fenced_json():
    result = parse_review_result(FENCED_REVIEW_JSON)
    assert result.verdict == "REQUEST_CHANGES"


def test_parse_approve():
    result = parse_review_result(APPROVE_JSON)
    assert result.verdict == "APPROVE"
    assert result.comments == []


def test_parse_json_with_junk_around():
    raw = "Here is my review:\n" + VALID_REVIEW_JSON + "\nHope this helps!"
    result = parse_review_result(raw)
    assert result.verdict == "REQUEST_CHANGES"


def test_parse_invalid_verdict_falls_back():
    raw = '{"verdict": "REJECT", "body": "Bad code"}'
    result = parse_review_result(raw)
    assert result.verdict == "COMMENT"  # fallback


def test_parse_no_json_raises():
    with pytest.raises(ValueError, match="No JSON object found"):
        parse_review_result("This contains no JSON at all")


def test_parse_comment_side():
    raw = json.dumps({
        "verdict": "COMMENT",
        "body": "review",
        "comments": [{"path": "a.ts", "line": 5, "body": "fix", "side": "LEFT"}],
    })
    result = parse_review_result(raw)
    assert result.comments[0].side == "LEFT"


def test_build_prompt_contains_essentials(sample_context):
    prompt = build_review_prompt(sample_context)
    assert "code reviewer" in prompt.lower()
    assert "PR #42" in prompt
    assert "owner/repo" in prompt
    assert "fix-null-check" in prompt
    assert "main" in prompt
    assert "alice" in prompt
    assert "bugfix" in prompt
    assert "JSON" in prompt  # asks for JSON output
    assert sample_context.diff in prompt


def test_build_prompt_includes_existing_comments(sample_context):
    prompt = build_review_prompt(sample_context)
    assert "@bob" in prompt
    assert "guard clause" in prompt


def test_build_prompt_custom_prefix(sample_context):
    prompt = build_review_prompt(sample_context, custom_prefix="Security only!")
    assert prompt.startswith("Security only!")


def test_build_prompt_no_labels():
    ctx = PRContext(
        repo="a/b", pr_number=1, title="t", description="d",
        author="x", base_branch="main", head_branch="f",
        head_sha="abc", diff="diff",
    )
    prompt = build_review_prompt(ctx)
    assert "Labels:" not in prompt


def test_model_dataclasses():
    """Smoke test: all models are constructible with defaults."""
    fc = FileChange(path="a.ts", status="added", patch="@@")
    assert fc.previous_path is None
    c = Comment(author="x", body="y")
    assert c.line is None
    ic = InlineComment(path="a.ts", line=1, body="fix")
    assert ic.side == "RIGHT"
    rr = ReviewResult(verdict="APPROVE", body="ok")
    assert rr.comments == []
