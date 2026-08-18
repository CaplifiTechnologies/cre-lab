import { describe, expect, test } from "bun:test";
import {
  parseNasaBody,
  parseUsgsBody,
  startDayFromNasaUrl,
  unixFromUsgsDateTime,
  yyyymmddUtc,
} from "./main";

const usgsOk = {
  value: {
    timeSeries: [
      {
        sourceInfo: { siteName: "COLORADO RIVER NEAR CAMEO, CO" },
        values: [
          {
            value: [{ value: "3.65", dateTime: "2026-08-18T11:00:00.000-06:00" }],
          },
        ],
      },
    ],
  },
};

describe("parseUsgsBody", () => {
  test("reads Cameo stage and unix time", () => {
    const got = parseUsgsBody(usgsOk);
    expect(got.siteName).toBe("COLORADO RIVER NEAR CAMEO, CO");
    expect(got.stageFtX100).toBe(365);
    expect(got.observedAtUnix).toBe(unixFromUsgsDateTime("2026-08-18T11:00:00.000-06:00"));
    expect(got.observedAtUnix).toBeGreaterThan(1_700_000_000);
  });

  test("throws on empty series", () => {
    expect(() => parseUsgsBody({ value: { timeSeries: [] } })).toThrow("no time series");
  });

  test("throws on empty readings", () => {
    expect(() =>
      parseUsgsBody({
        value: {
          timeSeries: [{ sourceInfo: { siteName: "X" }, values: [{ value: [] }] }],
        },
      }),
    ).toThrow("no readings");
  });

  test("throws on non-numeric stage", () => {
    expect(() =>
      parseUsgsBody({
        value: {
          timeSeries: [
            {
              sourceInfo: { siteName: "X" },
              values: [{ value: [{ value: "ice", dateTime: "2026-08-18T11:00:00.000-06:00" }] }],
            },
          ],
        },
      }),
    ).toThrow("not a number");
  });
});

describe("parseNasaBody", () => {
  test("requires the requested day", () => {
    const got = parseNasaBody({ properties: { parameter: { T2M: { "20260810": 27.8 } } } }, "20260810");
    expect(got.day).toBe("20260810");
    expect(got.tempCx10).toBe(278);
  });

  test("does not pick a neighbor day", () => {
    expect(() =>
      parseNasaBody({ properties: { parameter: { T2M: { "20260809": 20, "20260811": 21 } } } }, "20260810"),
    ).toThrow("20260810");
  });

  test("rejects fill values", () => {
    expect(() =>
      parseNasaBody({ properties: { parameter: { T2M: { "20260810": -999 } } } }, "20260810"),
    ).toThrow("missing");
  });
});

describe("helpers", () => {
  test("yyyymmddUtc pads", () => {
    expect(yyyymmddUtc(new Date(Date.UTC(2026, 7, 8)))).toBe("20260808");
  });

  test("startDayFromNasaUrl", () => {
    expect(startDayFromNasaUrl("https://x.test/?start=20260810&end=20260810")).toBe("20260810");
    expect(startDayFromNasaUrl("https://x.test/?end=20260810")).toBeUndefined();
  });
});
