import { WHOOP_API_BASE_URL } from "./constants";
import { refreshAccessToken, tokenResponseToConfig } from "./oauth";
import type {
  Config,
  JsonObject,
  OverviewPayload,
  RecoveryPayload,
  SleepPayload,
  UserPayload,
} from "./types";

let refreshInFlight: Promise<void> | null = null;
const COLLECTION_PAGE_LIMIT = 25;
const DETAIL_CONCURRENCY = 5;

interface ListOptions {
  limit?: number;
}

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
  options: ListOptions = {},
  fetchImpl: typeof fetch = fetch,
): Promise<OverviewPayload> {
  const limit = options.limit ?? 1;

  const [profile, cycles] = await Promise.all([
    getOptionalObject(
      "/developer/v2/user/profile/basic",
      config,
      persistConfig,
      fetchImpl,
    ),
    getCollectionRecords("/developer/v2/cycle", limit, config, persistConfig, fetchImpl),
  ]);

  const cycleEntries = await mapWithConcurrency(
    cycles,
    DETAIL_CONCURRENCY,
    async (cycle) => {
      const cycleId = readCycleId(cycle);
      if (!cycleId) {
        return {
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
        cycle,
        recovery,
        sleep,
      };
    },
  );

  return {
    profile,
    cycles: cycleEntries,
  };
}

export async function fetchRecovery(
  config: Config,
  persistConfig: (config: Config) => Promise<void>,
  options: ListOptions = {},
  fetchImpl: typeof fetch = fetch,
): Promise<RecoveryPayload> {
  const limit = options.limit ?? 1;
  const recoveries = await getCollectionRecords(
    "/developer/v2/recovery",
    limit,
    config,
    persistConfig,
    fetchImpl,
  );

  return { recoveries };
}

export async function fetchSleep(
  config: Config,
  persistConfig: (config: Config) => Promise<void>,
  options: ListOptions = {},
  fetchImpl: typeof fetch = fetch,
): Promise<SleepPayload> {
  const limit = options.limit ?? 1;
  const sleeps = await getCollectionRecords(
    "/developer/v2/activity/sleep",
    limit,
    config,
    persistConfig,
    fetchImpl,
  );

  return { sleeps };
}

export async function fetchUser(
  config: Config,
  persistConfig: (config: Config) => Promise<void>,
  fetchImpl: typeof fetch = fetch,
): Promise<UserPayload> {
  const [profile, bodyMeasurement] = await Promise.all([
    getOptionalObject(
      "/developer/v2/user/profile/basic",
      config,
      persistConfig,
      fetchImpl,
    ),
    getOptionalRecord(
      "/developer/v2/user/measurement/body",
      config,
      persistConfig,
      fetchImpl,
    ),
  ]);

  return {
    profile,
    bodyMeasurement,
  };
}

async function getCollectionRecords(
  path: string,
  limit: number,
  config: Config,
  persistConfig: (config: Config) => Promise<void>,
  fetchImpl: typeof fetch,
): Promise<JsonObject[]> {
  const records: JsonObject[] = [];
  let nextToken: string | null = null;

  while (records.length < limit) {
    const remaining = limit - records.length;
    const query: Record<string, string> = {
      limit: String(Math.min(COLLECTION_PAGE_LIMIT, remaining)),
    };
    if (nextToken) {
      query.nextToken = nextToken;
    }

    const payload = await apiGet(path, config, persistConfig, fetchImpl, query);
    const page = extractCollectionPage(payload, path);
    records.push(...page.records);

    if (page.records.length === 0 || !page.nextToken || page.nextToken === nextToken) {
      break;
    }

    nextToken = page.nextToken;
  }

  return records.slice(0, limit);
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

async function getOptionalRecord(
  path: string,
  config: Config,
  persistConfig: (config: Config) => Promise<void>,
  fetchImpl: typeof fetch,
): Promise<JsonObject | null> {
  try {
    const payload = await apiGet(path, config, persistConfig, fetchImpl);
    return extractObjectOrLatestRecord(payload, path);
  } catch (error) {
    if (error instanceof WhoopApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
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

function extractCollectionPage(
  payload: unknown,
  path: string,
): { records: JsonObject[]; nextToken: string | null } {
  if (!isObject(payload) || !Array.isArray(payload.records)) {
    throw new Error(`Unexpected WHOOP collection response shape for ${path}.`);
  }

  const records = payload.records.filter(isObject);
  if (records.length !== payload.records.length) {
    throw new Error(`Unexpected WHOOP collection item shape for ${path}.`);
  }

  const nextTokenRaw = payload.nextToken ?? payload.next_token;
  if (nextTokenRaw === undefined || nextTokenRaw === null) {
    return { records, nextToken: null };
  }

  if (typeof nextTokenRaw !== "string") {
    throw new Error(`Unexpected WHOOP pagination token shape for ${path}.`);
  }

  return { records, nextToken: nextTokenRaw };
}

function extractObjectOrLatestRecord(
  payload: unknown,
  path: string,
): JsonObject | null {
  if (!isObject(payload)) {
    throw new Error(`Unexpected WHOOP response shape for ${path}.`);
  }

  if (!("records" in payload)) {
    return payload;
  }

  const page = extractCollectionPage(payload, path);
  return page.records.length > 0 ? page.records[0] : null;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
