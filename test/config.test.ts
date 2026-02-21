import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadConfig, saveConfig } from "../src/config";
import type { Config } from "../src/types";

const tempRoots: string[] = [];

describe("config", () => {
  afterEach(async () => {
    while (tempRoots.length > 0) {
      const path = tempRoots.pop();
      if (path) {
        await rm(path, { recursive: true, force: true });
      }
    }
    delete process.env.XDG_CONFIG_HOME;
  });

  test("persists and loads oauth config", async () => {
    process.env.XDG_CONFIG_HOME = await createTempConfigRoot();
    const config: Config = {
      oauth: {
        clientId: "id-1",
        clientSecret: "secret-1",
        accessToken: "token-1",
        refreshToken: "refresh-1",
      },
    };

    await saveConfig(config);
    expect(await loadConfig()).toEqual(config);
  });
});

async function createTempConfigRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "whoop-cli-test-"));
  tempRoots.push(root);
  return root;
}
