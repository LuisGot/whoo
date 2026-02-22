import type {
  JsonObject,
  JsonValue,
  OverviewPayload,
  RecoveryPayload,
  SleepPayload,
  UserPayload,
} from "./types";

const METADATA_KEYS = new Set(["id", "created_at", "updated_at", "version"]);
const DURATION_MS_KEYS = new Set([
  "total_in_bed_time_milli",
  "total_awake_time_milli",
  "total_no_data_time_milli",
  "total_light_sleep_time_milli",
  "total_slow_wave_sleep_time_milli",
  "total_rem_sleep_time_milli",
  "baseline_milli",
  "need_from_sleep_debt_milli",
  "need_from_recent_strain_milli",
  "need_from_recent_nap_milli",
]);
const PERCENTAGE_KEYS = new Set([
  "recovery_score",
  "spo2_percentage",
  "sleep_performance_percentage",
  "sleep_consistency_percentage",
  "sleep_efficiency_percentage",
]);
const HEART_RATE_KEYS = new Set([
  "resting_heart_rate",
  "average_heart_rate",
  "max_heart_rate",
]);
const DIVIDER = "----------------------------------------";

const PATH_LABELS: Record<string, string> = {
  profile: "Profile",
  "profile.first_name": "First Name",
  "profile.last_name": "Last Name",
  "profile.email": "Email",

  cycle: "Cycle",
  "cycle.start": "Cycle Start",
  "cycle.end": "Cycle End",
  "cycle.timezone_offset": "Time Zone",
  "cycle.score_state": "Score Status",
  "cycle.score": "Cycle Score",
  "cycle.score.strain": "Day Strain",
  "cycle.score.kilojoule": "Energy Expenditure",
  "cycle.score.average_heart_rate": "Average Heart Rate",
  "cycle.score.max_heart_rate": "Maximum Heart Rate",

  recovery: "Recovery",
  "recovery.score_state": "Score Status",
  "recovery.score": "Recovery Metrics",
  "recovery.score.user_calibrating": "User Calibrating",
  "recovery.score.recovery_score": "Recovery Score",
  "recovery.score.resting_heart_rate": "Resting Heart Rate",
  "recovery.score.hrv_rmssd_milli": "HRV (RMSSD)",
  "recovery.score.spo2_percentage": "Blood Oxygen (SpO2)",
  "recovery.score.skin_temp_celsius": "Skin Temperature",

  sleep: "Sleep",
  "sleep.start": "Sleep Start",
  "sleep.end": "Sleep End",
  "sleep.timezone_offset": "Time Zone",
  "sleep.nap": "Nap",
  "sleep.score_state": "Score Status",
  "sleep.score": "Sleep Metrics",
  "sleep.score.stage_summary": "Sleep Stages",
  "sleep.score.stage_summary.total_in_bed_time_milli": "Time In Bed",
  "sleep.score.stage_summary.total_awake_time_milli": "Awake Time",
  "sleep.score.stage_summary.total_no_data_time_milli": "No Data Time",
  "sleep.score.stage_summary.total_light_sleep_time_milli": "Light Sleep",
  "sleep.score.stage_summary.total_slow_wave_sleep_time_milli": "Slow Wave Sleep",
  "sleep.score.stage_summary.total_rem_sleep_time_milli": "REM Sleep",
  "sleep.score.stage_summary.sleep_cycle_count": "Sleep Cycles",
  "sleep.score.stage_summary.disturbance_count": "Disturbances",
  "sleep.score.sleep_needed": "Sleep Need",
  "sleep.score.sleep_needed.baseline_milli": "Baseline Sleep Need",
  "sleep.score.sleep_needed.need_from_sleep_debt_milli": "Added Need From Sleep Debt",
  "sleep.score.sleep_needed.need_from_recent_strain_milli": "Added Need From Recent Strain",
  "sleep.score.sleep_needed.need_from_recent_nap_milli": "Need Reduction From Recent Nap",
  "sleep.score.respiratory_rate": "Respiratory Rate",
  "sleep.score.sleep_performance_percentage": "Sleep Performance",
  "sleep.score.sleep_consistency_percentage": "Sleep Consistency",
  "sleep.score.sleep_efficiency_percentage": "Sleep Efficiency",

  bodyMeasurement: "Body Measurement",
  "bodyMeasurement.max_heart_rate": "Maximum Heart Rate",
};

