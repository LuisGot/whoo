import { describe, expect, test } from "bun:test";

import type { Config } from "../src/types";
import {
  fetchOverview,
  fetchRecovery,
  fetchSleep,
  fetchUser,
} from "../src/whoop";

const baseConfig: Config = {
  oauth: {
    clientId: "client-id",
    clientSecret: "client-secret",
    accessToken: "access-token",
    refreshToken: "refresh-token",
  },
};

describe("fetchOverview", () => {
  test("fetches profile plus latest cycle with cycle recovery and sleep", async () => {
    const fetchImpl = asFetch(async (input, init) => {
      const url = new URL(String(input));

      expect(init?.headers).toMatchObject({
        Authorization: "Bearer access-token",
      });

      if (url.pathname === "/developer/v2/user/profile/basic") {
        return jsonResponse({
          first_name: "Test",
          last_name: "User",
          email: "test@example.com",
        });
      }

      if (url.pathname === "/developer/v2/cycle") {
        expect(url.searchParams.get("limit")).toBe("1");
        return jsonResponse({
          records: [
            {
              id: 101,
              start: "2026-02-20T10:00:00.000Z",
            },
          ],
        });
      }

      if (url.pathname === "/developer/v2/cycle/101/recovery") {
        return jsonResponse({
          cycle_id: 101,
          score: {
            recovery_score: 83,
          },
        });
      }

      if (url.pathname === "/developer/v2/cycle/101/sleep") {
        return jsonResponse({
          cycle_id: 101,
          nap: false,
          score: {
            sleep_performance_percentage: 94,
          },
        });
      }

      throw new Error(`Unexpected WHOOP path: ${url.pathname}`);
    });

    const payload = await fetchOverview(
      baseConfig,
      async () => {},
      { limit: 1 },
      fetchImpl,
    );

    expect(payload.profile?.first_name).toBe("Test");
    expect(payload.cycles.length).toBe(1);
    expect(payload.cycles[0]?.cycle.id).toBe(101);
    expect(payload.cycles[0]?.recovery?.cycle_id).toBe(101);
    expect(payload.cycles[0]?.sleep?.cycle_id).toBe(101);
  });

  test("paginates cycles with nextToken and preserves newest-first order", async () => {
    const fetchImpl = asFetch(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/developer/v2/user/profile/basic") {
        return jsonResponse({ first_name: "Test" });
      }

      if (url.pathname === "/developer/v2/cycle") {
        const nextToken = url.searchParams.get("nextToken");

        if (!nextToken) {
          expect(url.searchParams.get("limit")).toBe("25");
          return jsonResponse({
            records: Array.from({ length: 25 }, (_, index) => ({
              id: 30 - index,
            })),
            nextToken: "page-2",
          });
        }

        expect(nextToken).toBe("page-2");
        expect(url.searchParams.get("limit")).toBe("5");
        return jsonResponse({
          records: Array.from({ length: 5 }, (_, index) => ({ id: 5 - index })),
        });
      }

      const recoveryMatch = url.pathname.match(
        /^\/developer\/v2\/cycle\/(\d+)\/recovery$/,
      );
      if (recoveryMatch) {
        return jsonResponse({ cycle_id: Number(recoveryMatch[1]) });
      }

      const sleepMatch = url.pathname.match(
        /^\/developer\/v2\/cycle\/(\d+)\/sleep$/,
      );
      if (sleepMatch) {
        return jsonResponse({ cycle_id: Number(sleepMatch[1]), nap: false });
      }

      throw new Error(`Unexpected WHOOP path: ${url.pathname}`);
    });

    const payload = await fetchOverview(
      baseConfig,
      async () => {},
      { limit: 30 },
      fetchImpl,
    );

    expect(payload.cycles.length).toBe(30);
    expect(payload.cycles.map((entry) => entry.cycle.id)).toEqual(
      Array.from({ length: 30 }, (_, index) => 30 - index),
    );
    expect(payload.cycles[0]?.recovery?.cycle_id).toBe(30);
    expect(payload.cycles[29]?.sleep?.cycle_id).toBe(1);
  });

  test("returns cycle with null recovery/sleep when cycle id is missing", async () => {
    let calledCycleDetails = false;

    const fetchImpl = asFetch(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/developer/v2/user/profile/basic") {
        return jsonResponse({ first_name: "Test" });
      }

      if (url.pathname === "/developer/v2/cycle") {
        expect(url.searchParams.get("limit")).toBe("1");
        return jsonResponse({
          records: [{ start: "2026-02-20T10:00:00.000Z" }],
        });
      }

      if (url.pathname.startsWith("/developer/v2/cycle/")) {
        calledCycleDetails = true;
      }

      throw new Error(`Unexpected WHOOP path: ${url.pathname}`);
    });

    const payload = await fetchOverview(
      baseConfig,
      async () => {},
      { limit: 1 },
      fetchImpl,
    );

    expect(payload.cycles.length).toBe(1);
    expect(payload.cycles[0]?.recovery).toBeNull();
    expect(payload.cycles[0]?.sleep).toBeNull();
    expect(calledCycleDetails).toBe(false);
  });
});

