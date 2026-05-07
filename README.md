# Solar Scout

A Node.js engine for evaluating Wisconsin solar farm opportunities. Scores land parcels, stacks 2026 incentives, matches equipment, and ranks revenue strategies — all from the command line.

## Modules

| File | What it does |
|---|---|
| `land_scouter.js` | Scores counties by sun hours, filters parcels by slope/wetlands/line proximity, returns live LandSearch/LandWatch listing URLs |
| `grant_engine.js` | Calculates the full 2026 incentive stack: 30% Federal ITC, tiered Focus on Energy rebate, MACRS depreciation, WI sales & property tax exemptions |
| `equipment_matcher.js` | Selects Jinko Tiger Neo bifacial panels + SMA Sunny Tripower string inverters, fixed-tilt or single-axis tracker racking |
| `strategy_ranker.js` | Ranks revenue paths (Alliant net metering, MGE retail offset, PPA tiers) using the Kelly Criterion against an 8–12 year payback target |
| `dashboard.js` | CLI command center — wires all four engines together into a single assessment report |

## Setup

```bash
npm install
```

## Usage

```bash
node dashboard.js [county] [utility] [sizeKW] [tracker]
```

All parameters are optional and fall back to defaults.

| Parameter | Options | Default |
|---|---|---|
| `county` | Lafayette, Grant, Iowa, Dane, Green, Rock, Richland, Crawford, Columbia, Sauk, Dodge, Jefferson | Dane |
| `utility` | `"Alliant Energy"`, `"Madison Gas & Electric"`, `"MGE"`, `"We Energies"`, `"PPA"`, `"PPA Premium"` | Madison Gas & Electric |
| `sizeKW` | Any positive number | 250 |
| `tracker` | `tracker` to enable single-axis tracker, omit for fixed-tilt | fixed-tilt |

### Examples

```bash
node dashboard.js                                        # Dane, MGE, 250 kW, fixed-tilt
node dashboard.js Dane "Madison Gas & Electric" 500
node dashboard.js Lafayette "Alliant Energy" 250
node dashboard.js Grant "PPA Premium" 1000 tracker       # Best combo: 9.7yr payback
```

## 2026 Incentive Stack

| Incentive | Amount |
|---|---|
| Federal ITC | 30% of total installed cost (base) |
| Focus on Energy | $600/kW × first 4 kW, then $50/kW — capped at $25,000 |
| Focus on Energy Ag Bonus | +$10,000 for agricultural producers |
| WI Sales Tax | 0% on solar equipment (WI Stat. 77.54) |
| WI Property Tax | Solar improvements exempt from assessed value |
| MACRS Depreciation | 5-year schedule, 40% first-year bonus (2026) |

> ⚠️ Focus on Energy applications close **August 31, 2026**. Register before installation begins. USDA REAP grants are backlogged — contact your local USDA Rural Development office for current status.

## Top County Rankings

| County | Peak Sun hrs/day | Tier |
|---|---|---|
| Lafayette | 4.90 | 1 — Best |
| Grant | 4.85 | 1 — Best |
| Iowa / Dane | 4.84 | 1 — Best |
| Green | 4.80 | 1 — Excellent |
| Rock | 4.78 | 2 — Very Good |

## Data Freshness

- Grant & incentive rates: Focus on Energy Q1 2026 Newsletter, USDA RD Wisconsin
- Equipment specs: Jinko Tiger Neo / SMA Tripower benchmarks verified Q2 2026
- Grid rates: Alliant Energy 2026 base rate ($0.04254/kWh avoided cost), MGE retail offset ($0.14/kWh)