export function formatOverview(payload: OverviewPayload): string {
  const lines: string[] = [
    "WHOOP Overview",
    "",
    ...formatSection("Profile", "profile", payload.profile),
  ];

  if (payload.cycles.length === 0) {
    lines.push("", "Cycles:", "  No data available.");
    return lines.join("\n");
  }

  payload.cycles.forEach((entry, index) => {
    lines.push("");

    if (index > 0) {
      lines.push(DIVIDER, "");
    }

    lines.push(`Cycle ${index + 1}:`);

    const cycleGroup = [
      ...formatSection("Cycle", "cycle", entry.cycle),
      "",
      ...formatSection("Recovery", "recovery", entry.recovery),
      "",
      ...formatSection("Sleep", "sleep", entry.sleep),
    ];

    lines.push(...indentLines(trimTrailingBlanks(cycleGroup), 2));
  });

  return lines.join("\n");
}

export function formatRecovery(payload: RecoveryPayload): string {
  return formatCollection("WHOOP Recovery", "Recovery", "recovery", payload.recoveries);
}

export function formatSleep(payload: SleepPayload): string {
  return formatCollection("WHOOP Sleep", "Sleep", "sleep", payload.sleeps);
}

export function formatUser(payload: UserPayload): string {
  return [
    "WHOOP User",
    "",
    ...formatSection("Profile", "profile", payload.profile),
    "",
    ...formatSection("Body Measurement", "bodyMeasurement", payload.bodyMeasurement),
  ].join("\n");
}

function formatCollection(
  title: string,
  itemLabel: string,
  basePath: string,
  records: JsonObject[],
): string {
  const lines: string[] = [title, ""];

  if (records.length === 0) {
    lines.push(`${itemLabel}:`, "  No data available.");
    return lines.join("\n");
  }

  records.forEach((record, index) => {
    if (index > 0) {
      lines.push("", DIVIDER, "");
    }

    lines.push(...formatSection(`${itemLabel} ${index + 1}`, basePath, record));
  });

  return lines.join("\n");
}

function formatSection(
  title: string,
  basePath: string,
  record: JsonObject | null,
  indent = 0,
): string[] {
  const prefix = " ".repeat(indent);

  if (!record) {
    return [`${prefix}${title}:`, `${prefix}  No data available.`];
  }

  const filtered = filterMetadataValue(record);
  if (!isObject(filtered)) {
    return [`${prefix}${title}:`, `${prefix}  No data available.`];
  }

  const lines = Object.entries(filtered).flatMap(([key, value]) => {
    return formatField([basePath, key], value, indent + 2);
  });

  if (lines.length === 0) {
    return [`${prefix}${title}:`, `${prefix}  No data available.`];
  }

  return [`${prefix}${title}:`, ...lines];
}

function filterMetadataValue(value: JsonValue): JsonValue | undefined {
  if (Array.isArray(value)) {
    return value
      .map((item) => filterMetadataValue(item))
      .filter((item): item is JsonValue => item !== undefined);
  }

  if (isObject(value)) {
    const filtered: JsonObject = {};

    for (const [key, nested] of Object.entries(value)) {
      if (METADATA_KEYS.has(key) || key.endsWith("_id")) {
        continue;
      }

      const nestedValue = filterMetadataValue(nested);
      if (nestedValue !== undefined) {
        filtered[key] = nestedValue;
      }
    }

    return Object.keys(filtered).length > 0 ? filtered : undefined;
  }

  return value;
}

