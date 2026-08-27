"""Tests for the Generic adapter with mocked subprocess."""

import asyncio
import json
from unittest.mock import patch, MagicMock

import pytest

from review_agent.adapters.generic import GenericAdapter, GenericConfig
from review_agent.models import PRContext
from tests.conftest import VALID_REVIEW_JSON, APPROVE_JSON


@pytest.fixture()
def adapter() -> GenericAdapter:
    return GenericAdapter(
        config=GenericConfig(
            command="python review.py --diff {diff_file} --context {context_file} --output {output_file}"
        ),
        timeout=10.0,
    )


def _mock_process(stdout: str, returncode: int = 0, stderr: str = ""):
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
async def test_generic_reads_output_file(adapter, sample_context, tmp_path):
    """When the command writes to {output_file}, we read from it."""
    proc = _mock_process("")  # stdout empty — output goes to file

    written_output_path = None

    original_shell = asyncio.create_subprocess_shell

    async def intercept_shell(cmd_str, **kwargs):
        nonlocal written_output_path
        # Extract output_file from the command string
        # The command has --output <path> in it
        parts = cmd_str.split("--output ")
        if len(parts) > 1:
            written_output_path = parts[1].strip()
            # Write the mock review JSON to the output file
            import pathlib
            pathlib.Path(written_output_path).write_text(
                VALID_REVIEW_JSON, encoding="utf-8"
            )
        return proc

    with patch("asyncio.create_subprocess_shell", side_effect=intercept_shell):
        result = await adapter.review(sample_context)

    assert result.verdict == "REQUEST_CHANGES"
    assert len(result.comments) == 1


@pytest.mark.asyncio
async def test_generic_falls_back_to_stdout(sample_context):
    """When output file doesn't exist, fall back to stdout."""
    adapter = GenericAdapter(
        config=GenericConfig(command="echo review"),
        timeout=10.0,
    )
    proc = _mock_process(APPROVE_JSON)

    with patch("asyncio.create_subprocess_shell", return_value=proc):
        result = await adapter.review(sample_context)

    assert result.verdict == "APPROVE"


@pytest.mark.asyncio
async def test_generic_no_command(sample_context):
    """Empty command → ValueError."""
    adapter = GenericAdapter(config=GenericConfig(command=""))

    with pytest.raises(ValueError, match="not configured"):
        await adapter.review(sample_context)


@pytest.mark.asyncio
async def test_generic_nonzero_exit(adapter, sample_context):
    """Non-zero exit → RuntimeError."""
    proc = _mock_process("", returncode=1, stderr="script crashed")

    with patch("asyncio.create_subprocess_shell", return_value=proc):
        with pytest.raises(RuntimeError, match="exited with code 1"):
            await adapter.review(sample_context)


@pytest.mark.asyncio
async def test_generic_timeout(sample_context):
    """Command exceeds timeout → TimeoutError."""
    adapter = GenericAdapter(
        config=GenericConfig(command="sleep 999"),
        timeout=0.01,
    )

    proc = MagicMock()
    proc.returncode = None
    proc.kill = MagicMock()

    async def slow():
        await asyncio.sleep(10)
        return b"", b""

    proc.communicate = slow

    async def wait():
        pass

    proc.wait = wait

    with patch("asyncio.create_subprocess_shell", return_value=proc):
        with pytest.raises(TimeoutError, match="timed out"):
            await adapter.review(sample_context)


@pytest.mark.asyncio
async def test_generic_placeholder_substitution(sample_context):
    """Verify all placeholders are substituted in the command."""
    adapter = GenericAdapter(
        config=GenericConfig(
            command="cat {diff_file} {context_file} {prompt_file} > {output_file}"
        ),
        timeout=10.0,
    )
    proc = _mock_process(APPROVE_JSON)

    captured_cmd = None

    async def capture_shell(cmd_str, **kwargs):
        nonlocal captured_cmd
        captured_cmd = cmd_str
        return proc

    with patch("asyncio.create_subprocess_shell", side_effect=capture_shell):
        # Won't find output_file, falls back to stdout (which is APPROVE)
        result = await adapter.review(sample_context)

    assert "{diff_file}" not in captured_cmd
    assert "{context_file}" not in captured_cmd
    assert "{prompt_file}" not in captured_cmd
    assert "{output_file}" not in captured_cmd
    assert result.verdict == "APPROVE"
