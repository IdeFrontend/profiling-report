# review-agent

Local service that detects GitHub review requests, gathers PR context, delegates review to a local AI agent, and publishes the result back to the PR.

Runs entirely on your machine — no data leaves except GitHub API calls.

## Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                         LOCAL MACHINE                                │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                    review-agent service                       │    │
│  │                                                              │    │
│  │  ┌─────────────┐   ┌─────────────┐                          │    │
│  │  │  Webhook     │   │  Polling     │                          │    │
│  │  │  Listener    │   │  Loop       │                          │    │
│  │  │  (FastAPI)   │   │  (gh CLI)   │                          │    │
│  │  │  POST /hook  │   │  cron/timer │                          │    │
│  │  └──────┬───────┘   └──────┬──────┘                          │    │
│  │         └────────┬─────────┘                                  │    │
│  │                  ▼                                            │    │
│  │         ┌────────────────┐                                    │    │
│  │         │  Dedup Store   │  seen.json — skip already-handled  │    │
│  │         └───────┬────────┘                                    │    │
│  │                 ▼                                              │    │
│  │         ┌────────────────┐   GitHub REST API                  │    │
│  │         │  PR Context    │   • GET /pulls/:id                 │    │
│  │         │  Extractor     │   • GET /pulls/:id/files           │    │
│  │         │                │   • GET /pulls/:id/comments        │    │
│  │         └───────┬────────┘                                    │    │
│  │                 │ PRContext dataclass                          │    │
│  │                 ▼                                              │    │
│  │         ┌────────────────┐                                    │    │
│  │         │  Agent Router  │  config-driven adapter selection   │    │
│  │         └───────┬────────┘                                    │    │
│  │          ┌──────┼──────────┐                                  │    │
│  │          ▼      ▼          ▼                                  │    │
│  │    ┌─────────┐ ┌────────┐ ┌──────────┐                       │    │
│  │    │ Claude  │ │Hermes/ │ │ Generic  │                       │    │
│  │    │ Code    │ │OpenCode│ │ (custom) │                       │    │
│  │    └────┬────┘ └───┬────┘ └────┬─────┘                       │    │
│  │         └──────────┴───────────┘                              │    │
│  │                    │ ReviewResult                             │    │
│  │                    ▼                                          │    │
│  │         ┌────────────────┐                                    │    │
│  │         │  Review        │   POST /pulls/:id/reviews          │    │
│  │         │  Publisher     │   GitHub API                       │    │
│  │         └────────────────┘                                    │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Optional: ngrok / cloudflared tunnel ──────► GitHub Webhooks        │
└───────────────────────────────────────────────────────────────────────┘
```

**Data flow:** Event source → Dedup → PR Context Extractor → Agent Router → Review Publisher → GitHub PR

## Quick Start

### Prerequisites

- Python 3.11+
- [GitHub CLI (`gh`)](https://cli.github.com/) — for polling mode
- A GitHub Personal Access Token (see [PAT Setup](#github-personal-access-token))
- An AI agent CLI: `claude` (Claude Code), `hermes`, `opencode`, or any custom command

### Install

```bash
cd review-agent
pip install -e ".[dev]"
```

### Minimal config

```bash
mkdir -p ~/.config/review-agent
cp config.example.yaml ~/.config/review-agent/config.yaml
```

Edit `~/.config/review-agent/config.yaml` — set at minimum:
- `github.token` (or export `GITHUB_TOKEN`)
- `agent.name` — which AI agent to use

### Run

```bash
# Polling mode (simplest — no tunnel needed)
review-agent --mode poll

# Webhook mode (requires tunnel — see Webhook Setup below)
review-agent --mode webhook

# Both simultaneously
review-agent --mode both
```

---

## GitHub Personal Access Token

The service needs a GitHub token to read PR diffs/comments and publish reviews.

### Creating a Fine-Grained Token (recommended)

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**
2. Click **Generate new token**
3. Set:
   - **Token name:** `review-agent`
   - **Expiration:** 90 days (or custom)
   - **Repository access:** select the repos you want to review (or "All repositories")
   - **Permissions:**
     - **Pull requests:** Read and Write (read PR data, post reviews)
     - **Contents:** Read-only (read diffs)

4. Click **Generate token** and copy it

### Creating a Classic Token (alternative)

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. Click **Generate new token**
3. Select scopes:
   - `repo` — full repo access (includes PR read/write)
4. Generate and copy

### Configuring the token

Either set it in `config.yaml`:

```yaml
github:
  token: "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