function formatField(path: string[], value: JsonValue, indent: number): string[] {
  const label = toLabel(path);
  const prefix = `${" ".repeat(indent)}${label}:`;

  if (isScalar(value)) {
    return [`${prefix} ${formatScalar(path, value)}`];
  }

  return [prefix, ...formatChildren(path, value, indent + 2)];
}

function formatChildren(
  parentPath: string[],
  value: JsonObject | JsonValue[],
  indent: number,
): string[] {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [`${" ".repeat(indent)}[]`];
    }

    return value.flatMap((item, index) => {
      return formatField([...parentPath, String(index)], item, indent);
    });
  }

  const entries = Object.entries(value);
  if (entries.length === 0) {
    return [`${" ".repeat(indent)}{}`];
  }

  return entries.flatMap(([key, nested]) => {
    return formatField([...parentPath, key], nested, indent);
  });
}

function toLabel(path: string[]): string {
  const fullPath = path.join(".");
  const mapped = PATH_LABELS[fullPath];
  if (mapped) {
    return mapped;
  }

  const key = path[path.length - 1];
  if (/^\d+$/.test(key)) {
    return `Item ${Number(key) + 1}`;
  }

  return titleCaseFromSnakeCase(key);
}

function titleCaseFromSnakeCase(value: string): string {
  const normalized = value
    .replace(/_/g, " ")
    .replace(/\bspo2\b/gi, "SpO2")
    .replace(/\bhrv\b/gi, "HRV")
    .replace(/\brmssd\b/gi, "RMSSD")
    .replace(/\brem\b/gi, "REM")
    .replace(/\bmilli\b/gi, "ms")
    .replace(/\btimezone\b/gi, "Time Zone");

  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function isScalar(value: JsonValue): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function formatScalar(path: string[], value: string | number | boolean | null): string {
  if (value === null) {
    return path.join(".") === "cycle.end" ? "In progress" : "Not available";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "string") {
    const key = path[path.length - 1];

    if (!Number.isNaN(Date.parse(value))) {
      return formatTimestamp(value);
    }

    if (key === "score_state") {
      return value
        .toLowerCase()
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    }

    if (key === "timezone_offset") {
      return value === "Z" ? "UTC+00:00" : `UTC${value}`;
    }

    return value;
  }

  return formatNumber(path[path.length - 1], value);
}

function formatNumber(key: string, value: number): string {
  if (DURATION_MS_KEYS.has(key)) {
    return formatDurationMs(value);
  }

  if (PERCENTAGE_KEYS.has(key)) {
    return `${formatDecimal(value, 2)}%`;
  }

  if (HEART_RATE_KEYS.has(key)) {
    return `${formatDecimal(value, 0)} bpm`;
  }

  if (key === "hrv_rmssd_milli") {
    return `${formatDecimal(value, 2)} ms`;
  }

  if (key === "respiratory_rate") {
    return `${formatDecimal(value, 2)} breaths/min`;
  }

  if (key === "skin_temp_celsius") {
    return `${formatDecimal(value, 2)} °C`;
  }

  if (key === "kilojoule") {
    return `${formatDecimal(value, 2)} kJ`;
  }

  if (key === "strain") {
    return `${formatDecimal(value, 2)} / 21`;
  }

  return formatDecimal(value, 2);
}

function formatDurationMs(milliseconds: number): string {
  const sign = milliseconds < 0 ? "-" : "";
  const totalSeconds = Math.round(Math.abs(milliseconds) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0 || hours > 0) {
    parts.push(`${minutes}m`);
  }

  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}s`);
  }

  return `${sign}${parts.join(" ")}`;
}

function formatDecimal(value: number, maxFractionDigits: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: maxFractionDigits,
  }).format(value);
}

function formatTimestamp(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return timestamp;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(parsed);
}

function indentLines(lines: string[], spaces: number): string[] {
  const prefix = " ".repeat(spaces);
  return lines.map((line) => `${prefix}${line}`);
}

function trimTrailingBlanks(lines: string[]): string[] {
  const result = [...lines];

  while (result.length > 0 && result[result.length - 1] === "") {
    result.pop();
  }

  return result;
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
