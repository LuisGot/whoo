---
name: whoo-cli
description: >
  Use the whoo CLI to retrieve and interpret WHOOP health data: recovery score, HRV, sleep
  quality, strain, SpO2, and body measurements. Invoke when the user asks about their WHOOP
  metrics, readiness, fitness recovery, sleep performance, wearable health data, or wants to
  pull or analyze WHOOP data for any date range.
---

# whoo CLI

`whoo` is a CLI for the WHOOP API. Install globally with Bun:

```bash
bun add -g whoo   # requires Bun 1.3+
```

## Prerequisites (one-time setup, done once by the user)

1. Create a developer app at https://developer.whoop.com — note `client_id` and `client_secret`.
2. Add redirect URI in the app settings: `http://127.0.0.1:8123/callback`
3. Authenticate:

```bash
whoo login                                          # prompts for credentials, opens browser
whoo login --client-id <ID> --client-secret <SEC>  # non-interactive
```

For SSH or headless environments where `http://127.0.0.1:8123` is not reachable, use `--manual`.
It prints the auth URL; complete login in any browser, then paste the full callback URL back:

```bash
whoo login --manual
whoo login --manual --client-id <ID> --client-secret <SEC>
```

Tokens persist in the OS config directory and refresh automatically. Check auth state anytime:

```bash
whoo status
```

## Commands

| Command         | Returns                                      | Flags               |
| --------------- | -------------------------------------------- | ------------------- |
| `whoo overview` | Active cycle with nested recovery and sleep  | `--limit`, `--json` |
| `whoo recovery` | Recovery scores                              | `--limit`, `--json` |
| `whoo sleep`    | Sleep sessions                               | `--limit`, `--json` |
| `whoo user`     | Profile and body measurements                | `--json`            |
| `whoo status`   | Auth state (logged in / credential presence) | —                   |
| `whoo logout`   | Clear stored credentials                     | —                   |

- `--limit <n>` — records to return (1–100, default 1)
- `--json` — raw JSON payload; use this for programmatic access
- `--manual` — manual login for SSH/headless; paste callback URL instead of browser auto-redirect

## Common Workflows

**Latest recovery snapshot:**

```bash
whoo recovery --json
# key: recoveries[0].score.recovery_score  (0–100 %)
```

**Full today (cycle + recovery + sleep in one call):**

```bash
whoo overview --json
# keys: cycles[0].cycle.score.strain, cycles[0].recovery.score, cycles[0].sleep.score
```

**7-day sleep trend:**

```bash
whoo sleep --limit 7 --json
# iterate: sleeps[].score.sleep_performance_percentage
```

**30-day history:**

```bash
whoo overview --limit 30 --json
```

**User profile and body stats:**

```bash
whoo user --json
```

## Error Handling

| Error message                     | Fix                                                   |
| --------------------------------- | ----------------------------------------------------- |
| `"Missing login credentials"`     | Run `whoo login`                                      |
| Persistent 401 after auto-refresh | Run `whoo login` again to re-authenticate             |
| `score_state: "PENDING_MANUAL"`   | WHOOP hasn't scored yet — skip or surface to the user |
| `score_state: "UNSCORABLE"`       | Insufficient data for scoring — treat as null         |

Always check `score_state === "SCORED"` before interpreting numeric metrics.

## References

- **JSON output schemas** (field names, types, units): read `references/schemas.md`
- **Metric interpretation** (healthy ranges, score zones, context): read `references/metrics.md`
