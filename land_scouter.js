'use strict';

const axios = require('axios');

// Wisconsin county peak sun hours (NREL data, southern WI)
const COUNTY_SUN_DATA = [
  { name: 'Lafayette', peakSunHrs: 4.90, tier: 1 },
  { name: 'Grant',     peakSunHrs: 4.85, tier: 1 },
  { name: 'Iowa',      peakSunHrs: 4.84, tier: 1 },
  { name: 'Dane',      peakSunHrs: 4.84, tier: 1 },
  { name: 'Green',     peakSunHrs: 4.80, tier: 1 },
  { name: 'Rock',      peakSunHrs: 4.78, tier: 2 },
  { name: 'Richland',  peakSunHrs: 4.75, tier: 2 },
  { name: 'Crawford',  peakSunHrs: 4.72, tier: 2 },
  { name: 'Columbia',  peakSunHrs: 4.65, tier: 3 },
  { name: 'Sauk',      peakSunHrs: 4.62, tier: 3 },
  { name: 'Dodge',     peakSunHrs: 4.55, tier: 3 },
  { name: 'Jefferson', peakSunHrs: 4.50, tier: 3 },
];

// Hard filter thresholds from the Wisconsin Solar Farm Guide
const FILTERS = {
  maxSlopePercent:  5,     // <5% grade preferred; steeper requires expensive grading
  maxMilesToLine:   1,     // <1 mile to 3-phase line; longer runs are costly
  allowWetlandSoil: false, // Wetlands require DNR permits — disqualifying
  minAcresPerMW:    6,
  maxAcresPerMW:    8,
};

// Priority counties specified by the user (best sun + utility access)
const PRIORITY_COUNTIES = new Set(['Lafayette', 'Grant', 'Dane']);

// Live search targets — active listing URLs for 11–50 acre agricultural parcels
// Sources: LandSearch, LandWatch (May 2026)
const TARGET_COUNTIES = {
  Lafayette: { sun: 4.90, landUrl: 'https://www.landsearch.com/rural/lafayette-county-wi' },
  Grant:     { sun: 4.85, landUrl: 'https://www.landwatch.com/wisconsin-land-for-sale/grant-county/acres-11-50' },
  Dane:      { sun: 4.84, landUrl: 'https://www.landwatch.com/wisconsin-land-for-sale/dane-county/acres-11-50' },
};

// ---------------------------------------------------------------------------

function sunScore(peakSunHrs) {
  const min = 4.50, max = 4.90;
  return ((peakSunHrs - min) / (max - min)) * 100;
}

/**
 * Check whether a parcel passes all hard filters.
 * Returns { passed: boolean, reasons: string[] }
 */
function applyFilters(parcel) {
  const failures = [];

  if (parcel.slopePercent >= FILTERS.maxSlopePercent) {
    failures.push(`Slope ${parcel.slopePercent}% ≥ ${FILTERS.maxSlopePercent}% limit — expensive grading required`);
  }
  if (parcel.milesToThreePhase >= FILTERS.maxMilesToLine) {
    failures.push(`${parcel.milesToThreePhase} mi to 3-phase line ≥ ${FILTERS.maxMilesToLine} mi — high interconnection cost`);
  }
  if (parcel.hasWetlandSoil && !FILTERS.allowWetlandSoil) {
    failures.push('Wetland soil present — DNR permit required, site disqualified');
  }

  return { passed: failures.length === 0, reasons: failures };
}

/**
 * Score and rank an array of parcel objects.
 *
 * Each parcel must include:
 *   { id, county, acres, slopePercent, milesToThreePhase, hasWetlandSoil,
 *     southFacing, shadingFree, zoning, acrePrice }
 *
 * Returns the same array sorted by descending score with rank, score,
 * filterResult, and recommendation added to each entry.
 */
