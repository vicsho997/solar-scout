'use strict';

// ── Revenue models (Wisconsin, 2026) ─────────────────────────────────────────
const REVENUE_MODELS = {
  alliant_net_metering: {
    id:          'alliant_net_metering',
    label:       'Alliant Energy Net Metering',
    ratePerKwh:  0.04254,      // Avoided cost, Jan 2026 — central/western WI
    utility:     'Alliant Energy',
    serviceArea: 'Central/Western WI (Grant, Lafayette, Richland, Crawford…)',
    contractYrs: null,         // No lock-in — rate can be revised by PSC
    riskLevel:   'MEDIUM',
    notes:       'Lowest export rate but simplest setup — good for small systems',
  },
  mge_retail_offset: {
    id:          'mge_retail_offset',
    label:       'Madison Gas & Electric Retail Offset',
    ratePerKwh:  0.14,         // MGE retail rate offset (net metering, Dane County)
    utility:     'Madison Gas & Electric',
    serviceArea: 'Dane County',
    contractYrs: null,
    riskLevel:   'LOW-MEDIUM',
    notes:       'Retail-rate offset — significantly better economics than avoided-cost metering',
  },
  ppa_standard: {
    id:          'ppa_standard',
    label:       'Power Purchase Agreement (Standard)',
    ratePerKwh:  0.07,         // Mid-range contracted PPA, typical WI 2026
    utility:     'Varies (competitive RFP)',
    serviceArea: 'Statewide',
    contractYrs: 20,
    riskLevel:   'LOW',        // Locked-in rate, guaranteed buyer
    notes:       'Contracted 20-year revenue stream — good for systems 500kW+',
  },
  ppa_premium: {
    id:          'ppa_premium',
    label:       'Power Purchase Agreement (Premium)',
    ratePerKwh:  0.10,         // Upper-end PPA — competitive or community solar
    utility:     'Varies',
    serviceArea: 'Statewide',
    contractYrs: 25,
    riskLevel:   'LOW',
    notes:       'Higher contracted rate — may require competitive RFP or community solar structure',
  },
};

// 8–12 year payback target from the Wisconsin Solar Farm Guide
const PAYBACK_TARGET = { best: 8, better: 10, good: 12 };

// Wisconsin average and priority-county peak sun hours
const WI_AVG_PEAK_SUN_HRS      = 4.29;
const PRIORITY_PEAK_SUN_HRS    = 4.87; // Average of Lafayette (4.9), Grant (4.85), Dane (4.84)

// ---------------------------------------------------------------------------

/**
 * Estimate annual kWh production for a system.
 *
 * @param {number}  systemKw    - DC system size
 * @param {number}  peakSunHrs  - Location-specific peak sun hours/day
 * @param {boolean} hasTracker  - Single-axis tracker (+22% output)?
 * @param {boolean} bifacial    - Bifacial panels? (mid-point 7% winter gain)
 * @returns {number} Annual kWh production
 */
function annualProduction(systemKw, peakSunHrs, hasTracker = false, bifacial = true) {
  const systemLosses  = hasTracker ? 0.85 : 0.80;  // Soiling, wiring, temp derating
  const trackerBonus  = hasTracker ? 1.22 : 1.00;  // +22% from single-axis tracking
  const bifacialBonus = bifacial   ? 1.07 : 1.00;  // Mid-point of 5–15% WI snow bonus
  return systemKw * peakSunHrs * 365 * systemLosses * trackerBonus * bifacialBonus;
}

/**
 * Kelly Criterion adapted for solar revenue strategy ranking.
 *
 * Kelly fraction = edge × risk_multiplier
 *   edge            = how much better than the worst acceptable payback (12yr)
 *   risk_multiplier = penalizes higher-risk revenue paths (rate fluctuation, no contract)
 *
 * Returns 0–1; higher = stronger position to commit capital to this strategy.
 */
function kellyFraction(paybackYears, riskLevel) {
  if (paybackYears >= PAYBACK_TARGET.good) return 0; // At or beyond worst-case — do not rank

  const edge = (PAYBACK_TARGET.good - paybackYears) / PAYBACK_TARGET.good;

  const riskMultiplier = {
    'LOW':        1.00,
    'LOW-MEDIUM': 0.85,
    'MEDIUM':     0.70,
    'HIGH':       0.50,
  };

  return Math.min(edge * (riskMultiplier[riskLevel] || 0.70), 1.0);
}

