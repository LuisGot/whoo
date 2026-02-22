export interface ParsedArgs {
  command: string | null;
  flags: Record<string, string | boolean>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const flags: Record<string, string | boolean> = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];

    if (!token.startsWith("--")) {
      continue;
    }

    const trimmed = token.slice(2);
    const equalsIndex = trimmed.indexOf("=");

    if (equalsIndex >= 0) {
      const key = trimmed.slice(0, equalsIndex);
      const value = trimmed.slice(equalsIndex + 1);
      flags[key] = value;
      continue;
    }

    const next = rest[index + 1];
    if (next && !next.startsWith("--")) {
      flags[trimmed] = next;
      index += 1;
      continue;
    }

    flags[trimmed] = true;
  }

  return { command: command ?? null, flags };
}