Or as an environment variable (takes precedence over the config file):

```bash
export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

---

## GitHub Webhook Setup

Webhooks give instant notification when a review is requested (no polling delay). This section is optional — polling mode works without any webhook setup.

### 1. Expose local port with a tunnel

The webhook endpoint must be reachable from the internet. Use one of:

**ngrok (simplest):**
```bash
# Install: https://ngrok.com/download
ngrok http 8080
# Copy the https://xxxx.ngrok-free.app URL
```

**cloudflared (Cloudflare Tunnel, free):**
```bash
# Install: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cloudflared tunnel --url http://localhost:8080
# Copy the https://xxxx.trycloudflare.com URL
```

**smee.io (GitHub's own proxy, good for dev):**
```bash
npx smee-client --url https://smee.io/YOUR_CHANNEL --target http://localhost:8080/hook
```

### 2. Generate a webhook secret

```bash
# Generate a random secret (copy the output)
python -c "import secrets; print(secrets.token_hex(32))"
```

Set it in `config.yaml`:
```yaml
webhook:
  enabled: true
  secret: "your-generated-secret-here"
```

Or as an environment variable:
```bash
export WEBHOOK_SECRET="your-generated-secret-here"
```

### 3. Create the webhook in GitHub

**Per-repository:**
1. Go to **repo → Settings → Webhooks → Add webhook**
2. Fill in:
   - **Payload URL:** `https://your-tunnel-url.ngrok-free.app/hook`
   - **Content type:** `application/json`
   - **Secret:** the secret from step 2
   - **Which events:** Select "Let me select individual events", then check:
     - ✅ **Pull requests** (fires on review_requested)
     - ✅ **Pull request reviews** (fires when a review is submitted)
   - **Active:** ✅
3. Click **Add webhook**

**For an organization** (covers all repos):
1. Go to **Organization → Settings → Webhooks → Add webhook**
2. Same settings as above

### 4. Verify

After creating the webhook, GitHub sends a `ping` event. Check your tunnel output and the service logs:

```bash
# Start the service
review-agent --mode webhook

# In another terminal, check health
curl http://localhost:8080/health
# → {"status": "ok"}
```

You should see the ping arrive in the service logs. If not, check the webhook's "Recent Deliveries" tab in GitHub settings for error details.

---

## Agent Configuration

The `agent` section in `config.yaml` selects which AI agent performs the review. Four adapters are built-in:

### Claude Code (`claude-code`)

Uses the `claude` CLI in non-interactive mode.

```yaml
agent:
  name: "claude-code"
  timeout_seconds: 300
  claude_code:
    binary: "claude"      # path to claude CLI (default: "claude")
    model: ""             # optional model override (e.g. "claude-sonnet-4-20250514")
    max_tokens: 8192
```

**Requirements:** Claude Code CLI installed and authenticated (`claude` on PATH).

### Hermes (`hermes`)

Uses `hermes` CLI with `--print-only` flag.

```yaml
agent:
  name: "hermes"
  timeout_seconds: 300
  hermes:
    binary: "hermes"      # path to hermes CLI (default: "hermes")
    profile: "reviewer"   # hermes profile to use (default: "reviewer")
```

**Requirements:** Hermes installed, a `reviewer` profile configured.

### OpenCode (`opencode`)

Uses `opencode` CLI with a prompt file.

```yaml
agent:
  name: "opencode"
  timeout_seconds: 300
  opencode:
    binary: "opencode"    # path to opencode CLI (default: "opencode")
```

**Requirements:** OpenCode installed and configured.

### Generic (`generic`)

Runs any custom command. The command string supports placeholders that get replaced with temp file paths:

| Placeholder      | Content                                      |
|------------------|----------------------------------------------|
| `{prompt_file}`  | Full review prompt (text)                    |
| `{diff_file}`    | Raw unified diff (patch format)              |
| `{context_file}` | PR metadata as JSON (repo, author, files...) |
| `{output_file}`  | Path where the command should write its JSON |

The adapter reads the result from `{output_file}` if it exists, otherwise from stdout.