/**
 * Classify a payback period using the 8–12 year guide target.
 */
function paybackRating(paybackYears) {
  if (paybackYears <= PAYBACK_TARGET.best)   return 'BEST';
  if (paybackYears <= PAYBACK_TARGET.better) return 'BETTER';
  if (paybackYears <= PAYBACK_TARGET.good)   return 'GOOD';
  return 'BELOW TARGET';
}

/**
 * Rank revenue strategies for a project using the Kelly Criterion.
 *
 * @param {object}   params
 * @param {number}   params.systemKw           - DC system size in kW
 * @param {number}   params.netCostAfterITC    - Effective cost after ITC + all grants ($)
 * @param {number}   [params.peakSunHrs]       - Peak sun hrs/day for site (default WI avg)
 * @param {boolean}  [params.hasTracker]       - Single-axis tracker installed?
 * @param {boolean}  [params.bifacial]         - Bifacial panels?
 * @param {string[]} [params.availableModels]  - Revenue model IDs to include
 * @returns {object[]} Strategies ranked highest Kelly fraction first
 */
function rankStrategies(params) {
  const {
    systemKw,
    netCostAfterITC,
    peakSunHrs      = WI_AVG_PEAK_SUN_HRS,
    hasTracker      = false,
    bifacial        = true,
    availableModels = Object.keys(REVENUE_MODELS),
  } = params;

  const kwhPerYear = annualProduction(systemKw, peakSunHrs, hasTracker, bifacial);

  const results = availableModels
    .map(id => REVENUE_MODELS[id])
    .filter(Boolean)
    .map(model => {
      const annualRevenue    = kwhPerYear * model.ratePerKwh;
      const paybackYears     = netCostAfterITC / annualRevenue;
      const kelly            = kellyFraction(paybackYears, model.riskLevel);
      const rating           = paybackRating(paybackYears);
      const lifetime25yrProfit = annualRevenue * 25 - netCostAfterITC;

      return {
        model,
        annualKwh:           Math.round(kwhPerYear),
        annualRevenue:       Math.round(annualRevenue),
        paybackYears:        Math.round(paybackYears * 10) / 10,
        rating,
        kellyFraction:       Math.round(kelly * 1000) / 1000,
        lifetime25yrProfit:  Math.round(lifetime25yrProfit),
        recommendation:      buildRecommendation(model, rating, kelly),
      };
    });

  return results.sort((a, b) => b.kellyFraction - a.kellyFraction);
}

function buildRecommendation(model, rating, kelly) {
  const kellyPct = (kelly * 100).toFixed(1);
  switch (rating) {
    case 'BEST':
      return `BEST — Kelly ${kellyPct}% — ${model.label}: payback within 8yr target`;
    case 'BETTER':
      return `BETTER — Kelly ${kellyPct}% — ${model.label}: strong 8–10yr payback`;
    case 'GOOD':
      return `GOOD — Kelly ${kellyPct}% — ${model.label}: acceptable 10–12yr payback`;
    default:
      return `BELOW TARGET — Payback exceeds 12yr — only viable with additional incentives`;
  }
}

/**
 * Head-to-head comparison of Alliant net metering vs. MGE retail offset vs. PPAs.
 * Useful for county-selection decisions (Grant/Lafayette → Alliant vs Dane → MGE).
 */
function compareUtilityStrategies(params) {
  return rankStrategies({
    ...params,
    availableModels: ['alliant_net_metering', 'mge_retail_offset', 'ppa_standard', 'ppa_premium'],
  });
}

// Maps plain utility names to their revenue model IDs
const UTILITY_MODEL_MAP = {
  'Alliant Energy':         'alliant_net_metering',
  'Madison Gas & Electric': 'mge_retail_offset',
  'MGE':                    'mge_retail_offset',
  'We Energies':            'alliant_net_metering', // no published export rate — avoided-cost proxy
  'Xcel Energy':            'ppa_standard',
  'PPA':                    'ppa_standard',         // contracted $0.07/kWh, 20-yr term
  'PPA Premium':            'ppa_premium',          // contracted $0.10/kWh, 25-yr term
};

