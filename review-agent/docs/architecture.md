# Architecture: Local Code-Review Listener Service

Local service that detects GitHub review requests, gathers PR context, delegates review to a local AI agent, and publishes the result back to the PR.

---

## Architecture Diagram

```
┌───────────────────────────────────────────────────────────────────────┐
│                         LOCAL MACHINE                                │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                    review-agent-service                       │    │
│  │                                                              │    │
│  │  ┌─────────────┐   ┌─────────────┐                          │    │
│  │  │  Webhook     │   │  Polling     │                          │    │
│  │  │  Listener    │   │  Loop       │                          │    │
│  │  │  (FastAPI)   │   │  (gh CLI)   │                          │    │
│  │  │  POST /hook  │   │  cron/timer │                          │    │
│  │  └──────┬───────┘   └──────┬──────┘                          │    │
│  │         │                  │                                  │    │
│  │         └────────┬─────────┘                                  │    │
│  │                  ▼                                            │    │
│  │         ┌────────────────┐                                    │    │
│  │         │  Dedup Queue   │  seen.json — skip already-handled  │    │
│  │         └───────┬────────┘                                    │    │
│  │                 ▼                                              │    │
│  │         ┌────────────────┐   GitHub API                       │    │
│  │         │  PR Context    │──────────────────┐                 │    │
│  │         │  Extractor     │   GET diff       │                 │    │
│  │         │                │   GET files      │                 │    │
│  │         │                │   GET comments   │                 │    │
│  │         └───────┬────────┘                  │                 │    │
│  │                 │ PRContext                  │                 │    │
│  │                 ▼                            │                 │    │
│  │         ┌────────────────┐                  │                 │    │
│  │         │  Agent Router  │                  │                 │    │
│  │         │  (adapter      │                  │                 │    │
│  │         │   pattern)     │                  │                 │    │
│  │         └───────┬────────┘                  │                 │    │
│  │          ┌──────┼──────────┐                │                 │    │
│  │          ▼      ▼          ▼                │                 │    │
│  │    ┌─────────┐ ┌────────┐ ┌──────────┐     │                 │    │
│  │    │ Claude  │ │Hermes/ │ │ Generic  │     │                 │    │
│  │    │ Code    │ │OpenCode│ │ (custom  │     │                 │    │
│  │    │ Adapter │ │Adapter │ │  cmd)    │     │                 │    │
│  │    └────┬────┘ └───┬────┘ └────┬─────┘     │                 │    │
│  │         └──────┬───┘           │            │                 │    │
│  │                └───────┬───────┘            │                 │    │
│  │                        │ ReviewResult       │                 │    │
│  │                        ▼                    │                 │    │
│  │         ┌────────────────┐                  │                 │    │
│  │         │  Review        │   POST reviews   │                 │    │
│  │         │  Publisher     │──────────────────┘                 │    │
│  │         │                │   GitHub API                       │    │
│  │         └────────────────┘                                    │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Optional: ngrok / cloudflared tunnel ──────► GitHub Webhooks        │
│                                                                      │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Event Sources (input layer)

Two mutually non-exclusive input modes. Both produce the same internal event: `ReviewRequest(repo, pr_number, reviewer)`.

#### 1a. Polling Loop

Primary mode (recommended for start). Zero infrastructure.

| Property        | Value                                              |
|-----------------|----------------------------------------------------|
| Trigger         | Timer / cron, configurable interval (default 120s) |
| Mechanism       | `gh search prs --review-requested=@me --state=open --json ...` |
| Scope           | Cross-repo — one call covers all repos the token can see |
| Dedup           | Compares against `seen.json`; skips already-handled PRs |
| Offline-safe    | Yes — on restart picks up all pending PRs           |

#### 1b. Webhook Listener

Optional upgrade for sub-10s latency. Requires a tunnel (ngrok / cloudflared / smee).

| Property        | Value                                              |
|-----------------|----------------------------------------------------|
| Server          | Python FastAPI, single endpoint `POST /hook`       |
| Port            | Configurable (default 8080)                        |
| Auth            | HMAC-SHA256 signature validation via `X-Hub-Signature-256` |
| Events          | `pull_request` (action: `review_requested`) and `pull_request_review` |
| Dedup           | Same `seen.json` as polling                        |

### 2. Dedup Queue

File-based dedup (`~/.config/review-agent/seen.json`). Stores `Set[str]` of PR URLs already dispatched for review.

- On new event: check if `pr_url` in set → skip or proceed.
- On successful review publish: mark as handled.
- Stale entries auto-pruned after 30 days (configurable).
- File-level locking for concurrent webhook + polling safety.

### 3. PR Context Extractor

Fetches full PR context from GitHub API. Produces a `PRContext` object consumed by agents.

```
PRContext:
  repo: str              # "owner/repo"
  pr_number: int
  title: str
  description: str       # PR body markdown
  author: str            # PR author login
  base_branch: str       # e.g. "main"
  head_branch: str       # e.g. "feature-x"
  head_sha: str
  diff: str              # full unified diff
  files: list[FileChange]  # path, status, patch, additions, deletions
  existing_comments: list[Comment]  # prior review comments
  labels: list[str]
  url: str               # html_url of the PR
