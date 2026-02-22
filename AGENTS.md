# Repository Guidelines

## Project Structure & Module Organization

- `src/index.ts` is the CLI entrypoint and command router (`login`, `overview`, `status`, `logout`).
- Core modules are split by concern: `src/oauth.ts` (OAuth flow), `src/whoop.ts` (WHOOP API calls),
  `src/config.ts` (local config persistence), and `src/format.ts` (human-readable output).
- Shared contracts live in `src/types.ts`; constants are in `src/constants.ts`.
- Tests are module-aligned under `test/` (for example, `test/oauth.test.ts`, `test/whoop.test.ts`).
- No generated build artifacts are committed; this project runs directly with Bun.

## Build, Test, and Development Commands

- `bun install` installs dependencies.
- `bun run src/index.ts help` shows CLI usage.
- `bun run src/index.ts login` starts OAuth login (add `--client-id` and `--client-secret` to skip prompts).
- `bun run src/index.ts overview --json` fetches overview data as raw JSON.
- `bun test` runs the Bun test suite.
- `bunx tsc --noEmit` runs strict TypeScript checks using `tsconfig.json`.

## Coding Style & Naming Conventions

- Language: TypeScript (ES modules, strict mode enabled).
- Follow existing formatting: 2-space indentation, semicolons, trailing commas, and clear guard-clause control flow.
- Naming: `camelCase` for functions/variables, `PascalCase` for types/interfaces/classes, `UPPER_SNAKE_CASE` for constants.
- Keep modules focused and minimal; prefer explicit error messages over implicit failures.

## Testing Guidelines

- Framework: `bun:test` with `describe`, `test`, and `expect`.
- Place tests in `test/` with the pattern `<module>.test.ts`.
- Inject/mimic dependencies (for example, pass `fetchImpl`) to avoid real network calls.
- Cover success and failure paths, especially OAuth/token refresh and empty WHOOP collection responses.

## Security & Configuration Tips

- Never commit WHOOP credentials, tokens, or local config files.
- Config is stored via `conf` in the OS app config directory (`whoop-cli/config.json`).
- Mask secrets in logs and screenshots.

## Sources and references:

- WHOOP API documentation: https://developer.whoop.com/docs/introduction
- WHOOP API schema: https://developer.whoop.com/api
