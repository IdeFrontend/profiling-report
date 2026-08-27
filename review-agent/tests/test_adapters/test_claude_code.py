"""Tests for the Claude Code adapter with mocked subprocess."""

import asyncio
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

from review_agent.adapters.claude_code import ClaudeCodeAdapter, ClaudeCodeConfig
from review_agent.models import PRContext
from tests.conftest import VALID_REVIEW_JSON, FENCED_REVIEW_JSON, APPROVE_JSON


@pytest.fixture()
def adapter() -> ClaudeCodeAdapter:
    return ClaudeCodeAdapter(
        config=ClaudeCodeConfig(binary="claude", model="claude-sonnet-4-20250514"),
        timeout=10.0,
    )


def _mock_process(stdout: str, returncode: int = 0, stderr: str = ""):
    """Create a mock asyncio.Process."""
    proc = MagicMock()
    proc.returncode = returncode

    async def communicate():
        return stdout.encode(), stderr.encode()

    proc.communicate = communicate
    proc.kill = MagicMock()

    async def wait():
        pass

    proc.wait = wait
    return proc


@pytest.mark.asyncio
async def test_claude_code_success(adapter, sample_context):
    """Claude CLI returns valid JSON → parsed into ReviewResult."""
    proc = _mock_process(VALID_REVIEW_JSON)

    with patch("asyncio.create_subprocess_exec", return_value=proc) as mock_exec:
        result = await adapter.review(sample_context)

    assert result.verdict == "REQUEST_CHANGES"
    assert "null check" in result.body
    assert len(result.comments) == 1
    assert result.comments[0].path == "src/parser.ts"
    assert result.comments[0].line == 11

    # Verify the CLI was called with expected args
    call_args = mock_exec.call_args[0]
    assert call_args[0] == "claude"
    assert "-p" in call_args
    assert "--model" in call_args
    assert "claude-sonnet-4-20250514" in call_args


@pytest.mark.asyncio
async def test_claude_code_fenced_output(adapter, sample_context):
    """Claude sometimes wraps output in markdown fences — parser handles it."""
    proc = _mock_process(FENCED_REVIEW_JSON)

    with patch("asyncio.create_subprocess_exec", return_value=proc):
        result = await adapter.review(sample_context)

    assert result.verdict == "REQUEST_CHANGES"
    assert len(result.comments) == 1


@pytest.mark.asyncio
async def test_claude_code_approve(adapter, sample_context):
    """Approve with no inline comments."""
    proc = _mock_process(APPROVE_JSON)

    with patch("asyncio.create_subprocess_exec", return_value=proc):
        result = await adapter.review(sample_context)

    assert result.verdict == "APPROVE"
    assert result.body == "LGTM!"
    assert result.comments == []


@pytest.mark.asyncio
async def test_claude_code_nonzero_exit(adapter, sample_context):
    """Non-zero exit code → RuntimeError."""
    proc = _mock_process("", returncode=1, stderr="API error")

    with patch("asyncio.create_subprocess_exec", return_value=proc):
        with pytest.raises(RuntimeError, match="exited with code 1"):
            await adapter.review(sample_context)


@pytest.mark.asyncio
async def test_claude_code_timeout(sample_context):
    """CLI exceeds timeout → TimeoutError."""
    adapter = ClaudeCodeAdapter(
        config=ClaudeCodeConfig(binary="claude"),
        timeout=0.01,  # very short
    )

    proc = MagicMock()
    proc.returncode = None
    proc.kill = MagicMock()

    async def slow_communicate():
        await asyncio.sleep(10)
        return b"", b""

    proc.communicate = slow_communicate

    async def wait():
        pass

    proc.wait = wait

    with patch("asyncio.create_subprocess_exec", return_value=proc):
        with pytest.raises(TimeoutError, match="timed out"):
            await adapter.review(sample_context)


@pytest.mark.asyncio
async def test_claude_code_invalid_json(adapter, sample_context):
    """Agent returns garbage → ValueError from parse_review_result."""
    proc = _mock_process("This is not JSON at all!")

    with patch("asyncio.create_subprocess_exec", return_value=proc):
        with pytest.raises(ValueError, match="No JSON object found"):
            await adapter.review(sample_context)


@pytest.mark.asyncio
async def test_claude_code_no_model(sample_context):
    """When model is empty, --model flag is not passed."""
    adapter = ClaudeCodeAdapter(
        config=ClaudeCodeConfig(binary="claude", model=""),
    )
    proc = _mock_process(APPROVE_JSON)

    with patch("asyncio.create_subprocess_exec", return_value=proc) as mock_exec:
        await adapter.review(sample_context)

    call_args = mock_exec.call_args[0]
    assert "--model" not in call_args


@pytest.mark.asyncio
async def test_claude_code_custom_prefix(sample_context):
    """Custom prompt prefix is prepended."""
    adapter = ClaudeCodeAdapter(
        config=ClaudeCodeConfig(binary="claude"),
        prompt_prefix="Focus on security issues only.",
    )
    proc = _mock_process(APPROVE_JSON)

    with patch("asyncio.create_subprocess_exec", return_value=proc) as mock_exec:
        await adapter.review(sample_context)

    # The prompt is the 3rd arg (after 'claude', '-p')
    call_args = mock_exec.call_args[0]
    prompt_idx = list(call_args).index("-p") + 1
    prompt = call_args[prompt_idx]
    assert prompt.startswith("Focus on security issues only.")
