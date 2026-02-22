# WHOOP CLI

Minimal CLI to authenticate against the WHOOP API and inspect WHOOP data from the terminal.

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

## Prerequisites

1. Node.js `18+` (for npm installs)
2. Bun `1.3+` (for development/publishing in this repo)
3. A WHOOP developer app in the WHOOP developer portal
4. Redirect URI configured in your WHOOP app:
   - `http://127.0.0.1:8123/callback`

## Install globally

With npm:

```bash
npm i -g whoo
```

With Bun:

```bash
bun add -g whoo
```

Then run:

```bash
whoo --version
whoo help
```

## Development

Install dependencies:

```bash
bun install
```

Run locally:

```bash
bun run src/index.ts help
```

Build the Node CLI bundle used for publishing:

```bash
bun run build
node ./bin/whoo.js --version
```

## Publish

```bash
bun run prepublishOnly
bun publish --access public
```

## Commands

```bash
whoo help
```

### Login

```bash
whoo login
```

You can pass credentials directly:

```bash
whoo login --client-id <YOUR_CLIENT_ID> --client-secret <YOUR_CLIENT_SECRET>
```

### Overview

```bash
whoo overview
whoo overview --limit 7
whoo overview --json
whoo overview --limit 7 --json
```

### Recovery

```bash
whoo recovery
whoo recovery --limit 14
```

### Sleep

```bash
whoo sleep
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
