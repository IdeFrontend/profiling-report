# Способы получения событий code-review из GitHub

Исследование механизмов обнаружения запросов на code-review для сценария «локальный агент слушает review requests».

---

## 1. GitHub Webhooks (push-модель)

### Как работает

GitHub отправляет HTTP POST на указанный URL при каждом событии. Для code-review релевантны три типа событий:

| Событие | Когда срабатывает | Ключевые action-ы |
|---|---|---|
| `pull_request` | Любая активность с PR | `review_requested`, `review_request_removed`, `opened`, `synchronize` |
| `pull_request_review` | Рецензент отправил review | `submitted`, `edited`, `dismissed` |
| `pull_request_review_comment` | Комментарий к diff-у | `created`, `edited`, `deleted` |

### Ключевые поля payload

```jsonc
// pull_request event, action: review_requested
{
  "action": "review_requested",
  "number": 42,
  "pull_request": {
    "number": 42,
    "title": "Add new feature",
    "html_url": "https://github.com/owner/repo/pull/42",
    "diff_url": "https://github.com/owner/repo/pull/42.diff",
    "head": { "ref": "feature-branch", "sha": "abc123" },
    "base": { "ref": "main" },
    "user": { "login": "author" }
  },
  "requested_reviewer": { "login": "reviewer-username" },
  // или для команды:
  "requested_team": { "name": "team-name", "slug": "team-slug" },
  "repository": {
    "full_name": "owner/repo",
    "clone_url": "https://github.com/owner/repo.git"
  },
  "sender": { "login": "who-requested" }
}
```

### Настройка

Repo Settings → Webhooks → Add webhook:
- **Payload URL:** `https://your-server.com/webhook`
- **Content type:** `application/json`
- **Secret:** `<shared-secret>` (HMAC-SHA256 валидация)
- **Events:** выбрать `Pull requests`, `Pull request reviews`, `Pull request review comments`

### Минимальный обработчик (Python / Flask)

```python
import hmac, hashlib, json
from flask import Flask, request, abort

app = Flask(__name__)
WEBHOOK_SECRET = b"your-secret"

@app.route("/webhook", methods=["POST"])
def webhook():
    # Валидация подписи
    sig = request.headers.get("X-Hub-Signature-256", "")
    mac = hmac.new(WEBHOOK_SECRET, request.data, hashlib.sha256)
    if not hmac.compare_digest(f"sha256={mac.hexdigest()}", sig):
        abort(403)

    event = request.headers.get("X-GitHub-Event")
    payload = request.json

    if event == "pull_request" and payload["action"] == "review_requested":
        reviewer = payload.get("requested_reviewer", {}).get("login")
        pr_url = payload["pull_request"]["html_url"]
        pr_number = payload["number"]
        repo = payload["repository"]["full_name"]
        # → Запуск локального агента для ревью
        print(f"Review requested: {repo}#{pr_number} → {reviewer}")

    return "ok", 200
```

### Доставка на локальную машину

Webhook требует публичный URL. Варианты для локального агента:

| Инструмент | Команда | Заметки |
|---|---|---|
| **ngrok** | `ngrok http 5000` | Бесплатный план, стабильный туннель |
| **Cloudflare Tunnel** | `cloudflared tunnel --url localhost:5000` | Бесплатно, без лимитов |
| **zrok** | `zrok share public localhost:5000` | Open-source |
| **smee.io** | `smee -u https://smee.io/xxx -t http://localhost:5000/webhook` | GitHub рекомендует для dev |

### Плюсы
- **Моментальная реакция** — событие приходит в секунды
- **Нет polling-а** — нулевая нагрузка на API rate limits
- **Полный payload** — вся информация в одном запросе
- **Надёжно** — GitHub гарантирует доставку, повторяет при ошибках, хранит историю delivery

