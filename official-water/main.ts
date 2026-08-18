import {
  ConsensusAggregationByFields,
  CronCapability,
  HTTPClient,
  Runner,
  handler,
  identical,
  json,
  median,
  ok,
  type HTTPSendRequester,
  type Runtime,
} from "@chainlink/cre-sdk";

/**
 * Two independent official sources. This is the CRE-shaped water project.
 * Not "every node fetches my collector." Different publishers, then consensus.
 *
 *   USGS  09095500  Colorado River near Cameo - gage height
 *   NASA POWER      8-day lagged 2m air temp at Grand Junction
 *
 * Aggregation (DON):
 *   siteName / day     identical
 *   stage / temp       median
 *   observedAtUnix     median   (ISO dateTime is not identical across nodes)
 */

export type Config = {
  schedule: string;
  usgsUrl: string;
  nasaBaseUrl: string;
  nasaLagDays: number;
};

export type UsgsStage = {
  siteName: string;
  stageFtX100: number;
  observedAtUnix: number;
};

export type NasaTemp = {
  day: string;
  tempCx10: number;
};

type UsgsIvJson = {
  value?: {
    timeSeries?: Array<{
      sourceInfo?: { siteName?: string };
      values?: Array<{ value?: Array<{ value?: string; dateTime?: string }> }>;
    }>;
  };
};

type NasaPowerJson = {
  properties?: { parameter?: { T2M?: Record<string, number> } };
};

const UA = { "User-Agent": "Caplifi-CRE-lab/1.0 (matt@caplifi.com)" };

export const yyyymmddUtc = (d: Date): string => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
};

export const unixFromUsgsDateTime = (dateTime: string): number => {
  const ms = Date.parse(dateTime);
  if (!Number.isFinite(ms)) {
    throw new Error(`USGS dateTime is not parseable: ${dateTime}`);
  }
  return Math.floor(ms / 1000);
};

export const startDayFromNasaUrl = (url: string): string | undefined => {
  const match = url.match(/[?&]start=(\d{8})/);
  return match ? match[1] : undefined;
};

export const parseUsgsBody = (body: unknown): UsgsStage => {
  const data = body as UsgsIvJson;
  const series = data.value?.timeSeries?.[0];
  const reading = series?.values?.[0]?.value?.[0];
  const siteName = (series?.sourceInfo?.siteName || "").trim();
  const raw = reading?.value;
  const dateTime = reading?.dateTime;
  if (!series) {
    throw new Error("USGS returned no time series");
  }
  if (!reading || raw === undefined || !dateTime) {
    throw new Error("USGS returned no readings");
  }
  if (!siteName) {
    throw new Error("USGS site name is empty");
  }
  const stageFt = Number(raw);
  if (!Number.isFinite(stageFt)) {
    throw new Error("USGS stage is not a number");
  }
  return {
    siteName,
    stageFtX100: Math.round(stageFt * 100),
    observedAtUnix: unixFromUsgsDateTime(dateTime),
  };
};

export const parseNasaBody = (body: unknown, expectedDay?: string): NasaTemp => {
  const data = body as NasaPowerJson;
  const series = data.properties?.parameter?.T2M;
  if (!series || typeof series !== "object") {
    throw new Error("NASA POWER returned no T2M series");
  }
  const day = expectedDay && expectedDay in series ? expectedDay : undefined;
  if (!day) {
    const keys = Object.keys(series);
    throw new Error(
      expectedDay
        ? `NASA T2M missing for ${expectedDay}`
        : `NASA T2M missing (keys: ${keys.join(",") || "none"})`,
    );
  }
  const t2m = series[day];
  if (!Number.isFinite(t2m) || t2m <= -900) {
    throw new Error(`NASA T2M missing for ${day}`);
  }
  return { day, tempCx10: Math.round(t2m * 10) };
};

const fetchUsgs = (sendRequester: HTTPSendRequester, url: string): UsgsStage => {
  const response = sendRequester.sendRequest({ url, method: "GET", headers: UA }).result();
  if (!ok(response)) {
    throw new Error(`USGS HTTP ${response.statusCode}`);
  }
  return parseUsgsBody(json(response));
};

const fetchNasa = (sendRequester: HTTPSendRequester, url: string): NasaTemp => {
  const response = sendRequester.sendRequest({ url, method: "GET", headers: UA }).result();
  if (!ok(response)) {
    throw new Error(`NASA POWER HTTP ${response.statusCode}`);
  }
  return parseNasaBody(json(response), startDayFromNasaUrl(url));
};

const usgsAgg = ConsensusAggregationByFields<UsgsStage>({
  siteName: identical,
  stageFtX100: median,
  observedAtUnix: median,
});

const nasaAgg = ConsensusAggregationByFields<NasaTemp>({
  day: identical,
  tempCx10: median,
});

export const onCronTrigger = (runtime: Runtime<Config>): string => {
  const http = new HTTPClient();
  const usgs = http.sendRequest(runtime, fetchUsgs, usgsAgg)(runtime.config.usgsUrl).result();

  const lagMs = runtime.config.nasaLagDays * 24 * 60 * 60 * 1000;
  const day = yyyymmddUtc(new Date(runtime.now().getTime() - lagMs));
  const nasaUrl = `${runtime.config.nasaBaseUrl}&start=${day}&end=${day}`;
  const nasa = http.sendRequest(runtime, fetchNasa, nasaAgg)(nasaUrl).result();

  const report = {
    field: "official-only two-column",
    usgs: {
      site: usgs.siteName,
      stageFt: usgs.stageFtX100 / 100,
      observedAtUnix: usgs.observedAtUnix,
      observedAt: new Date(usgs.observedAtUnix * 1000).toISOString(),
    },
    nasa: {
      day: nasa.day,
      t2mC: nasa.tempCx10 / 10,
    },
    consensus: {
      usgs: { siteName: "identical", stageFtX100: "median", observedAtUnix: "median" },
      nasa: { day: "identical", tempCx10: "median" },
    },
    note: "consensus JSON from simulation. not a signed CRE report.",
  };
  runtime.log(
    `[official-water] ${report.usgs.site} stage ${report.usgs.stageFt} ft · NASA T2M ${report.nasa.t2mC} C (${report.nasa.day})`,
  );
  return JSON.stringify(report);
};

export const initWorkflow = (config: Config) => {
  const cron = new CronCapability();
  return [handler(cron.trigger({ schedule: config.schedule }), onCronTrigger)];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}