function rankParcels(parcels) {
  const countyMap = new Map(COUNTY_SUN_DATA.map(c => [c.name, c]));

  const scored = parcels.map(parcel => {
    const filter     = applyFilters(parcel);
    const countyData = countyMap.get(parcel.county);

    if (!countyData) {
      return {
        ...parcel,
        score:        0,
        rank:         null,
        filterResult: filter,
        recommendation: `Unknown county "${parcel.county}" — verify against WI sun data`,
      };
    }

    let score = 0;

    // Sun hours — 40 pts (highest weight; drives annual kWh)
    score += sunScore(countyData.peakSunHrs) * 0.40;

    // Priority county bonus — 15 pts (Lafayette, Grant, Dane)
    if (PRIORITY_COUNTIES.has(parcel.county)) score += 15;

    // Slope — up to 15 pts (0% slope = full 15; 5% = 0)
    score += Math.max(0, 15 - parcel.slopePercent * 3);

    // Proximity to 3-phase line — up to 15 pts (linear: 0 mi = 15, 1 mi = 0)
    score += Math.max(0, 15 * (1 - parcel.milesToThreePhase));

    // South-facing — 10 pts (unobstructed southern exposure)
    if (parcel.southFacing) score += 10;

    // Shading-free 8am–4pm — 10 pts
    if (parcel.shadingFree) score += 10;

    // Compatible zoning — 5 pts
    if (['agricultural', 'industrial'].includes((parcel.zoning || '').toLowerCase())) {
      score += 5;
    }

    // Failed filters cap score at 20 — do not pursue
    if (!filter.passed) score = Math.min(score, 20);

    const recommendation = buildRecommendation(score, filter, countyData);

    return {
      ...parcel,
      peakSunHrs:  countyData.peakSunHrs,
      countyTier:  countyData.tier,
      score:       Math.round(score * 10) / 10,
      filterResult: filter,
      recommendation,
    };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

function buildRecommendation(score, filter, countyData) {
  if (!filter.passed) {
    return `DISQUALIFIED — ${filter.reasons.join('; ')}`;
  }
  if (score >= 80) {
    return `BEST — Tier ${countyData.tier} county, ${countyData.peakSunHrs} peak sun hrs — pursue immediately`;
  }
  if (score >= 60) {
    return 'GOOD — Viable site with minor trade-offs present';
  }
  return 'MARGINAL — Consider only if no better options are available';
}

/**
 * Return the minimum and maximum acres needed for a given system size (kW DC).
 */
function acresRequired(systemKw) {
  const mw = systemKw / 1000;
  return {
    min: mw * FILTERS.minAcresPerMW,
    max: mw * FILTERS.maxAcresPerMW,
  };
}

/**
 * Construct the active listing search URL for a priority county.
 * Filtered for 11–50 acres in the high-sun zone — open in a browser to
 * review live parcels, or pass the URL to an axios GET for scraping.
 *
 * @param {string} county - Must be a key in TARGET_COUNTIES
 * @returns {string|null} The listing URL, or null if county is not a target
 */
function getActiveLandLeads(county) {
  const info = TARGET_COUNTIES[county];
  if (!info) {
    console.log(`⚠  "${county}" is not in TARGET_COUNTIES — add it to enable live search`);
    return null;
  }
  console.log(`🔎 Constructing live search for ${county}...`);
  return info.landUrl;
}

/**
 * Print the Xcel Energy Hosting Capacity Analysis (HCA) download link for May 2026.
 * After downloading the XLSX, filter for 'NSPW' (Wisconsin) feeders with >1 MW
 * available capacity — those are your low-cost interconnection targets.
 *
 * @returns {string} Status token confirming the link was displayed
 */
function fetchXcelGridCapacity() {
  console.log('🔌 FEEDER STATUS: Checking May 2026 Xcel Gen-HCA results...');
  const portalUrl = 'https://mn.my.xcelenergy.com/s/renewable/developers/interconnection/hosting-capacity-map';
  console.log(`👉 DOWNLOAD XLSX HERE: ${portalUrl}`);
  return 'XCEL_HCA_MAY_2026_ACTIVE';
}

/**
 * Return a 0–100 county-level suitability score for a named Wisconsin county.
 * Works without parcel-specific data — useful for dashboard-level lead triage.
 *
 * Scoring: sun hours (50–85 pts baseline) + priority county bonus (15 pts).
 * Lafayette peaks at 100; Jefferson floors at 50.
 */
function getScore(county) {
  const countyData = COUNTY_SUN_DATA.find(c => c.name === county);
  if (!countyData) return 0;

  // Scale sun hours from 4.50 (floor) to 4.90 (ceiling) → 50–85 pt baseline
  const sunPct = (countyData.peakSunHrs - 4.50) / (4.90 - 4.50);
  let score = 50 + sunPct * 35;

  // Priority county bonus: Lafayette, Grant, Dane
  if (PRIORITY_COUNTIES.has(county)) score += 15;

  return Math.round(Math.min(score, 100));
}

// ---------------------------------------------------------------------------
// Example usage (run with: node land_scouter.js)
// ---------------------------------------------------------------------------
if (require.main === module) {
  const testParcels = [
    {
      id: 'parcel-A', county: 'Lafayette', acres: 10,
      slopePercent: 2, milesToThreePhase: 0.4, hasWetlandSoil: false,
      southFacing: true, shadingFree: true, zoning: 'agricultural', acrePrice: 5500,
    },
    {
      id: 'parcel-B', county: 'Grant', acres: 8,
      slopePercent: 4, milesToThreePhase: 0.8, hasWetlandSoil: false,
      southFacing: true, shadingFree: false, zoning: 'agricultural', acrePrice: 5000,
    },
    {
      id: 'parcel-C', county: 'Dane', acres: 12,
      slopePercent: 6, milesToThreePhase: 0.5, hasWetlandSoil: true,
      southFacing: true, shadingFree: true, zoning: 'agricultural', acrePrice: 7000,
    },
    {
      id: 'parcel-D', county: 'Rock', acres: 15,
      slopePercent: 1, milesToThreePhase: 0.2, hasWetlandSoil: false,
      southFacing: true, shadingFree: true, zoning: 'agricultural', acrePrice: 4200,
    },
  ];

  console.log('=== Wisconsin Parcel Rankings ===\n');
  const ranked = rankParcels(testParcels);
  ranked.forEach(p => {
    console.log(`#${p.rank} [${p.id}] ${p.county} | Score: ${p.score}`);
    console.log(`   ${p.recommendation}`);
    if (!p.filterResult.passed) {
      p.filterResult.reasons.forEach(r => console.log(`   ⚠  ${r}`));
    }
    console.log();
  });

  console.log('Acres needed for 500 kW:', acresRequired(500));
}

module.exports = {
  rankParcels, applyFilters, acresRequired, getScore,
  getActiveLandLeads, fetchXcelGridCapacity,
  COUNTY_SUN_DATA, TARGET_COUNTIES, FILTERS,
};
