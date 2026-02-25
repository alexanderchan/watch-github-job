# watch-github-job

Watches a GitHub Actions run in your terminal until it completes, then opens the browser. Auto-detects the relevant run from your current branch so you don't have to copy-paste URLs.

## Usage

```bash
# Auto-detect from current branch (prefers CI, then Deploy)
watch-github-job

# Watch a specific run by ID or URL
watch-github-job 22412559223
watch-github-job https://github.com/org/repo/actions/runs/22412559223

# Override workflow priority filters
watch-github-job --text "Build,Test"

# Don't open browser on completion
watch-github-job --no-open

# Longer timeout
watch-github-job --timeout 60
```

While watching, it prints a single updating status line:

```
⏳ in_progress    step: Run unit tests (shard 1/3)            elapsed: 8m42s
```

Elapsed time is measured from when the job actually started (not when you ran the command), so attaching mid-run shows the real duration.

On completion it prints the conclusion and opens the run in your browser:

```
✅ Completed: success  (elapsed: 12m4s)
```

Exits `0` on success, `1` on failure or timeout.

## How run detection works

When no run ID is provided, it tries two strategies in order:

**1. Latest run for current branch**

- Gets the current git branch
- Looks up the open PR for that branch to get its head SHA
- Fetches the 50 most recent runs on the branch
- If runs exist on the exact PR SHA, scopes to those; otherwise uses all branch runs
- Picks the first run whose name matches a priority filter (see below)

**2. Active runs by current user** (fallback if no branch run is found)

- Gets your GitHub username via `gh api user`
- Collects runs with status `in_progress`, `queued`, and `waiting`
- Picks by priority filter from the combined list

## Priority filters

The `--text` option takes a comma-delimited list of workflow name patterns tried in order. The first match wins. If nothing matches, it falls back to the first run found regardless of name.

Default: `CI,Deploy`

Examples:
- `--text "CI"` — only match CI
- `--text "Build,CI,Deploy"` — prefer Build, then CI, then Deploy
- `--text ""` — match any workflow (first run found)

Patterns are case-insensitive regular expressions, so `"CI"` matches `"CI / lint"`, `"CI checks"`, etc.

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--text <filters>` | `CI,Deploy` | Priority-ordered comma-delimited workflow name filters |
| `--no-open` | — | Don't open browser when run completes |
| `--timeout <minutes>` | `35` | Give up after N minutes |

## Installation

```bash
cd watch-github-job
npm install
npm run build
npm link
```

Requires `gh` (GitHub CLI) to be installed and authenticated.

## Polling intervals

- First 5 minutes: polls every **15 seconds**
- After 5 minutes: polls every **60 seconds**
