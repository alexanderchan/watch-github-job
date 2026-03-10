---
name: watch-github-job
description: Watch a GitHub Actions run until it completes. Use when the user asks to watch CI, monitor a workflow run, wait for checks to pass, or check PR status. Auto-detects the current branch's run. Use --quiet for minimal token output when running inside Claude.
allowed-tools: Bash(watch-github-job*)
---

# Watch GitHub Actions

Blocks until a GitHub Actions run completes, then exits 0 (success) or 1 (failure/timeout).

## Basic usage

```bash
# Auto-detect from current branch (prefers CI, then Deploy)
watch-github-job --no-open

# Watch a specific run by ID or URL
watch-github-job 22412559223 --no-open
watch-github-job https://github.com/org/repo/actions/runs/22412559223 --no-open
```

## Inside Claude — always use --quiet --no-open

```bash
watch-github-job --quiet --no-open
```

`--quiet` suppresses the intermediate spinner lines. Output is just the header and final result:

```
Run ID: 22886134960
📡 Watching: https://github.com/org/repo/actions/runs/22886134960
🔧 Workflow: CI
📘 Title:    my-branch-name

✅ success  elapsed: 4m32s
```

Without `--quiet`, a `\r`-overwritten status line updates every 15 seconds — fine for a terminal, noisy for Claude.

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--text <filters>` | `CI,Deploy` | Priority-ordered comma-delimited workflow name filters |
| `--no-open` | — | Don't open browser when run completes |
| `--timeout <minutes>` | `35` | Give up after N minutes (exits 1) |
| `--quiet` | — | Suppress intermediate status lines; only print run ID, URL, and final result |

## Run detection (no run ID given)

1. Gets current branch → finds open PR → fetches runs on the PR's head SHA
2. Falls back to active runs by the current GitHub user

`--text` filters pick the first matching workflow name (case-insensitive regex). Default `CI,Deploy` prefers CI over Deploy.

## Exit codes

- `0` — run completed with conclusion `success`
- `1` — run failed, was cancelled, or timed out