```yaml
agent:
  name: "generic"
  timeout_seconds: 600
  generic:
    command: "python my_reviewer.py --prompt {prompt_file} --output {output_file}"
```

**Output format** (all adapters must produce this JSON):

```json
{
  "verdict": "APPROVE | REQUEST_CHANGES | COMMENT",
  "body": "Overall review summary",
  "comments": [
    {
      "path": "src/main.py",
      "line": 42,
      "body": "This could cause a null pointer exception",
      "side": "RIGHT"
    }
  ]
}
```

---

## Usage Examples

### Polling mode with `gh` CLI (zero infra)

The simplest setup — no tunnel, no webhook. Uses the `gh` CLI to periodically check for PRs awaiting your review.

```bash
# 1. Install gh and login
gh auth login

# 2. Set token and run
export GITHUB_TOKEN="ghp_..."
review-agent --mode poll
```

Config:
```yaml
polling:
  enabled: true
  interval_seconds: 120  # check every 2 minutes

github:
  repos: []  # empty = all repos; or ["owner/repo-a", "owner/repo-b"]
```

### Webhook mode with ngrok

Real-time — reviews trigger instantly when requested.

```bash
# Terminal 1: start tunnel
ngrok http 8080

# Terminal 2: start service
export GITHUB_TOKEN="ghp_..."
export WEBHOOK_SECRET="your-secret"
review-agent --mode webhook
```

### Both modes simultaneously

Webhook for instant response, polling as a safety net (catches events missed during tunnel downtime).

```bash
review-agent --mode both
```

### Cron-based polling (no daemon)

Instead of running the service continuously, trigger a single poll via cron:

```bash
# Add to crontab (runs every 5 minutes)
*/5 * * * * cd /path/to/review-agent && GITHUB_TOKEN=ghp_... python -m review_agent --mode poll
```

### Custom config location

```bash
review-agent --config /path/to/my-config.yaml
# or
export REVIEW_AGENT_CONFIG=/path/to/my-config.yaml
review-agent
```

---

## Configuration Reference

Default config location: `~/.config/review-agent/config.yaml`

Override with `--config` flag or `REVIEW_AGENT_CONFIG` env var.

See [`config.example.yaml`](config.example.yaml) for a fully commented example.

### All fields

| Section   | Field              | Type       | Default                                          | Description                                  |
|-----------|--------------------|------------|--------------------------------------------------|----------------------------------------------|
| `github`  | `token`            | `string`   | `""`                                             | GitHub PAT (or use `GITHUB_TOKEN` env)       |
| `github`  | `repos`            | `string[]` | `[]`                                             | Repo filter; empty = all repos               |
| `github`  | `reviewer`         | `string`   | `"@me"`                                          | Who to poll for (`gh search --review-requested`) |
| `webhook` | `enabled`          | `bool`     | `false`                                          | Enable webhook listener                      |
| `webhook` | `port`             | `int`      | `8080`                                           | Listen port                                  |
| `webhook` | `host`             | `string`   | `"0.0.0.0"`                                      | Bind address                                 |
| `webhook` | `secret`           | `string`   | `""`                                             | HMAC-SHA256 secret (or `WEBHOOK_SECRET` env) |
| `polling` | `enabled`          | `bool`     | `true`                                           | Enable polling loop                          |
| `polling` | `interval_seconds` | `int`      | `120`                                            | Seconds between polls                        |
| `agent`   | `name`             | `string`   | `"claude-code"`                                  | Adapter: `claude-code`, `hermes`, `opencode`, `generic` |
| `agent`   | `timeout_seconds`  | `int`      | `300`                                            | Max seconds to wait for agent response       |
| `review`  | `auto_approve`     | `bool`     | `false`                                          | Reserved: auto-submit APPROVE verdicts       |
| `review`  | `max_diff_size`    | `int`      | `100000`                                         | Skip PRs with diffs larger than this (chars) |
| `review`  | `skip_drafts`      | `bool`     | `true`                                           | Skip PRs whose body starts with `[WIP]`      |
| `review`  | `prompt_prefix`    | `string`   | `""`                                             | Custom text prepended to the review prompt   |
| `state`   | `path`             | `string`   | `"~/.config/review-agent/seen.json"`             | Dedup store file path                        |
| `state`   | `prune_days`       | `int`      | `30`                                             | Auto-remove entries older than N days        |
| `logging` | `level`            | `string`   | `"INFO"`                                         | Log level: DEBUG, INFO, WARNING, ERROR       |
| `logging` | `file`             | `string`   | `"~/.config/review-agent/logs/review-agent.log"` | Log file path                                |
| `logging` | `max_bytes`        | `int`      | `10485760`                                       | Max log file size before rotation (10 MB)    |
| `logging` | `backup_count`     | `int`      | `5`                                              | Number of rotated log files to keep          |

