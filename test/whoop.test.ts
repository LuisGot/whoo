import { describe, expect, test } from "bun:test";

import type { Config } from "../src/types";
import { fetchOverview } from "../src/whoop";

const baseConfig: Config = {
  oauth: {
    clientId: "client-id",
    clientSecret: "client-secret",
    accessToken: "access-token",
    refreshToken: "refresh-token",
  },
};

describe("fetchOverview", () => {
  test("fetches profile, latest cycle, and cycle health sections", async () => {
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

    const payload = await fetchOverview(baseConfig, async () => {}, fetchImpl);

    expect(payload.profile?.first_name).toBe("Test");
    expect(payload.cycle?.id).toBe(101);
    expect(payload.recovery?.cycle_id).toBe(101);
    expect(payload.sleep?.cycle_id).toBe(101);
  });

  test("refreshes token and retries requests when access token expired", async () => {
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
      const authorization = (init?.headers as Record<string, string> | undefined)
        ?.Authorization;

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

      if (authorization === "Bearer expired-access") {
        return jsonResponse({ error: "unauthorized" }, 401);
      }

      if (url.pathname === "/developer/v2/user/profile/basic") {
        return jsonResponse({ first_name: "Test" });
      }

      if (url.pathname === "/developer/v2/cycle") {
        expect(url.searchParams.get("limit")).toBe("1");
        return jsonResponse({
          records: [{ id: "cycle-1" }],
        });
      }

      if (url.pathname === "/developer/v2/cycle/cycle-1/recovery") {
        return jsonResponse({ cycle_id: "cycle-1" });
      }

      if (url.pathname === "/developer/v2/cycle/cycle-1/sleep") {
        return jsonResponse({ cycle_id: "cycle-1", nap: false });
      }

      throw new Error(`Unexpected WHOOP path: ${url.pathname}`);
    });

    const payload = await fetchOverview(config, async () => {}, fetchImpl);

    expect(payload.profile?.first_name).toBe("Test");
    expect(payload.cycle?.id).toBe("cycle-1");
    expect(payload.recovery?.cycle_id).toBe("cycle-1");
    expect(payload.sleep?.cycle_id).toBe("cycle-1");
    expect(config.oauth?.accessToken).toBe("fresh-access");
    expect(config.oauth?.refreshToken).toBe("fresh-refresh");
  });

  test("returns null recovery and sleep when no cycle exists", async () => {
    let calledCycleDetails = false;

    const fetchImpl = asFetch(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/developer/v2/user/profile/basic") {
        return jsonResponse({ first_name: "Test" });
      }

      if (url.pathname === "/developer/v2/cycle") {
        expect(url.searchParams.get("limit")).toBe("1");
        return jsonResponse({ records: [] });
      }

      if (url.pathname.startsWith("/developer/v2/cycle/")) {
        calledCycleDetails = true;
      }

      throw new Error(`Unexpected WHOOP path: ${url.pathname}`);
    });

    const payload = await fetchOverview(baseConfig, async () => {}, fetchImpl);

    expect(payload.profile?.first_name).toBe("Test");
    expect(payload.cycle).toBeNull();
    expect(payload.recovery).toBeNull();
    expect(payload.sleep).toBeNull();
    expect(calledCycleDetails).toBe(false);
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
