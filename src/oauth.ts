import { randomBytes } from "node:crypto";
import { createServer } from "node:http";

import {
  DEFAULT_CALLBACK_TIMEOUT_MS,
  WHOOP_AUTH_URL,
  WHOOP_TOKEN_URL,
} from "./constants";
import type { OAuthConfig, TokenResponse } from "./types";

interface AuthUrlOptions {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string;
}

interface CallbackOptions {
  redirectUri: string;
  expectedState: string;
  timeoutMs?: number;
}

export function generateState(): string {
  return randomBytes(16).toString("hex");
}

export function buildAuthorizeUrl(options: AuthUrlOptions): string {
  const url = new URL(WHOOP_AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", options.clientId);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("state", options.state);

  if (options.scope) {
    url.searchParams.set("scope", options.scope);
  }

  return url.toString();
}

export async function waitForAuthCode(
  options: CallbackOptions,
): Promise<string> {
  const redirectUrl = new URL(options.redirectUri);
  const port = Number(redirectUrl.port || "80");
  const hostname = redirectUrl.hostname;
  const callbackPath = redirectUrl.pathname;
  const timeoutMs = options.timeoutMs ?? DEFAULT_CALLBACK_TIMEOUT_MS;

  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    throw new Error(
      "Redirect URI host must be localhost or 127.0.0.1 for local callback login.",
    );
  }

  return await new Promise<string>((resolve, reject) => {
    const server = createServer((request, response) => {
      try {
        if (!request.url) {
          cleanup(new Error("Callback request did not include a URL."));
          return;
        }

        const requestUrl = new URL(
          request.url,
          `${redirectUrl.protocol}//${request.headers.host}`,
        );

        if (requestUrl.pathname !== callbackPath) {
          response.statusCode = 404;
          response.end("Not found");
          return;
        }

        const error = requestUrl.searchParams.get("error");
        if (error) {
          response.statusCode = 400;
          response.end(`Authentication failed: ${error}`);
          cleanup(new Error(`Authentication failed: ${error}`));
          return;
        }

        const receivedState = requestUrl.searchParams.get("state");
        if (receivedState !== options.expectedState) {
          response.statusCode = 400;
          response.end("Invalid OAuth state. Please retry login.");
          cleanup(new Error("Invalid OAuth state in callback response."));
          return;
        }

        const code = requestUrl.searchParams.get("code");
        if (!code) {
          response.statusCode = 400;
          response.end("Missing authorization code.");
          cleanup(
            new Error("Missing authorization code in callback response."),
          );
          return;
        }

        response.statusCode = 200;
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(
          "<html><body><h1>WHOOP login complete.</h1><p>You can close this tab.</p></body></html>",
        );
        cleanup(null, code);
      } catch (error) {
        cleanup(
          error instanceof Error
            ? error
            : new Error("Unexpected callback parsing error."),
        );
      }
    });

    const timeout = setTimeout(() => {
      cleanup(
        new Error(`Timed out waiting for OAuth callback after ${timeoutMs}ms.`),
      );
    }, timeoutMs);

    server.on("error", (error) => cleanup(error));
    server.listen(port, hostname);

    function cleanup(error: Error | null, code: string | null = null): void {
      clearTimeout(timeout);
      server.close();

      if (error) {
        reject(error);
        return;
      }

      if (!code) {
        reject(new Error("Callback response is missing authorization code."));
        return;
      }

      resolve(code);
    }
  });
}

export async function exchangeAuthorizationCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<TokenResponse> {
  return await fetchToken(
    {
      grant_type: "authorization_code",
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
    },
    params.fetchImpl,
  );
}

export async function refreshAccessToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
}): Promise<TokenResponse> {
  return await fetchToken(
    {
      grant_type: "refresh_token",
      refresh_token: params.refreshToken,
      client_id: params.clientId,
      client_secret: params.clientSecret,
    },
    params.fetchImpl,
  );
}

export function tokenResponseToConfig(token: TokenResponse): OAuthConfig {
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
  };
}

async function fetchToken(
  formValues: Record<string, string>,
  fetchImpl = fetch,
): Promise<TokenResponse> {
  const body = new URLSearchParams(formValues);
  const response = await fetchImpl(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(
      `Token request failed (${response.status}): expected JSON response.`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `Token request failed (${response.status}): ${JSON.stringify(payload)}`,
    );
  }

  if (!isTokenResponse(payload)) {
    throw new Error("Token response is missing required access_token.");
  }

  return payload;
}

function isTokenResponse(payload: unknown): payload is TokenResponse {
  return (
    typeof payload === "object" &&
    payload !== null &&
    typeof (payload as TokenResponse).access_token === "string"
  );
}