```

```
FileChange:
  path: str
  status: str            # "added" | "modified" | "removed" | "renamed"
  patch: str             # per-file diff hunk
  additions: int
  deletions: int
  previous_path: str | None  # for renames
```

```
Comment:
  author: str
  body: str
  path: str | None       # None for top-level PR comments
  line: int | None
  created_at: str
```

GitHub API calls:
1. `GET /repos/{o}/{r}/pulls/{n}` — title, description, branches, author
2. `GET /repos/{o}/{r}/pulls/{n}` with `Accept: application/vnd.github.v3.diff` — full diff
3. `GET /repos/{o}/{r}/pulls/{n}/files` — per-file patches, status
4. `GET /repos/{o}/{r}/pulls/{n}/comments` — existing review comments
5. `GET /repos/{o}/{r}/issues/{n}/comments` — top-level PR comments

Rate limits: uses token auth (5000 req/hour). A single PR review consumes ~5 requests — well within budget even at high PR volume.

### 4. Agent Router

Selects the configured agent adapter and invokes it. Single responsibility: `PRContext → ReviewResult`.

- Reads `agent.name` from config to pick adapter.
- Passes `PRContext` to adapter's `review()` method.
- Receives `ReviewResult` back.
- No retry at this level — adapter is responsible for its own retries.

### 5. Agent Adapters

Each adapter implements a common interface:

```
class ReviewAgent(ABC):
    async def review(self, context: PRContext) -> ReviewResult
```

#### 5a. Claude Code Adapter

Invokes `claude -p "<prompt>" --output-format json` with the diff and PR context piped via stdin or temp file. Parses structured JSON response.

#### 5b. Hermes Adapter

Creates a kanban task with the PR context in the body. Polls for completion or uses `hermes --print-only` mode. Parses the agent's response.

#### 5c. OpenCode Adapter

Invokes `opencode` CLI in non-interactive mode with a prompt file.

#### 5d. Generic Adapter

Runs a user-configured command template. Substitutes `{diff_file}`, `{context_file}`, `{output_file}` placeholders. Reads structured output from `{output_file}`.

### 6. Review Publisher

Converts `ReviewResult` into GitHub API calls.

```
ReviewResult:
  verdict: str           # "APPROVE" | "REQUEST_CHANGES" | "COMMENT"
  body: str              # overall review summary
  comments: list[InlineComment]  # per-file, per-line comments
```

```
InlineComment:
  path: str              # file path relative to repo root
  line: int              # line number in the diff (new-file side)
  body: str              # comment text
  side: str              # "RIGHT" (default) or "LEFT"
```

API call: `POST /repos/{o}/{r}/pulls/{n}/reviews`

```json
{
  "event": "COMMENT",
  "body": "AI Review Summary:\n...",
  "comments": [
    { "path": "src/foo.ts", "line": 42, "body": "Potential null deref here" }
  ]
}
```

Individual inline comments also posted via `POST /repos/{o}/{r}/pulls/{n}/comments` for threading (user preference: reply on every inline comment thread individually).

### 7. Logging

Structured logging via Python `logging` with JSON formatter.

- Log levels: DEBUG (API payloads), INFO (events received, reviews published), WARNING (rate limits, retries), ERROR (failures).
- Log destination: stdout + rotating file (`~/.config/review-agent/logs/`).
- Each review run tagged with `{repo}#{pr_number}` for traceability.

