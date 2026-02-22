# WHOOP CLI

Minimal Bun CLI to authenticate against the WHOOP API and inspect WHOOP data from the terminal.

## What it does

- One-time OAuth login with browser callback on localhost
- Stores token + client credentials in your OS config directory
- Reuses and refreshes token automatically
- Fetches WHOOP data by command:
  - `overview`: profile + cycle history with per-cycle recovery/sleep
  - `recovery`: recovery history
  - `sleep`: sleep history
  - `user`: profile + body measurements
- Supports human-readable output and raw JSON (`--json`)
  - Pretty output: all informational fields (metadata removed)
  - JSON output: command payloads

## Prerequisites

1. Bun `1.3+`
2. A WHOOP developer app you create in the WHOOP developer portal
3. Redirect URI configured in your WHOOP app (default used by this CLI):
   - `http://127.0.0.1:8123/callback`

## Install dependencies

```bash
bun install
```

## Commands

```bash
bun run src/index.ts help
```

### Login

```bash
bun run src/index.ts login
```

The CLI opens the WHOOP login page in your browser and listens on:
- `http://127.0.0.1:8123/callback`

When `--client-id` and `--client-secret` are not passed, the CLI prompts for both:

```bash
bun run src/index.ts login
```

You can still pass both directly:

```bash
bun run src/index.ts login --client-id <YOUR_CLIENT_ID> --client-secret <YOUR_CLIENT_SECRET>
```

### Overview

```bash
bun run src/index.ts overview
```

Cycle history:

```bash
bun run src/index.ts overview --limit 7
```

Raw JSON:

```bash
bun run src/index.ts overview --json
```

Raw JSON history:

```bash
bun run src/index.ts overview --limit 7 --json
```

### Recovery

```bash
bun run src/index.ts recovery
```

Recovery history:

```bash
bun run src/index.ts recovery --limit 14
```

### Sleep

```bash
bun run src/index.ts sleep
```

Sleep history:

```bash
bun run src/index.ts sleep --limit 14
```

### User

```bash
bun run src/index.ts user
```

### Status

```bash
bun run src/index.ts status
```

### Logout

```bash
bun run src/index.ts logout
```

## Config path

Config is written to:

- Linux: `~/.config/whoop-cli/config.json`
- macOS: `~/Library/Application Support/whoop-cli/config.json`
- Windows: `%AppData%/whoop-cli/config.json`