### Минусы
- **Нужен публичный endpoint** — туннель или реверс-прокси
- **Сложность инфраструктуры** — HTTPS, валидация подписей, обработка ошибок
- **Downtime** — если агент упал, пропустит events (но можно redeliver вручную)
- **Один webhook на endpoint** — если несколько агентов, нужен маршрутизатор

---

## 2. GitHub API — Polling (pull-модель)

### 2a. REST API: Search Issues/PRs

Самый удобный endpoint для обнаружения pending review requests:

```bash
# Все открытые PR, где ты — запрошенный reviewer (лично, без команд)
curl -s -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/search/issues?q=is:open+is:pr+user-review-requested:USERNAME"

# Включая командные запросы
curl -s -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/search/issues?q=is:open+is:pr+review-requested:USERNAME"

# В конкретной организации
curl -s -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/search/issues?q=is:open+is:pr+user-review-requested:USERNAME+org:my-org"
```

Ответ содержит `items[]` со стандартными issue/PR объектами:
```jsonc
{
  "total_count": 3,
  "items": [
    {
      "number": 42,
      "title": "Add new feature",
      "html_url": "https://github.com/owner/repo/pull/42",
      "repository_url": "https://api.github.com/repos/owner/repo",
      "pull_request": {
        "url": "https://api.github.com/repos/owner/repo/pulls/42",
        "diff_url": "https://github.com/owner/repo/pull/42.diff"
      },
      "user": { "login": "author" },
      "updated_at": "2026-01-15T10:30:00Z"
    }
  ]
}
```

### 2b. REST API: Per-PR Review Requests

Для конкретного PR — кто запрошен как reviewer:

```bash
curl -s -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/repos/OWNER/REPO/pulls/42/requested_reviewers"
```

Ответ:
```jsonc
{
  "users": [{ "login": "reviewer1", "id": 123 }],
  "teams": [{ "slug": "frontend-team", "name": "Frontend Team" }]
}
```

### 2c. GraphQL API — одним запросом

```graphql
{
  search(query: "is:open is:pr review-requested:USERNAME", type: ISSUE, first: 20) {
    nodes {
      ... on PullRequest {
        number
        title
        url
        repository { nameWithOwner }
        author { login }
        reviewRequests(first: 10) {
          nodes {
            requestedReviewer {
              ... on User { login }
              ... on Team { name slug }
            }
          }
        }
        createdAt
        updatedAt
      }
    }
  }
}
```

```bash
gh api graphql -f query='{ search(query: "is:open is:pr user-review-requested:@me", type: ISSUE, first: 20) { nodes { ... on PullRequest { number title url repository { nameWithOwner } } } } }'
```

### Rate Limits

| API | Лимит | Заметки |
|---|---|---|
| REST Search | 30 req/min (auth) | 10 req/min без auth |
| REST other | 5000 req/hour | per token |
| GraphQL | 5000 points/hour | search ~1 point |

Для polling каждые 1-2 минуты: ~30-60 req/час — укладывается с запасом.

### Минимальный поллер (bash / cron)

```bash
#!/bin/bash
# poll-reviews.sh — запускать через cron каждые 2 минуты
SEEN_FILE="$HOME/.review-seen"
touch "$SEEN_FILE"

NEW_PRS=$(gh api "search/issues?q=is:open+is:pr+user-review-requested:@me&sort=updated" \
  --jq '.items[] | "\(.repository_url | split("/") | .[-2:]| join("/")) #\(.number) \(.title)"')

while IFS= read -r line; do
  [ -z "$line" ] && continue
  if ! grep -qF "$line" "$SEEN_FILE"; then
    echo "$line" >> "$SEEN_FILE"
    echo "NEW REVIEW REQUEST: $line"
    # → запуск агента
  fi
done <<< "$NEW_PRS"
```

### Плюсы
- **Нет инфраструктуры** — не нужен публичный endpoint, туннель, серверы
- **Простота** — один curl/gh вызов, легко отлаживать
- **Кросс-репозиторный** — один запрос покрывает ВСЕ репозитории пользователя/org
- **Устойчив к downtime** — агент опрашивает при старте, не пропускает