### Environment Variables

| Variable              | Overrides          | Description                          |
|-----------------------|--------------------|--------------------------------------|
| `GITHUB_TOKEN`        | `github.token`     | GitHub Personal Access Token         |
| `WEBHOOK_SECRET`      | `webhook.secret`   | Webhook HMAC-SHA256 secret           |
| `REVIEW_AGENT_CONFIG` | `--config` flag    | Path to config YAML                  |

Environment variables take precedence over config file values.

---

## API Endpoints

When running in webhook mode, the service exposes:

| Method | Path      | Description                                        |
|--------|-----------|----------------------------------------------------|
| `POST` | `/hook`   | GitHub webhook receiver (HMAC-SHA256 validated)     |
| `GET`  | `/health` | Health check — returns `{"status": "ok"}`          |

---

## Troubleshooting

### `Error: GITHUB_TOKEN env var or github.token in config required`

Set the token in config or environment:
```bash
export GITHUB_TOKEN="ghp_..."
```

### `Error: no mode enabled`

At least one of `webhook.enabled` or `polling.enabled` must be `true` in config. The `--mode` flag selects which enabled modes to run, but doesn't override the config `enabled` flag.

### `gh CLI not found on PATH — polling unavailable`

Install the [GitHub CLI](https://cli.github.com/):
```bash
# macOS
brew install gh

# Windows
winget install --id GitHub.cli

# Linux
# See https://github.com/cli/cli/blob/trunk/docs/install_linux.md
```

Then authenticate: `gh auth login`

### Webhook returns 403 (Bad signature)

- Verify the `webhook.secret` in config matches the secret set in GitHub webhook settings
- Check that `Content type` in GitHub is set to `application/json` (not `application/x-www-form-urlencoded`)

### Webhook events not arriving

1. Check the tunnel is running and the URL matches what's in GitHub webhook settings
2. Check GitHub webhook's **Recent Deliveries** tab for errors
3. Verify the health endpoint: `curl https://your-tunnel/health`
4. Ensure the correct events are selected (Pull requests + Pull request reviews)

### Agent CLI not found

Ensure the agent binary is on PATH:
```bash
which claude   # for claude-code adapter
which hermes   # for hermes adapter
which opencode # for opencode adapter
```

### Agent timeout

Increase `agent.timeout_seconds` in config. Large diffs take longer to review. Consider also increasing `review.max_diff_size` to filter out extremely large PRs.

### Duplicate reviews posted

The dedup store (`seen.json`) tracks reviewed PRs. If you see duplicates:
- Check that `state.path` points to a persistent location (not a temp dir)
- Don't delete `seen.json` while the service is running

### Logs

Check the log file (default `~/.config/review-agent/logs/review-agent.log`) for detailed error information. Set `logging.level: "DEBUG"` for verbose output.

---

## Project Structure

```
review-agent/
├── config.example.yaml          # annotated config template
├── pyproject.toml               # package metadata and deps
├── README.md                    # this file
└── src/review_agent/
    ├── __init__.py
    ├── __main__.py              # CLI entry point (argparse + run modes)
    ├── config.py                # YAML + env config loader
    ├── dedup.py                 # file-based dedup store (seen.json)
    ├── github_client.py         # async GitHub REST API client
    ├── models.py                # shared dataclasses (PRContext, ReviewResult, ...)
    ├── poller.py                # gh CLI polling loop
    ├── router.py                # config-driven agent selection
    ├── webhook.py               # FastAPI POST /hook endpoint
    └── adapters/
        ├── __init__.py
        ├── base.py              # ReviewAgent ABC + prompt builder + JSON parser
        ├── claude_code.py       # Claude Code CLI adapter
        ├── generic.py           # custom command adapter
        ├── hermes.py            # Hermes CLI adapter
        └── opencode.py          # OpenCode CLI adapter
```

## License

See the root repository license.