describe("fetchRecovery", () => {
  test("fetches latest records from recovery collection", async () => {
    const fetchImpl = asFetch(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/developer/v2/recovery") {
        expect(url.searchParams.get("limit")).toBe("1");
        return jsonResponse({
          records: [{ cycle_id: 99, score_state: "SCORED" }],
        });
      }

      throw new Error(`Unexpected WHOOP path: ${url.pathname}`);
    });

    const payload = await fetchRecovery(
      baseConfig,
      async () => {},
      { limit: 1 },
      fetchImpl,
    );

    expect(payload.recoveries.length).toBe(1);
    expect(payload.recoveries[0]?.cycle_id).toBe(99);
  });

  test("refreshes token and retries request when access token is expired", async () => {
    const config: Config = {
      oauth: {
        clientId: "client-id",
        clientSecret: "client-secret",
        accessToken: "expired-access",
        refreshToken: "refresh-token",
      },
    };

    const fetchImpl = asFetch(async (input, init) => {
      const url = new URL(String(input));
      const authorization = (
        init?.headers as Record<string, string> | undefined
      )?.Authorization;

      if (url.pathname === "/oauth/oauth2/token") {
        return jsonResponse(
          {
            access_token: "fresh-access",
            refresh_token: "fresh-refresh",
            token_type: "bearer",
          },
          200,
        );
      }

      if (
        url.pathname === "/developer/v2/recovery" &&
        authorization === "Bearer expired-access"
      ) {
        return jsonResponse({ error: "unauthorized" }, 401);
      }

      if (
        url.pathname === "/developer/v2/recovery" &&
        authorization === "Bearer fresh-access"
      ) {
        return jsonResponse({ records: [{ cycle_id: "cycle-1" }] });
      }

      throw new Error(`Unexpected WHOOP path: ${url.pathname}`);
    });

    const payload = await fetchRecovery(
      config,
      async () => {},
      { limit: 1 },
      fetchImpl,
    );

    expect(payload.recoveries[0]?.cycle_id).toBe("cycle-1");
    expect(config.oauth?.accessToken).toBe("fresh-access");
    expect(config.oauth?.refreshToken).toBe("fresh-refresh");
  });

  test("paginates records using nextToken", async () => {
    const fetchImpl = asFetch(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/developer/v2/recovery") {
        const nextToken = url.searchParams.get("nextToken");

        if (!nextToken) {
          expect(url.searchParams.get("limit")).toBe("25");
          return jsonResponse({
            records: Array.from({ length: 25 }, (_, index) => ({
              cycle_id: 27 - index,
            })),
            nextToken: "page-2",
          });
        }

        expect(nextToken).toBe("page-2");
        expect(url.searchParams.get("limit")).toBe("2");
        return jsonResponse({ records: [{ cycle_id: 2 }, { cycle_id: 1 }] });
      }

      throw new Error(`Unexpected WHOOP path: ${url.pathname}`);
    });

    const payload = await fetchRecovery(
      baseConfig,
      async () => {},
      { limit: 27 },
      fetchImpl,
    );

    expect(payload.recoveries.length).toBe(27);
    expect(payload.recoveries[0]?.cycle_id).toBe(27);
    expect(payload.recoveries[26]?.cycle_id).toBe(1);
  });
});

describe("fetchSleep", () => {
  test("fetches from sleep collection endpoint", async () => {
    const fetchImpl = asFetch(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/developer/v2/activity/sleep") {
        expect(url.searchParams.get("limit")).toBe("1");
        return jsonResponse({ records: [{ id: 11, nap: false }] });
      }

      throw new Error(`Unexpected WHOOP path: ${url.pathname}`);
    });

    const payload = await fetchSleep(
      baseConfig,
      async () => {},
      { limit: 1 },
      fetchImpl,
    );

    expect(payload.sleeps.length).toBe(1);
    expect(payload.sleeps[0]?.id).toBe(11);
  });
});

describe("fetchUser", () => {
  test("fetches profile and body measurement", async () => {
    const fetchImpl = asFetch(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/developer/v2/user/profile/basic") {
        return jsonResponse({ first_name: "Test", last_name: "User" });
      }

      if (url.pathname === "/developer/v2/user/measurement/body") {
        return jsonResponse({ height_meter: 1.8, weight_kilogram: 70 });
      }

      throw new Error(`Unexpected WHOOP path: ${url.pathname}`);
    });

    const payload = await fetchUser(baseConfig, async () => {}, fetchImpl);

    expect(payload.profile?.first_name).toBe("Test");
    expect(payload.bodyMeasurement?.height_meter).toBe(1.8);
    expect(payload.bodyMeasurement?.weight_kilogram).toBe(70);
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function asFetch(
  fn: (input: URL | RequestInfo, init?: RequestInit) => Promise<Response>,
): typeof fetch {
  return Object.assign(fn, {
    preconnect: fetch.preconnect,
  }) as typeof fetch;
}
