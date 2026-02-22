#!/usr/bin/env bun
import { input, password } from "@inquirer/prompts";

import { openBrowser } from "./browser";
import { parseArgs, readStringFlag } from "./cli";
import {
  clearAllConfig,
  getConfigPath,
  loadConfig,
  maskValue,
  saveConfig,
} from "./config";
import { DEFAULT_OAUTH_SCOPE, DEFAULT_REDIRECT_URI } from "./constants";
import { formatOverview, formatRecovery, formatSleep, formatUser } from "./format";
import {
  buildAuthorizeUrl,
  exchangeAuthorizationCode,
  generateState,
  tokenResponseToConfig,
  waitForAuthCode,
} from "./oauth";
import type { Config } from "./types";
import { fetchOverview, fetchRecovery, fetchSleep, fetchUser } from "./whoop";

const HELP_TEXT = `
whoop-cli

Usage:
  whoop <command> [options]

Commands:
  login               Authenticate with WHOOP and store token locally.
  overview            Fetch WHOOP cycle overview data.
  recovery            Fetch WHOOP recovery data.
  sleep               Fetch WHOOP sleep data.
  user                Fetch WHOOP user profile and body measurements.
  status              Show auth/config status.
  logout              Remove all WHOOP CLI config.
  help                Show this help text.

login options:
  --client-id <id>
  --client-secret <secret>
  If omitted, both values are prompted in the terminal.

overview options:
  --limit <n>                Number of cycles to fetch (1-100, default: 1).
  --json                     Emit raw JSON.

recovery options:
  --limit <n>                Number of records to fetch (1-100, default: 1).
  --json                     Emit raw JSON.

sleep options:
  --limit <n>                Number of records to fetch (1-100, default: 1).
  --json                     Emit raw JSON.

user options:
  --json                     Emit raw JSON.
`.trim();

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  const command = parsed.command;

  if (
    !command ||
    command === "help" ||
    command === "--help" ||
    command === "-h"
  ) {
    console.log(HELP_TEXT);
    return;
  }

  if (command === "login") {
    await handleLogin(parsed.flags);
    return;
  }

  if (command === "overview") {
    await handleOverview(parsed.flags);
    return;
  }

  if (command === "status") {
    await handleStatus();
    return;
  }

  if (command === "recovery") {
    await handleRecovery(parsed.flags);
    return;
  }

  if (command === "sleep") {
    await handleSleep(parsed.flags);
    return;
  }

  if (command === "user") {
    await handleUser(parsed.flags);
    return;
  }

  if (command === "logout") {
    await handleLogout();
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

async function handleLogin(
  flags: Record<string, string | boolean>,
): Promise<void> {
  const config = await loadConfig();
  const argClientId = readStringFlag(flags, "client-id")?.trim();
  const argClientSecret = readStringFlag(flags, "client-secret")?.trim();

  if ((argClientId && !argClientSecret) || (!argClientId && argClientSecret)) {
    throw new Error(
      "Provide both --client-id and --client-secret, or provide neither and the CLI will prompt for both.",
    );
  }

  let clientId = argClientId;
  let clientSecret = argClientSecret;
  if (!clientId && !clientSecret) {
    const prompted = await promptCredentials();
    clientId = prompted.clientId;
    clientSecret = prompted.clientSecret;
  }
  if (!clientId || !clientSecret) {
    throw new Error("Missing client credentials.");
  }

  const redirectUri = DEFAULT_REDIRECT_URI;
  const scope = DEFAULT_OAUTH_SCOPE;
  const state = generateState();
  const authorizeUrl = buildAuthorizeUrl({
    clientId,
    redirectUri,
    state,
    scope,
  });
  const codePromise = waitForAuthCode({ redirectUri, expectedState: state });

  console.log("Opening browser for WHOOP login...");
  await openBrowser(authorizeUrl);
  console.log(`If the browser does not open, use this URL:\n${authorizeUrl}`);

  const code = await codePromise;
  const token = await exchangeAuthorizationCode({
    code,
    clientId,
    clientSecret,
    redirectUri,
  });
  const tokenConfig = tokenResponseToConfig(token);

  config.oauth = {
    ...config.oauth,
    clientId,
    clientSecret,
    ...tokenConfig,
    refreshToken: tokenConfig.refreshToken ?? config.oauth?.refreshToken,
  };

  await saveConfig(config);
  console.log("Login successful.");
}

async function handleOverview(
  flags: Record<string, string | boolean>,
): Promise<void> {
  const config = await loadConfig();
  requireLoggedInConfig(config);

  const jsonOutput = readJsonFlag(flags);
  const limit = readLimitFlag(flags);
  const payload = await fetchOverview(config, saveConfig, { limit });

  if (jsonOutput) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(formatOverview(payload));
}

async function handleRecovery(
  flags: Record<string, string | boolean>,
): Promise<void> {
  const config = await loadConfig();
  requireLoggedInConfig(config);

  const jsonOutput = readJsonFlag(flags);
  const limit = readLimitFlag(flags);
  const payload = await fetchRecovery(config, saveConfig, { limit });

  if (jsonOutput) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(formatRecovery(payload));
}

async function handleSleep(
  flags: Record<string, string | boolean>,
): Promise<void> {
  const config = await loadConfig();
  requireLoggedInConfig(config);

  const jsonOutput = readJsonFlag(flags);
  const limit = readLimitFlag(flags);
  const payload = await fetchSleep(config, saveConfig, { limit });

  if (jsonOutput) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(formatSleep(payload));
}

async function handleUser(flags: Record<string, string | boolean>): Promise<void> {
  const config = await loadConfig();
  requireLoggedInConfig(config);

  const jsonOutput = readJsonFlag(flags);
  const payload = await fetchUser(config, saveConfig);

  if (jsonOutput) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(formatUser(payload));
}

async function handleStatus(): Promise<void> {
  const config = await loadConfig();
  const oauth = config.oauth ?? {};
  const loggedIn = Boolean(oauth.accessToken && oauth.refreshToken);

  console.log(`Config path: ${getConfigPath()}`);
  console.log(`Logged in: ${loggedIn ? "yes" : "no"}`);
  console.log(`Client ID: ${maskValue(oauth.clientId)}`);
  console.log(`Client secret set: ${oauth.clientSecret ? "yes" : "no"}`);
}

async function handleLogout(): Promise<void> {
  await clearAllConfig();
  console.log("Removed all WHOOP CLI config.");
}

function requireLoggedInConfig(config: Config): void {
  if (
    !config.oauth?.clientId ||
    !config.oauth?.clientSecret ||
    !config.oauth?.refreshToken
  ) {
    throw new Error("Missing login credentials. Run `whoop login` first.");
  }
}

function readJsonFlag(flags: Record<string, string | boolean>): boolean {
  return flags.json === true || flags.json === "true";
}

function readLimitFlag(flags: Record<string, string | boolean>): number {
  const value = flags.limit;
  if (value === undefined) {
    return 1;
  }

  if (typeof value !== "string") {
    throw new Error("Missing value for --limit. Use --limit <n>.");
  }

  if (!/^\d+$/.test(value)) {
    throw new Error("Invalid --limit value. It must be an integer between 1 and 100.");
  }

  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("Invalid --limit value. It must be an integer between 1 and 100.");
  }

  return limit;
}

async function promptCredentials(): Promise<{
  clientId: string;
  clientSecret: string;
}> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "Interactive login requires a TTY. Pass --client-id and --client-secret.",
    );
  }

  const clientId = (await promptRequiredInput("WHOOP Client ID")).trim();
  const clientSecret = (
    await promptRequiredPassword("WHOOP Client Secret")
  ).trim();
  return { clientId, clientSecret };
}

async function promptRequiredInput(message: string): Promise<string> {
  return await input({
    message,
    validate(value) {
      return value.trim().length > 0 || "Value cannot be empty.";
    },
  });
}

async function promptRequiredPassword(message: string): Promise<string> {
  return await password({
    message,
    mask: "*",
    validate(value) {
      return value.trim().length > 0 || "Value cannot be empty.";
    },
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});
