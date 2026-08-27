"""Tests for DeduplicateStore."""

from __future__ import annotations

import json
import time

import pytest

from review_agent.dedup import DeduplicateStore


@pytest.fixture()
def store(tmp_path):
    return DeduplicateStore(tmp_path / "seen.json", prune_days=30)


class TestDedup:
    def test_initial_empty(self, store):
        assert store.is_seen("https://github.com/o/r/pull/1") is False

    def test_mark_and_check(self, store):
        url = "https://github.com/o/r/pull/1"
        store.mark_seen(url)
        assert store.is_seen(url) is True

    def test_persists_to_disk(self, tmp_path):
        path = tmp_path / "seen.json"
        s1 = DeduplicateStore(path)
        s1.mark_seen("https://github.com/o/r/pull/1")

        # New instance reads from disk
        s2 = DeduplicateStore(path)
        assert s2.is_seen("https://github.com/o/r/pull/1") is True

    def test_prune_removes_old(self, tmp_path):
        path = tmp_path / "seen.json"
        store = DeduplicateStore(path, prune_days=1)

        # Write a stale entry directly
        with open(path, "w") as f:
            json.dump({
                "https://github.com/o/r/pull/old": time.time() - 200_000,
                "https://github.com/o/r/pull/new": time.time(),
            }, f)

        store2 = DeduplicateStore(path, prune_days=1)
        removed = store2.prune()
        assert removed == 1
        assert store2.is_seen("https://github.com/o/r/pull/old") is False
        assert store2.is_seen("https://github.com/o/r/pull/new") is True

    def test_handles_corrupt_file(self, tmp_path):
        path = tmp_path / "seen.json"
        path.write_text("not valid json")
        store = DeduplicateStore(path)
        assert store.is_seen("anything") is False
        # Can still write
        store.mark_seen("url")
        assert store.is_seen("url") is True
