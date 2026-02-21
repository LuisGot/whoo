import { WHOOP_API_BASE_URL } from "./constants";
import { refreshAccessToken, tokenResponseToConfig } from "./oauth";
import type { Config, JsonObject, OverviewPayload } from "./types";

let refreshInFlight: Promise<void> | null = null;

export class WhoopApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    readonly detail: string,
  ) {
    super(`Whoop API error (${status}) for ${path}: ${detail}`);
  }
}

export async function fetchOverview(
  config: Config,
  persistConfig: (config: Config) => Promise<void>,
  fetchImpl: typeof fetch = fetch,
): Promise<OverviewPayload> {
  const [profile, cycle] = await Promise.all([
    getObject(
      "/developer/v2/user/profile/basic",
      config,
      persistConfig,
      fetchImpl,
    ),
    getLatestFromCollection(
      "/developer/v2/cycle",
      config,
      persistConfig,
      fetchImpl,
    ),
  ]);

  const cycleId = readCycleId(cycle);
  if (!cycleId) {
    return {
      profile,
      cycle,
      recovery: null,
      sleep: null,
    };
  }

  const [recovery, sleep] = await Promise.all([
    getOptionalObject(
      `/developer/v2/cycle/${cycleId}/recovery`,
      config,
      persistConfig,
      fetchImpl,
    ),
    getOptionalObject(
      `/developer/v2/cycle/${cycleId}/sleep`,
      config,
      persistConfig,
      fetchImpl,
    ),
  ]);

  return {
    profile,
    cycle,
    recovery,
    sleep,
  };
}

async function getLatestFromCollection(
  path: string,
  config: Config,
  persistConfig: (config: Config) => Promise<void>,
  fetchImpl: typeof fetch,
): Promise<JsonObject | null> {
  const payload = await apiGet(path, config, persistConfig, fetchImpl, {
    limit: "1",
  });

  const records = extractRecords(payload, path);
  if (records.length === 0) {
    return null;
  }

  return records[0];
}

async function getObject(
  path: string,
  config: Config,
  persistConfig: (config: Config) => Promise<void>,
  fetchImpl: typeof fetch,
): Promise<JsonObject> {
  const payload = await apiGet(path, config, persistConfig, fetchImpl);
  if (isObject(payload)) {
    return payload;
  }

  throw new Error(`Unexpected WHOOP response shape for ${path}.`);
}

async function getOptionalObject(
  path: string,
  config: Config,
  persistConfig: (config: Config) => Promise<void>,
  fetchImpl: typeof fetch,
): Promise<JsonObject | null> {
  try {
    return await getObject(path, config, persistConfig, fetchImpl);
  } catch (error) {
    if (error instanceof WhoopApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

function readCycleId(cycle: JsonObject | null): string | null {
  if (!cycle) {
    return null;
  }

  const id = cycle.id;
  if (typeof id === "string" || typeof id === "number") {
    return String(id);
  }

  return null;
}

async function apiGet(
  path: string,
  config: Config,
  persistConfig: (config: Config) => Promise<void>,
  fetchImpl: typeof fetch,
  query?: Record<string, string>,
): Promise<unknown> {
  const firstTryToken = await ensureAccessToken(
    config,
    persistConfig,
    fetchImpl,
  );
  const firstResponse = await requestWithToken(
    path,
    firstTryToken,
    fetchImpl,
    query,
  );

  if (firstResponse.status !== 401) {
    return await parseResponse(firstResponse, path);
  }

  await refreshOnce(config, persistConfig, fetchImpl);
  const retryToken = config.oauth?.accessToken;
  if (!retryToken) {
    throw new Error(
      "Authentication failed after refresh: missing access token.",
    );
  }

  const retryResponse = await requestWithToken(
    path,
    retryToken,
    fetchImpl,
    query,
  );
  return await parseResponse(retryResponse, path);
}

async function ensureAccessToken(
  config: Config,
  persistConfig: (config: Config) => Promise<void>,
  fetchImpl: typeof fetch,
): Promise<string> {
  if (
    !config.oauth?.refreshToken ||
    !config.oauth.clientId ||
    !config.oauth.clientSecret
  ) {
    throw new Error("Missing OAuth configuration. Run `whoop login` first.");
  }

  if (config.oauth.accessToken) {
    return config.oauth.accessToken;
  }

  await refreshOnce(config, persistConfig, fetchImpl);
  if (!config.oauth.accessToken) {
    throw new Error(
      "Token refresh succeeded but no access token was returned.",
    );
  }

  return config.oauth.accessToken;
}

async function forceRefresh(
  config: Config,
  persistConfig: (config: Config) => Promise<void>,
  fetchImpl: typeof fetch,
): Promise<void> {
  if (
    !config.oauth?.refreshToken ||
    !config.oauth.clientId ||
    !config.oauth.clientSecret
  ) {
    throw new Error(
      "Cannot refresh token: missing refresh token or client credentials.",
    );
  }

  const refreshed = await refreshAccessToken({
    refreshToken: config.oauth.refreshToken,
    clientId: config.oauth.clientId,
    clientSecret: config.oauth.clientSecret,
    fetchImpl,
  });

  const updated = tokenResponseToConfig(refreshed);
  config.oauth = {
    ...config.oauth,
    ...updated,
    refreshToken: updated.refreshToken ?? config.oauth.refreshToken,
  };
  await persistConfig(config);
}

async function refreshOnce(
  config: Config,
  persistConfig: (config: Config) => Promise<void>,
  fetchImpl: typeof fetch,
): Promise<void> {
  if (!refreshInFlight) {
    refreshInFlight = forceRefresh(config, persistConfig, fetchImpl).finally(
      () => {
        refreshInFlight = null;
      },
    );
  }

  await refreshInFlight;
}

async function requestWithToken(
  path: string,
  token: string,
  fetchImpl: typeof fetch,
  query?: Record<string, string>,
): Promise<Response> {
  const url = new URL(path, WHOOP_API_BASE_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }

  return await fetchImpl(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

async function parseResponse(
  response: Response,
  path: string,
): Promise<unknown> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new WhoopApiError(response.status, path, "Expected JSON response.");
  }

  if (response.ok) {
    return payload;
  }

  throw new WhoopApiError(
    response.status,
    path,
    typeof payload === "string" ? payload : JSON.stringify(payload),
  );
}

function extractRecords(payload: unknown, path: string): JsonObject[] {
  if (!isObject(payload) || !Array.isArray(payload.records)) {
    throw new Error(`Unexpected WHOOP collection response shape for ${path}.`);
  }

  const records = payload.records.filter(isObject);
  if (records.length !== payload.records.length) {
    throw new Error(`Unexpected WHOOP collection item shape for ${path}.`);
  }

  return records;
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
