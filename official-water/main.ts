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
 *   USGS  09095500  Colorado River near Cameo — gage height
 *   NASA POWER      8-day lagged 2m air temp at Grand Junction
 */

export type Config = {
  schedule: string;
  usgsUrl: string;
  nasaBaseUrl: string;
  nasaLagDays: number;
};

type UsgsStage = {
  siteName: string;
  stageFtX100: number;
  observedAt: string;
};

type NasaTemp = {
  day: string;
  tempCx10: number;
};

const yyyymmddUtc = (d: Date): string => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
};

const UA = { "User-Agent": "Caplifi-CRE-lab/1.0 (matt@caplifi.com)" };

const fetchUsgs = (sendRequester: HTTPSendRequester, url: string): UsgsStage => {
  const response = sendRequester.sendRequest({ url, method: "GET", headers: UA }).result();
  if (!ok(response)) {
    throw new Error(`USGS HTTP ${response.statusCode}`);
  }
  const body = json(response) as {
    value: {
      timeSeries: Array<{
        sourceInfo: { siteName: string };
        values: Array<{ value: Array<{ value: string; dateTime: string }> }>;
      }>;
    };
  };
  const series = body.value.timeSeries[0];
  const reading = series.values[0].value[0];
  const stageFt = Number(reading.value);
  if (!Number.isFinite(stageFt)) {
    throw new Error("USGS stage is not a number");
  }
  return {
    siteName: series.sourceInfo.siteName,
    stageFtX100: Math.round(stageFt * 100),
    observedAt: reading.dateTime,
  };
};

const fetchNasa = (sendRequester: HTTPSendRequester, url: string): NasaTemp => {
  const response = sendRequester.sendRequest({ url, method: "GET", headers: UA }).result();
  if (!ok(response)) {
    throw new Error(`NASA POWER HTTP ${response.statusCode}`);
  }
  const body = json(response) as {
    properties: { parameter: { T2M: Record<string, number> } };
  };
  const series = body.properties.parameter.T2M;
  const day = Object.keys(series)[0];
  const t2m = series[day];
  if (!Number.isFinite(t2m) || t2m <= -900) {
    throw new Error(`NASA T2M missing for ${day}`);
  }
  return { day, tempCx10: Math.round(t2m * 10) };
};

const usgsAgg = ConsensusAggregationByFields<UsgsStage>({
  siteName: identical,
  stageFtX100: median,
  observedAt: identical,
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
      observedAt: usgs.observedAt,
    },
    nasa: {
      day: nasa.day,
      t2mC: nasa.tempCx10 / 10,
    },
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
