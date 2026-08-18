# CRE lab · you type this · Thursday 2026-08-20

**Who:** Matt, not the AI stack.  
**Why:** Noel and Ash will ask how working with CRE is going. You need answers from your hands.  
**Org:** Caplifi · `matt@caplifi.com` · Deploy Access still off. Simulate only until they enable it.  
**Home:** `~/cre-lab`  
**Approve:** `cap-20260818-cdb9e90a36`

---

## Why the moisture DON felt fake

Your instinct is right.

If every DON node GETs **your** collector URL, consensus only proves the nodes agree on what **one server said**. That is not an oracle. It is a signed HTTP client. The probes and dashboard can stay. They are not the CRE project.

CRE earns its keep when:

1. **Different origins** are fetched (USGS vs NASA, Aave vs a route API), then nodes agree on the numbers.
2. **No hot key** — a report goes to a contract that already has caps, pause, and a forwarder.
3. **Lifecycle** — deploy / activate / pause on a DON, not a cron on this Mac.

That is the sentence you say Thursday.

---

## The four projects you will actually know

| # | Project | Where | Why CRE | You do |
|---|---------|--------|---------|--------|
| **1** | `hello-cron` | `~/cre-lab/hello-cron` | Cron trigger. You have compiled WASM and seen a simulate result. | Type the simulate. Read `main.ts` (12 lines). |
| **2** | `official-water` | `~/cre-lab/official-water` | Two publishers: USGS Cameo stage + NASA POWER temp. Consensus on each. | Simulate. Open the two URLs in a browser. Change a site id. Simulate again. |
| **3** | Position keeper | `~/cre-high-risk-yield-chaser/yield-chaser` | EVM read of Aave HF → signed report → `StrategyVault` caps. Textbook keeper. | Simulate. Read the cron handler and the vault `onReport` path. Call it a **position keeper**, not a yield chaser. |
| **4** | `StrategyVault` | `~/cre-high-risk-yield-chaser/contracts/StrategyVault.sol` | The consumer. CRE is useless without a receiver that can say no. | Read: forwarder check, HF floor, pause, size cap. Be able to say those four words. |

**Parked (not Thursday lead)**

- Moisture collector / ESP32 — hardware is real; wrapping localhost in CRE is not.
- Confidential HTTP — ask them when it leaves simulation. Do not build it.
- Mainnet, 0.2 ETH, partnership, Camelot, Spend Spine — out of the room.

---

## Commands you type (from the project root)

```bash
export PATH="$HOME/.cre/bin:$PATH"
cd ~/cre-lab
cre whoami
cre workflow simulate hello-cron --target staging-settings --non-interactive --trigger-index 0
cre workflow simulate official-water --target staging-settings --non-interactive --trigger-index 0

cd ~/cre-high-risk-yield-chaser
cre workflow simulate yield-chaser --target staging-settings --non-interactive --trigger-index 0
```

Open in the browser while it runs:

- https://docs.chain.link/cre/getting-started/overview
- https://app.chain.link/cre
- USGS Cameo: https://waterservices.usgs.gov/nwis/iv/?sites=09095500&parameterCd=00065&format=json
- NASA POWER (change the dates if empty): https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M&community=AG&longitude=-108.55&latitude=39.07&start=20260810&end=20260810&format=JSON

---

## What “I know this” means by Thursday

For **each** of the four, you can say out loud, without notes:

1. What triggers it.
2. What it reads.
3. What consensus is agreeing on (or that hello has nothing to agree on).
4. What it does **not** do (no mainnet, no headgate, no collector-as-truth).
5. One thing that broke or surprised you when you simulated it.

If you cannot do that for a project, it is not on the call.

---

## Practice order (today → Thursday)

**Today (Tue)** — hello-cron until it is boring. Then official-water once.  
**Wed** — official-water: change the USGS site to `09106150` (Grand Valley Diversion, param `00060` flow) and get a new simulate. Then open `yield-chaser/main.ts` and find the Aave read + report write. Simulate keeper.  
**Thu morning** — run all three simulates. Read the four vault words. Then the call.

---

## Thursday one-liner

> I have three workflows I can simulate today: a hello cron so I own the CLI, a two-source official-water report (USGS Cameo + NASA POWER), and a Sepolia position keeper into an owner-capped vault. I am blocked on Deploy Access, not on learning CRE. The soil-probe collector is hardware. I am not asking you to wrap my localhost in a DON.

---

## Restore this desk

```bash
python3 ~/ALMI/workspace_desk.py go cre
```
