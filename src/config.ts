import Conf from "conf";
import { rm } from "node:fs/promises";

import { APP_NAME } from "./constants";
import type { Config } from "./types";

function createConfigStore(): Conf<Config> {
  return new Conf<Config>({
    projectName: APP_NAME,
    projectSuffix: "",
    configName: "config",
  });
}

export function getConfigPath(): string {
  return createConfigStore().path;
}

export async function loadConfig(): Promise<Config> {
  return createConfigStore().store;
}

export async function saveConfig(config: Config): Promise<void> {
  createConfigStore().store = config;
}

export async function clearAllConfig(): Promise<void> {
  const store = createConfigStore();
  store.clear();
  await rm(store.path, { force: true });
}

export function maskValue(
  value: string | undefined,
  keepStart = 4,
  keepEnd = 2,
): string {
  if (!value) {
    return "(not set)";
  }

  if (value.length <= keepStart + keepEnd) {
    return "*".repeat(value.length);
  }

  const start = value.slice(0, keepStart);
  const end = value.slice(-keepEnd);
  const middle = "*".repeat(value.length - keepStart - keepEnd);
  return `${start}${middle}${end}`;
}
