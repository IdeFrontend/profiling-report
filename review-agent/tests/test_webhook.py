"""Tests for webhook signature validation and payload parsing."""

from __future__ import annotations

import hashlib
import hmac
import json

import pytest
from fastapi.testclient import TestClient

from review_agent.webhook import verify_signature, create_app


# -- verify_signature tests ------------------------------------------------

SECRET = "test-webhook-secret"


def _sign(payload: bytes, secret: str = SECRET) -> str:
    return "sha256=" + hmac.new(
        secret.encode(), payload, hashlib.sha256
    ).hexdigest()


class TestVerifySignature:
    def test_valid_signature(self):
        payload = b'{"action": "review_requested"}'
        sig = _sign(payload)
        assert verify_signature(payload, sig, SECRET) is True

    def test_invalid_signature(self):
        payload = b'{"action": "review_requested"}'
        assert verify_signature(payload, "sha256=bad", SECRET) is False

    def test_missing_prefix(self):
        payload = b'{"action": "review_requested"}'
        digest = hmac.new(
            SECRET.encode(), payload, hashlib.sha256
        ).hexdigest()
        assert verify_signature(payload, digest, SECRET) is False

    def test_empty_signature(self):
        assert verify_signature(b"x", "", SECRET) is False

    def test_different_payload(self):
        payload = b'{"action": "review_requested"}'
        sig = _sign(payload)
        assert verify_signature(b"tampered", sig, SECRET) is False


# -- webhook endpoint tests ------------------------------------------------

_PR_PAYLOAD = {
    "action": "review_requested",
    "pull_request": {
        "number": 42,
        "html_url": "https://github.com/owner/repo/pull/42",
        "base": {"repo": {"full_name": "owner/repo"}},
        "head": {"sha": "abc123"},
        "user": {"login": "author"},
    },
}

_REVIEW_PAYLOAD = {
    "action": "submitted",
    "review": {"state": "commented"},
    "pull_request": {
        "number": 42,
        "html_url": "https://github.com/owner/repo/pull/42",
        "base": {"repo": {"full_name": "owner/repo"}},
    },
}


class TestWebhookEndpoint:
    @pytest.fixture()
    def events(self):
        return []

    @pytest.fixture()
    def client(self, events):
        async def on_event(event_type, payload):
            events.append((event_type, payload))

        app = create_app(SECRET, on_event)
        return TestClient(app)

    def _post(self, client, payload: dict, event: str, secret: str = SECRET):
        body = json.dumps(payload).encode()
        sig = _sign(body, secret)
        return client.post(
            "/hook",
            content=body,
            headers={
                "X-Hub-Signature-256": sig,
                "X-GitHub-Event": event,
                "Content-Type": "application/json",
            },
        )

    def test_pull_request_review_requested(self, client, events):
        resp = self._post(client, _PR_PAYLOAD, "pull_request")
        assert resp.status_code == 200
        assert len(events) == 1
        assert events[0][0] == "pull_request"
        assert events[0][1]["action"] == "review_requested"

    def test_pull_request_review_event(self, client, events):
        resp = self._post(client, _REVIEW_PAYLOAD, "pull_request_review")
        assert resp.status_code == 200
        assert len(events) == 1
        assert events[0][0] == "pull_request_review"

    def test_ignored_event(self, client, events):
        payload = {"action": "opened"}
        resp = self._post(client, payload, "pull_request")
        assert resp.status_code == 200
        assert len(events) == 0

    def test_ignored_push_event(self, client, events):
        resp = self._post(client, {"ref": "refs/heads/main"}, "push")
        assert resp.status_code == 200
        assert len(events) == 0

    def test_bad_signature(self, client, events):
        body = json.dumps(_PR_PAYLOAD).encode()
        resp = client.post(
            "/hook",
            content=body,
            headers={
                "X-Hub-Signature-256": "sha256=wrong",
                "X-GitHub-Event": "pull_request",
            },
        )
        assert resp.status_code == 403
        assert len(events) == 0

    def test_bad_json(self, client, events):
        body = b"not json"
        sig = _sign(body)
        resp = client.post(
            "/hook",
            content=body,
            headers={
                "X-Hub-Signature-256": sig,
                "X-GitHub-Event": "pull_request",
            },
        )
        assert resp.status_code == 400
        assert len(events) == 0

    def test_health_endpoint(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}

    def test_no_secret_skips_validation(self, events):
        """When webhook secret is empty, signature is not checked."""
        async def on_event(event_type, payload):
            events.append((event_type, payload))

        app = create_app("", on_event)
        c = TestClient(app)
        body = json.dumps(_PR_PAYLOAD).encode()
        resp = c.post(
            "/hook",
            content=body,
            headers={
                "X-GitHub-Event": "pull_request",
            },
        )
        assert resp.status_code == 200
        assert len(events) == 1