### Минусы
- **Задержка** — от 1 до 5 минут в зависимости от интервала polling-а
- **Rate limits** — при агрессивном polling-е можно упереться в 30 req/min (search)
- **Нет деталей** — search возвращает issue-like объект, нужен дополнительный запрос за diff/files
- **Повторная обработка** — нужно самому отслеживать, какие PR уже обработаны

---

## 3. GitHub CLI (`gh`)

### Обнаружение pending reviews

```bash
# Все PR с вашим pending review (кросс-репозиторно)
gh search prs --review-requested=@me --state=open

# С JSON-выводом для автоматизации
gh search prs --review-requested=@me --state=open \
  --json number,title,repository,url

# В конкретном репозитории
gh pr list -R owner/repo --search "review-requested:@me"

# Статус текущего репо (секция "Requesting a code review from you")
gh pr status
```

### `gh pr status` — секция review requests

```
$ gh pr status
Relevant pull requests in owner/repo

Current branch
  There is no pull request associated with [main]

Created by you
  #10 My feature [feature-branch]

Requesting a code review from you
  #42 Add new feature [add-feature] - Review required
  #38 Fix bug [fix-bug] - Changes requested
```

### Пример: поллер на gh

```bash
#!/bin/bash
# gh-review-poll.sh
gh search prs --review-requested=@me --state=open \
  --json number,title,repository,url \
  --jq '.[] | "[\(.repository.nameWithOwner)] #\(.number) \(.title)"'
```

### Плюсы
- **Минимальный код** — одна команда, встроенный JSON/jq
- **Авторизация из коробки** — `gh auth` хранит токен
- **Кросс-репозиторный** — `gh search prs` ищет по всем доступным repos
- **Нет зависимостей** — только `gh` CLI

### Минусы
- **Те же rate limits** — `gh` использует REST/GraphQL API под капотом
- **Нет real-time** — только polling
- **Ограниченный вывод** — `gh pr status` работает только для текущего repo
- **Нет webhook mode** — `gh webhook forward` требует расширение (не установлено)

---

## 4. GitHub Actions (self-hosted runner / workflow_dispatch)

### Вариант A: Workflow на событии review_requested

```yaml
# .github/workflows/on-review-request.yml
name: Notify Agent on Review Request
on:
  pull_request:
    types: [review_requested]

jobs:
  notify-agent:
    runs-on: self-hosted  # ваш локальный runner
    steps:
      - name: Trigger local review agent
        run: |
          echo "Review requested on PR #${{ github.event.pull_request.number }}"
          echo "Reviewer: ${{ github.event.requested_reviewer.login }}"
          echo "Repo: ${{ github.repository }}"
          echo "Diff: ${{ github.event.pull_request.diff_url }}"
          # Вызов локального агента
          curl -X POST http://localhost:8080/review \
            -d '{"repo":"${{ github.repository }}","pr":${{ github.event.pull_request.number }}}'
```

### Вариант B: Workflow_dispatch для ручного/API триггера

```yaml
# .github/workflows/run-review.yml
name: Run Review Agent
on:
  workflow_dispatch:
    inputs:
      pr_number:
        description: 'PR number to review'
        required: true

jobs:
  review:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.ref || github.ref }}
      - name: Run review
        run: |
          echo "Reviewing PR #${{ inputs.pr_number }}"
```

Триггер через API:
```bash
gh workflow run run-review.yml -f pr_number=42
```

### Self-hosted runner: установка

```bash
# Linux/macOS
mkdir actions-runner && cd actions-runner
curl -o actions-runner.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.321.0/actions-runner-linux-x64-2.321.0.tar.gz
tar xzf actions-runner.tar.gz
./config.sh --url https://github.com/OWNER/REPO --token YOUR_TOKEN
./run.sh  # или ./svc.sh install для systemd-сервиса
```

