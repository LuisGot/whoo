import { describe, expect, test } from "bun:test";

import { buildAuthorizeUrl, tokenResponseToConfig } from "../src/oauth";

describe("oauth", () => {
  test("builds authorize URL", () => {
    const url = new URL(
      buildAuthorizeUrl({
        clientId: "client-123",
        redirectUri: "http://127.0.0.1:8123/callback",
        state: "state-abc",
        scope: "offline",
      }),
    );

    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://127.0.0.1:8123/callback",
    );
    expect(url.searchParams.get("state")).toBe("state-abc");
    expect(url.searchParams.get("scope")).toBe("offline");
  });

  test("maps token payload into config fields", () => {
    const converted = tokenResponseToConfig({
      access_token: "access",
      refresh_token: "refresh",
    });

    expect(converted.accessToken).toBe("access");
    expect(converted.refreshToken).toBe("refresh");
  });
});