### 8. Error Handling & Retry

| Failure              | Strategy                                        |
|----------------------|-------------------------------------------------|
| GitHub API 403/429   | Exponential backoff (1s, 2s, 4s), max 3 retries |
| GitHub API 5xx       | Retry 3× with backoff                           |
| Agent timeout        | Configurable timeout (default 300s), no retry    |
| Agent crash/error    | Log error, mark PR as failed in seen.json, skip  |
| Webhook sig invalid  | Return 403, do not process                       |
| Config missing       | Fail at startup with clear error message         |

---

## Configuration Schema

File: `~/.config/review-agent/config.yaml` (XDG on Linux, `%APPDATA%` on Windows).

```yaml
# GitHub credentials
github:
  token: "ghp_..."                    # or use GITHUB_TOKEN env var
  # Optional: filter repos (empty = all repos)
  repos:
    - "owner/repo-a"
    - "owner/repo-b"
  # Optional: only review PRs requested from this user
  # Default: token owner
  reviewer: "@me"

# Webhook mode (optional — disabled if omitted)
webhook:
  enabled: false
  port: 8080
  host: "0.0.0.0"
  secret: "your-webhook-secret"       # or WEBHOOK_SECRET env var

# Polling mode
polling:
  enabled: true
  interval_seconds: 120               # how often to poll (min: 30)

# Which AI agent to use for review
agent:
  name: "claude-code"                 # "claude-code" | "hermes" | "opencode" | "generic"
  timeout_seconds: 300
  # Agent-specific config:
  claude_code:
    binary: "claude"                  # path to claude CLI
    model: "claude-sonnet-4-20250514"  # optional model override
    max_tokens: 8192
  hermes:
    profile: "reviewer"
    binary: "hermes"
  opencode:
    binary: "opencode"
  generic:
    command: "python review.py --diff {diff_file} --context {context_file} --output {output_file}"
    # {diff_file}    — temp file with unified diff
    # {context_file} — temp file with PR metadata JSON
    # {output_file}  — where the command writes its JSON result

# Review behavior
review:
  # Auto-approve if no issues found?
  auto_approve: false
  # Maximum diff size (chars) to send to agent (skip huge PRs)
  max_diff_size: 100000
  # Skip draft PRs?
  skip_drafts: true
  # Custom prompt prefix (prepended to the review prompt)
  prompt_prefix: ""

# Dedup / state
state:
  path: "~/.config/review-agent/seen.json"
  prune_days: 30

# Logging
logging:
  level: "INFO"                       # DEBUG | INFO | WARNING | ERROR
  file: "~/.config/review-agent/logs/review-agent.log"
  max_bytes: 10485760                 # 10 MB
  backup_count: 5
```

Environment variable overrides (take precedence over config file):
- `GITHUB_TOKEN` → `github.token`
- `WEBHOOK_SECRET` → `webhook.secret`
- `REVIEW_AGENT_CONFIG` → path to config file (default: `~/.config/review-agent/config.yaml`)

---

## Flow: Event to Published Review

