"""FastAPI webhook server: receives GitHub webhook payloads."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from typing import Any, Callable, Awaitable

from fastapi import FastAPI, Request, Response

logger = logging.getLogger(__name__)

EventCallback = Callable[[str, dict[str, Any]], Awaitable[None]]


def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Validate GitHub webhook HMAC-SHA256 signature."""
    if not signature.startswith("sha256="):
        return False
    expected = hmac.new(
        secret.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)


def create_app(
    secret: str, on_event: EventCallback,
) -> FastAPI:
    """Create a FastAPI app with a single POST /hook endpoint."""
    app = FastAPI(title="review-agent-webhook")

    @app.post("/hook")
    async def webhook(request: Request) -> Response:
        body = await request.body()

        # Signature validation
        sig = request.headers.get("X-Hub-Signature-256", "")
        if secret and not verify_signature(body, sig, secret):
            logger.warning("Invalid webhook signature")
            return Response(status_code=403, content="Bad signature")

        event_type = request.headers.get("X-GitHub-Event", "")
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            return Response(status_code=400, content="Bad JSON")

        # Filter: only pull_request (review_requested) and pull_request_review
        action = payload.get("action", "")
        if event_type == "pull_request" and action == "review_requested":
            await on_event(event_type, payload)
        elif event_type == "pull_request_review":
            await on_event(event_type, payload)
        else:
            logger.debug("Ignoring event %s/%s", event_type, action)

        return Response(status_code=200, content="OK")

    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok"}

    return app
