# USGS aggregation · official-water · 2026-08-18

Shipped in `main.ts` today:

```
siteName:     identical
stageFtX100:  median
observedAt:   identical   // ISO string from USGS IV dateTime
```

Simulation is one node. This will not survive a real Workflow DON.

## Why identical on observedAt fails

Each DON node GETs USGS Instantaneous Values on its own clock. The Cameo series (09095500) publishes a new gage height on a 15-minute tick. Nodes that fetch across that tick get different `dateTime` strings. `identical` requires every node to return the exact same string. Consensus then fails and the cron tick is dropped.

`siteName` as `identical` is fine. The gage name does not change mid-fetch.

`stageFtX100` as `median` is the right shape. Stage is a number. That is how CRE treats prices.

## What the SDK actually offers

Installed `@chainlink/cre-sdk` 1.19.1 (`consensus_aggregators.d.ts`):

| Helper | What it does |
|--------|----------------|
| `identical` | all nodes must match |
| `median` | numeric median (prices, quantities, timestamps) |
| `mode` / `frequencyList` | majority / histogram |
| `ignore` | omit the field from the consensus map |

`ignore` exists. The house CRE skill table omitted it. The self-audit said "use ignore on timestamps." That stops the DON from dying. It also means `observedAt` in the result is not BFT-agreed. You cannot print that time as a signed official column.

Official CRE concepts: **median for timestamps**.

## Shipped 2026-08-18 (this rebuild)

```
type UsgsStage = {
  siteName: string;       // identical
  stageFtX100: number;    // median
  observedAtUnix: number; // Date.parse(dateTime)/1000, then median
};
```

Keep the USGS hydrologic time. Do not substitute `runtime.now()` unless the product only cares when the DON agreed.

Chimera risk: median stage and median time can come from different readings if the 15-minute tick lands in the fetch window. For Cameo stage that window is small. A later quality flag (reject if stage samples spread more than N hundredths) is optional, not required for the lab.

## Also still broken

`body.value.timeSeries[0].values[0].value[0]` throws on an empty series. Same class: NASA `Object.keys(series)[0]` is not guaranteed to be the lagged day. Guard both before aggregating.

Pages say "signed pair." `onCronTrigger` never calls `runtime.report()`. JSON stringify is not a signed report.

## NASA

`day: identical` is correct. The URL is built from `runtime.now()` minus lag, so every node asks for the same POWER day. `tempCx10: median` is correct.