```
1. EVENT DETECTION
   ┌─────────────────────────────────────────────────────────────┐
   │ Polling:                                                    │
   │   Timer fires (every N seconds)                             │
   │   → gh search prs --review-requested=@me --state=open      │
   │   → list of {repo, pr_number, url}                          │
   │                                                             │
   │ Webhook:                                                    │
   │   POST /hook received                                       │
   │   → Validate HMAC-SHA256 signature                          │
   │   → Parse payload → {repo, pr_number, reviewer}             │
   └────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
2. DEDUP CHECK
   ┌─────────────────────────────────────────────────────────────┐
   │ Load seen.json                                              │
   │ If PR URL already in set → skip (log DEBUG, return)         │
   │ If repo not in config repos filter → skip                   │
   │ If PR is draft and skip_drafts=true → skip                  │
   └────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
3. PR CONTEXT EXTRACTION
   ┌─────────────────────────────────────────────────────────────┐
   │ GitHub API (5 calls, ~2s):                                  │
   │   1. GET /pulls/{n}         → title, body, branches, author │
   │   2. GET /pulls/{n} (diff)  → unified diff text             │
   │   3. GET /pulls/{n}/files   → per-file patches              │
   │   4. GET /pulls/{n}/comments → inline review comments       │
   │   5. GET /issues/{n}/comments → top-level comments          │
   │                                                             │
   │ If diff > max_diff_size → log WARNING, skip PR              │
   │                                                             │
   │ Assemble PRContext object                                   │
   └────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
4. AGENT REVIEW
   ┌─────────────────────────────────────────────────────────────┐
   │ Agent Router selects adapter by config agent.name           │
   │                                                             │
   │ Build prompt:                                               │
   │   - System: "You are a code reviewer. Analyze this PR."     │
   │   - Context: PR title, description, author                  │
   │   - Diff: full unified diff or per-file patches             │
   │   - Existing comments (for awareness, avoid duplicates)     │
   │   - Output format: JSON with verdict + inline comments      │
   │                                                             │
   │ Invoke adapter.review(PRContext) → ReviewResult             │
   │   Timeout: agent.timeout_seconds (default 300s)             │
   │                                                             │
   │ Parse and validate ReviewResult                             │
   │   - verdict must be APPROVE | REQUEST_CHANGES | COMMENT     │
   │   - comments[].path must exist in PR files                  │
   │   - comments[].line must be within diff range               │
   └────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
5. PUBLISH REVIEW
   ┌─────────────────────────────────────────────────────────────┐
   │ POST /repos/{o}/{r}/pulls/{n}/reviews                       │
   │   event: ReviewResult.verdict                               │
   │   body: ReviewResult.body                                   │
   │   comments: [{path, line, body}, ...]                       │
   │                                                             │
   │ For each inline comment thread that needs a reply:          │
   │   POST /repos/{o}/{r}/pulls/{n}/comments/{id}/replies       │
   │                                                             │
   │ On success: add PR URL to seen.json                         │
   │ On failure: log ERROR, do NOT add to seen (retry next poll) │
   └─────────────────────────────────────────────────────────────┘
```

---

## Directory Structure (planned)

```
review-agent/
├── config.example.yaml
├── pyproject.toml
├── README.md
├── src/
│   └── review_agent/
│       ├── __init__.py
│       ├── __main__.py          # CLI entry point
│       ├── config.py            # Config loading + validation
│       ├── models.py            # PRContext, ReviewResult, etc.
│       ├── github_client.py     # GitHub API wrapper (context extractor + publisher)
│       ├── dedup.py             # seen.json management
│       ├── webhook.py           # FastAPI webhook server
│       ├── poller.py            # Polling loop
│       ├── router.py            # Agent router
│       └── adapters/
│           ├── __init__.py
│           ├── base.py          # ReviewAgent ABC
│           ├── claude_code.py
│           ├── hermes.py
│           ├── opencode.py
│           └── generic.py
└── tests/
    ├── test_config.py
    ├── test_dedup.py
    ├── test_github_client.py
    ├── test_webhook.py
    ├── test_poller.py
    └── test_adapters/
        ├── test_claude_code.py
        └── test_generic.py
```

---

## Key Design Decisions

1. **Python, not Node** — the host repo is Vue/TS, but the service is standalone tooling. Python chosen for: `gh` CLI interop, GitHub API libraries (httpx), FastAPI for webhook server, and alignment with the AI agent ecosystem (all four target agents have Python SDKs/CLIs).

2. **gh CLI for polling, not raw REST** — `gh search prs --review-requested=@me` handles auth, pagination, and cross-repo search in one call. No need to manage tokens separately for polling mode.

3. **File-based dedup, not a database** — a JSON set of PR URLs is sufficient. Code review volume is low (tens per day, not thousands). No SQLite/Redis dependency.

4. **Dual input, shared dedup** — webhook and polling can run simultaneously without double-processing. Both check the same `seen.json` before dispatching.

5. **Config YAML, secrets via env** — YAML for readability. Tokens and secrets should come from env vars in production; config file values are fallbacks for local dev.

6. **Agent timeout without retry** — AI agent runs are expensive and non-idempotent. If an agent fails or times out, log it and skip. The user can manually re-trigger. The PR stays in seen.json only on *successful* publish, so next poll cycle will retry context extraction + agent invocation.

7. **Validate ReviewResult before publishing** — agent output can hallucinate file paths or line numbers outside the diff. Validate `comments[].path` against PR files and `comments[].line` against diff ranges. Drop invalid comments with a WARNING log, publish the rest.
