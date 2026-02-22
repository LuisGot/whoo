export const APP_NAME = "whoop-cli";
export const DEFAULT_REDIRECT_URI = "http://127.0.0.1:8123/callback";
export const DEFAULT_CALLBACK_TIMEOUT_MS = 120_000;
export const DEFAULT_OAUTH_SCOPE = [
  "offline",
  "read:profile",
  "read:body_measurement",
  "read:cycles",
  "read:recovery",
  "read:sleep",
].join(" ");
export const WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
export const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
export const WHOOP_API_BASE_URL = "https://api.prod.whoop.com";
