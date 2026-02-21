export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue;
}

export interface OAuthConfig {
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface Config {
  oauth?: OAuthConfig;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
}

export interface OverviewPayload {
  profile: JsonObject | null;
  cycle: JsonObject | null;
  recovery: JsonObject | null;
  sleep: JsonObject | null;
}
