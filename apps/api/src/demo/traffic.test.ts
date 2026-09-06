import { describe, expect, it } from "vitest";
import { planTraffic, sendTraffic } from "./traffic";

describe("planTraffic", () => {
  it("fits as many requests into the duration as the interval allows", () => {
    expect(planTraffic({ durationMs: 30_000, intervalMs: 250 })).toEqual({
      durationMs: 30_000,
      intervalMs: 250,
      requests: 120,
    });
  });

  it("sends at least one request however short the duration is", () => {
    expect(planTraffic({ durationMs: 10, intervalMs: 250 }).requests).toBe(1);
  });
});

describe("sendTraffic", () => {
  const plan = { durationMs: 30, intervalMs: 10, requests: 3 };

  it("sends the whole plan and waits between requests", async () => {
    const sent: number[] = [];
    const waits: number[] = [];

    const result = await sendTraffic(plan, {
      send: async (n) => {
        sent.push(n);
      },
      wait: async (ms) => {
        waits.push(ms);
      },
    });

    expect(sent).toEqual([1, 2, 3]);
    expect(waits).toEqual([10, 10]);
    expect(result).toEqual({ sent: 3, failed: 0 });
  });

  it("counts a request the network refused and keeps going", async () => {
    const result = await sendTraffic(plan, {
      send: async (n) => {
        if (n === 2) throw new Error("connection refused");
      },
      wait: async () => {},
    });

    expect(result).toEqual({ sent: 3, failed: 1 });
  });

  it("stops early when the run is cancelled", async () => {
    const controller = new AbortController();
    const sent: number[] = [];

    const result = await sendTraffic(plan, {
      send: async (n) => {
        sent.push(n);
        if (n === 2) controller.abort();
      },
      wait: async () => {},
      signal: controller.signal,
    });

    expect(sent).toEqual([1, 2]);
    expect(result).toEqual({ sent: 2, failed: 0 });
  });
});
