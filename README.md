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

## Install globally

```bash
bun add -g whoo
whoo help
```

## Build standalone binary

Build a native executable:

```bash
bun run build
```

Run it from the project:

```bash
./dist/whoo help
```

Install it to your user `PATH`:

```bash
bun run build
bun run install:local
```

If `~/.local/bin` is not on your `PATH`, add this to your shell profile (`~/.zshrc`, `~/.bashrc`, etc):

```bash
export PATH="$HOME/.local/bin:$PATH"
```

After that you can run:

```bash
whoo help
```

## Commands

```bash
whoo help
```

### Login

```bash
whoo login
```

The CLI opens the WHOOP login page in your browser and listens on:

- `http://127.0.0.1:8123/callback`

When `--client-id` and `--client-secret` are not passed, the CLI prompts for both:

```bash
whoo login
```

You can still pass both directly:

```bash
whoo login --client-id <YOUR_CLIENT_ID> --client-secret <YOUR_CLIENT_SECRET>
```

### Overview

```bash
whoo overview
```

Cycle history:

```bash
whoo overview --limit 7
```

Raw JSON:

```bash
whoo overview --json
```

Raw JSON history:

```bash
whoo overview --limit 7 --json
```

### Recovery

```bash
whoo recovery
```

Recovery history:

```bash
whoo recovery --limit 14
```

### Sleep

```bash
whoo sleep
```

Sleep history:

```bash
whoo sleep --limit 14
```

### User

```bash
whoo user
```

### Status

```bash
whoo status
```

### Logout

```bash
whoo logout
```

## Config path

Config is written to:

- Linux: `~/.config/whoop-cli/config.json`
- macOS: `~/Library/Application Support/whoop-cli/config.json`
- Windows: `%AppData%/whoop-cli/config.json`
