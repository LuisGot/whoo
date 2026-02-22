import { describe, expect, test } from "bun:test";

import {
  buildAuthorizeUrl,
  parseAuthCodeFromCallbackUrl,
  tokenResponseToConfig,
} from "../src/oauth";

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

  test("extracts auth code from manual callback URL", () => {
    const code = parseAuthCodeFromCallbackUrl({
      callbackUrl:
        "http://127.0.0.1:8123/callback?code=auth-code-1&state=state-abc",
      redirectUri: "http://127.0.0.1:8123/callback",
      expectedState: "state-abc",
    });

    expect(code).toBe("auth-code-1");
  });

  test("rejects manual callback URL with invalid state", () => {
    expect(() =>
      parseAuthCodeFromCallbackUrl({
        callbackUrl:
          "http://127.0.0.1:8123/callback?code=auth-code-1&state=wrong",
        redirectUri: "http://127.0.0.1:8123/callback",
        expectedState: "state-abc",
      }),
    ).toThrow("Invalid OAuth state in callback URL.");
  });

  test("rejects manual callback URL missing code", () => {
    expect(() =>
      parseAuthCodeFromCallbackUrl({
        callbackUrl: "http://127.0.0.1:8123/callback?state=state-abc",
        redirectUri: "http://127.0.0.1:8123/callback",
        expectedState: "state-abc",
      }),
    ).toThrow("Missing authorization code in callback URL.");
  });

  test("rejects manual callback URL for a different redirect target", () => {
    expect(() =>
      parseAuthCodeFromCallbackUrl({
        callbackUrl:
          "http://localhost:8123/callback?code=auth-code-1&state=state-abc",
        redirectUri: "http://127.0.0.1:8123/callback",
        expectedState: "state-abc",
      }),
    ).toThrow(
      "Callback URL does not match the configured redirect URI. Please copy the full redirected URL.",
    );
  });
});