### Плюсы
- **Встроено в GitHub** — нет внешних сервисов, туннелей
- **Код рядом** — runner уже имеет checkout репозитория
- **Аудит** — логи Actions видны в UI GitHub
- **Масштабируется** — можно добавить runner-ов

### Минусы
- **Тяжеловесно** — runner-процесс постоянно работает, потребляет ресурсы
- **Задержка** — GitHub Actions queue может добавить 5-30 сек
- **Per-repo** — workflow привязан к конкретному репозиторию (или нужен org-level runner)
- **Overkill** — полный CI-runner для простой задачи «получить событие»
- **GitHub Actions minutes** — не тратит minutes на self-hosted, но runner должен быть online

---

## Сравнительная таблица

| Критерий | Webhooks | API Polling | gh CLI | Actions |
|---|---|---|---|---|
| **Задержка** | ~1 сек | 1-5 мин | 1-5 мин | 5-30 сек |
| **Инфраструктура** | Публичный URL + сервер | Ничего | Ничего | Self-hosted runner |
| **Кросс-репозиторность** | Один hook per repo/org | Один запрос для всех | Один запрос для всех | Per-repo workflow |
| **Сложность настройки** | Средняя | Низкая | Минимальная | Средняя |
| **Надёжность** | Высокая (redelivery) | Высокая (idempotent) | Высокая | Высокая |
| **Rate limit нагрузка** | Нулевая | 30 req/min (search) | 30 req/min | Нулевая |
| **Offline-устойчивость** | Пропускает (redelivery ручной) | Подхватывает при старте | Подхватывает при старте | Очередь Actions |

---

## Рекомендация для сценария «локальный агент слушает review requests»

### Лучший подход: **gh CLI polling** (основной) + **Webhooks** (опционально)

**Для начала — polling через `gh`:**

```bash
# Cron каждые 2 минуты
*/2 * * * * /path/to/poll-reviews.sh
```

```bash
#!/bin/bash
# poll-reviews.sh
set -euo pipefail

SEEN="$HOME/.hermes/review-seen.json"
mkdir -p "$(dirname "$SEEN")"
[ -f "$SEEN" ] || echo '[]' > "$SEEN"

# Получить все pending review requests
CURRENT=$(gh search prs --review-requested=@me --state=open \
  --json number,repository,url,title 2>/dev/null || echo '[]')

echo "$CURRENT" | jq -c '.[]' | while read -r pr; do
  URL=$(echo "$pr" | jq -r '.url')
  if ! jq -e --arg u "$URL" '.[] | select(. == $u)' "$SEEN" >/dev/null 2>&1; then
    # Новый PR — запуск агента
    REPO=$(echo "$pr" | jq -r '.repository.nameWithOwner')
    NUM=$(echo "$pr" | jq -r '.number')
    echo "New review request: $REPO#$NUM"
    # hermes kanban create / trigger agent / etc.

    # Записать как обработанный
    jq --arg u "$URL" '. + [$u]' "$SEEN" > "$SEEN.tmp" && mv "$SEEN.tmp" "$SEEN"
  fi
done
```

**Почему:**
1. **Нулевая инфраструктура** — не нужен туннель, публичный IP, сервер
2. **Кросс-репозиторный** — один запрос покрывает все repos и orgs
3. **Устойчив** — при перезагрузке/downtime подхватывает все pending PRs
4. **Просто** — 20 строк bash, легко отлаживать
5. **Задержка 2 мин** — приемлема для code review (человек всё равно не ждёт ответ через 1 сек)

**Когда добавить Webhooks:**
- Нужна реакция < 10 секунд
- Уже есть публичный сервер (VPS, облако)
- Мониторинг десятков repos с высоким потоком PR
- Нужно реагировать на *все* типы PR-событий (not just review requests)

**GitHub Actions — когда выбрать:**
- Агент должен работать в окружении CI (Docker, специфические tools)
- Нужен audit trail в GitHub UI
- Уже используется self-hosted runner для других задач
