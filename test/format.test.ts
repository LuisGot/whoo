import { describe, expect, test } from "bun:test";

import { formatOverview, formatRecovery, formatSleep, formatUser } from "../src/format";
import type { OverviewPayload, RecoveryPayload, SleepPayload, UserPayload } from "../src/types";

describe("formatOverview", () => {
  test("renders profile once with detailed cycle, recovery, and sleep blocks", () => {
    const payload: OverviewPayload = {
      profile: {
        id: 42,
        user_id: 42,
        email: "test@example.com",
        first_name: "Test",
        last_name: "User",
        created_at: "2026-02-20T00:00:00.000Z",
      },
      cycles: [
        {
          cycle: {
            id: 10,
            user_id: 42,
            start: "2026-02-20T01:00:00.000Z",
            end: null,
            timezone_offset: "+01:00",
            score_state: "SCORED",
            score: {
              strain: 12.1,
              kilojoule: 3207.9207,
              average_heart_rate: 72,
              max_heart_rate: 139,
              version: 2,
            },
          },
          recovery: {
            id: 33,
            score_state: "SCORED",
            score: {
              user_calibrating: false,
              recovery_score: 78,
              resting_heart_rate: 56,
              hrv_rmssd_milli: 28.944891,
              spo2_percentage: 98.05,
              skin_temp_celsius: 33.8655,
            },
          },
          sleep: {
            id: 44,
            nap: false,
            score_state: "SCORED",
            score: {
              stage_summary: {
                total_in_bed_time_milli: 27000000,
                total_awake_time_milli: 390000,
                total_no_data_time_milli: 0,
                total_light_sleep_time_milli: 10126190,
                total_slow_wave_sleep_time_milli: 9638270,
                total_rem_sleep_time_milli: 6878220,
                sleep_cycle_count: 5,
                disturbance_count: 8,
              },
              sleep_needed: {
                baseline_milli: 29047724,
                need_from_sleep_debt_milli: 507197,
                need_from_recent_strain_milli: 390940,
                need_from_recent_nap_milli: -120000,
              },
              respiratory_rate: 17.714844,
              sleep_performance_percentage: 92,
              sleep_consistency_percentage: 60,
              sleep_efficiency_percentage: 98.5573,
            },
          },
        },
        {
          cycle: {
            id: 9,
            start: "2026-02-19T01:00:00.000Z",
            end: "2026-02-20T01:00:00.000Z",
            timezone_offset: "Z",
            score_state: "PENDING_SCORE",
          },
          recovery: null,
          sleep: null,
        },
      ],
    };

    const output = formatOverview(payload);

    expect(output).toContain("WHOOP Overview");
    expect(output).toContain("Profile:");
    expect(output).toContain("Cycle 1:");
    expect(output).toContain("Cycle 2:");
    expect(output).toContain("Email: test@example.com");
    expect(output).toContain("Cycle End: In progress");
    expect(output).toContain("Time Zone: UTC+01:00");
    expect(output).toContain("Score Status: Scored");
    expect(output).toContain("Day Strain: 12.1 / 21");
    expect(output).toContain("Recovery Score: 78%");
    expect(output).toContain("Resting Heart Rate: 56 bpm");
    expect(output).toContain("Time In Bed: 7h 30m");
    expect(output).toContain("Need Reduction From Recent Nap: -2m");
    expect(output).toContain("Respiratory Rate: 17.71 breaths/min");
    expect(output).toContain("Sleep Efficiency: 98.56%");
    expect(output).toContain("No data available.");
    expect((output.match(/\nProfile:/g) ?? []).length).toBe(1);
    expect(output).not.toContain("user_id");
    expect(output).not.toContain("created_at");
    expect(output).not.toContain("version");
  });

  test("shows empty cycle list clearly", () => {
    const payload: OverviewPayload = {
      profile: null,
      cycles: [],
    };

    const output = formatOverview(payload);
    expect(output).toContain("Profile:");
    expect(output).toContain("Cycles:");
    expect(output).toContain("No data available.");
  });
});

describe("formatRecovery", () => {
  test("renders multiple recovery records", () => {
    const payload: RecoveryPayload = {
      recoveries: [
        {
          id: 1,
          score_state: "SCORED",
          score: {
            recovery_score: 80,
          },
        },
        {
          id: 2,
          score_state: "PENDING_SCORE",
          score: {
            recovery_score: 65,
          },
        },
      ],
    };

    const output = formatRecovery(payload);

    expect(output).toContain("WHOOP Recovery");
    expect(output).toContain("Recovery 1:");
    expect(output).toContain("Recovery 2:");
    expect(output).toContain("Recovery Score: 80%");
    expect(output).toContain("Score Status: Pending Score");
  });
});

describe("formatSleep", () => {
  test("renders sleep records and no-data state", () => {
    const payload: SleepPayload = {
      sleeps: [
        {
          id: 7,
          nap: false,
          score_state: "SCORED",
          score: {
            sleep_performance_percentage: 93,
          },
        },
      ],
    };

    const output = formatSleep(payload);

    expect(output).toContain("WHOOP Sleep");
    expect(output).toContain("Sleep 1:");
    expect(output).toContain("Nap: No");
    expect(output).toContain("Sleep Performance: 93%");

    const emptyOutput = formatSleep({ sleeps: [] });
    expect(emptyOutput).toContain("Sleep:");
    expect(emptyOutput).toContain("No data available.");
  });
});

describe("formatUser", () => {
  test("renders profile and body measurement sections", () => {
    const payload: UserPayload = {
      profile: {
        id: 1,
        first_name: "Test",
        last_name: "User",
      },
      bodyMeasurement: {
        id: 2,
        height_meter: 1.82,
        weight_kilogram: 75.4,
        max_heart_rate: 190,
      },
    };

    const output = formatUser(payload);

    expect(output).toContain("WHOOP User");
    expect(output).toContain("Profile:");
    expect(output).toContain("First Name: Test");
    expect(output).toContain("Body Measurement:");
    expect(output).toContain("Height Meter: 1.82");
    expect(output).toContain("Weight Kilogram: 75.4");
    expect(output).toContain("Maximum Heart Rate: 190 bpm");
  });
});