/**
 * Quickly rank the primary revenue strategy for a utility + system size.
 * Designed for dashboard-level lead triage without full parcel or grant data.
 *
 * @param {string} utility   - Utility name (see UTILITY_MODEL_MAP)
 * @param {number} systemKw  - DC system size in kW
 * @returns {{ tier: string, advice: string, paybackYears: number, model: object }}
 */
function rankLead(utility, systemKw, hasTracker = false) {
  const modelId = UTILITY_MODEL_MAP[utility] || 'ppa_standard';
  const model   = REVENUE_MODELS[modelId];

  // Mid-point installed cost from guide; 30% ITC applied
  const costPerW        = systemKw <= 250 ? 2.65 : 2.40;
  const netCostAfterITC = systemKw * 1000 * costPerW * (1 - 0.30);

  const kwhPerYear    = annualProduction(systemKw, WI_AVG_PEAK_SUN_HRS, hasTracker, true);
  const annualRevenue = kwhPerYear * model.ratePerKwh;
  const paybackYears  = netCostAfterITC / annualRevenue;
  const rating        = paybackRating(paybackYears);

  const TIER_LABEL = { BEST: 'Best', BETTER: 'Better', GOOD: 'Good', 'BELOW TARGET': 'Below Target' };

  let advice;
  if (rating === 'BELOW TARGET' && modelId === 'alliant_net_metering') {
    advice = `Alliant avoided-cost rate ($${model.ratePerKwh}/kWh) alone yields ~${Math.round(paybackYears)} yr payback — pair with a PPA or negotiate a retail-rate agreement to hit the 8–12yr target`;
  } else if (modelId === 'mge_retail_offset') {
    advice = `MGE retail offset at $${model.ratePerKwh}/kWh delivers ~${paybackYears.toFixed(1)}-yr payback — strong economics in Dane County`;
  } else if (modelId === 'ppa_standard' || modelId === 'ppa_premium') {
    advice = `${model.contractYrs}-yr PPA at $${model.ratePerKwh}/kWh — locked-in revenue, ~${paybackYears.toFixed(1)}-yr payback, guaranteed buyer`;
  } else {
    advice = `${model.label} at $${model.ratePerKwh}/kWh — estimated ${paybackYears.toFixed(1)}-yr payback`;
  }

  return {
    tier:         TIER_LABEL[rating] || 'Below Target',
    advice,
    paybackYears: Math.round(paybackYears * 10) / 10,
    model,
  };
}

// ---------------------------------------------------------------------------
// Example usage (run with: node strategy_ranker.js)
// ---------------------------------------------------------------------------
if (require.main === module) {
  console.log('=== Wisconsin Solar Revenue Strategy Ranker ===\n');

  // 500 kW system in Lafayette County | $700,000 net after ITC + grants
  const ranked = compareUtilityStrategies({
    systemKw:        500,
    netCostAfterITC: 700_000,
    peakSunHrs:      4.90,   // Lafayette County
    hasTracker:      false,
    bifacial:        true,
  });

  console.log('System: 500 kW | Net cost after ITC: $700,000 | Lafayette County (4.90 sun hrs)\n');

  ranked.forEach((r, i) => {
    console.log(`#${i + 1} ${r.rating.padEnd(12)} ${r.model.label}`);
    console.log(`       Rate: $${r.model.ratePerKwh}/kWh | Annual revenue: $${r.annualRevenue.toLocaleString()} | Payback: ${r.paybackYears} yrs`);
    console.log(`       Kelly fraction: ${r.kellyFraction} | 25yr profit: $${r.lifetime25yrProfit.toLocaleString()}`);
    console.log(`       ${r.recommendation}`);
    console.log();
  });

  console.log(`Note: ${REVENUE_MODELS.alliant_net_metering.notes}`);
  console.log(`Note: ${REVENUE_MODELS.mge_retail_offset.notes}`);
}

module.exports = {
  rankStrategies,
  compareUtilityStrategies,
  rankLead,
  annualProduction,
  kellyFraction,
  paybackRating,
  REVENUE_MODELS,
  UTILITY_MODEL_MAP,
  PAYBACK_TARGET,
  WI_AVG_PEAK_SUN_HRS,
  PRIORITY_PEAK_SUN_HRS,
};
