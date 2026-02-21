# WHOOP CLI

Minimal Bun CLI to authenticate against the WHOOP API and show your latest overview data.

## What it does

- One-time OAuth login with browser callback on localhost
- Stores token + client credentials in your OS config directory
- Reuses and refreshes token automatically
- Fetches WHOOP overview data sections:
  - profile
  - cycle
  - recovery
  - sleep
- Supports human-readable output and raw JSON (`--json`)
  - Pretty output: all informational fields (metadata removed)
  - JSON output: raw API payloads

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

Raw JSON:

```bash
bun run src/index.ts overview --json
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
