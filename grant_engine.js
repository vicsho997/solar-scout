'use strict';

// ── Incentive constants (2026, Wisconsin) ────────────────────────────────────
const ITC_BASE_RATE          = 0.30;   // Federal ITC base rate (30%)
const ITC_DOMESTIC_BONUS     = 0.10;   // +10% for US-made panels/inverters
const ITC_ENERGY_COMM_BONUS  = 0.10;   // +10% if in an IRS-designated energy community

const WI_SALES_TAX_RATE      = 0.00;   // Solar equipment exempt (WI Stat. 77.54)
const WI_PROPERTY_TAX_EXEMPT = true;   // Solar improvements don't raise assessed value

// Focus on Energy 2026 tiered rate (Q1 2026 Newsletter)
const FOE_TIER1_RATE         = 600;    // $600/kW for first 4 kW
const FOE_TIER1_KW           = 4;      // kW boundary for tier 1
const FOE_TIER2_RATE         = 50;     // $50/kW for all remaining kW
const FOE_BUSINESS_CAP       = 25000;  // Maximum business rebate
const FOE_AG_BONUS           = 10000;  // Additional bonus for agricultural producers
const FOE_DEADLINE           = '2026-08-31';

const REAP_GRANT_MAX_PCT     = 0.25;   // USDA REAP: up to 25% of eligible costs
const MACRS_BONUS_PCT        = 0.40;   // 40% first-year bonus depreciation (2026)
const MACRS_YEARS            = 5;      // 5-year MACRS schedule for solar
const ASSUMED_TAX_RATE       = 0.25;   // Marginal federal rate for depreciation savings

// Rough split of total installed cost that is equipment (sales-tax-exempt)
const EQUIPMENT_COST_FRACTION = 0.65;
const WI_STD_SALES_TAX        = 0.05;  // Rate that would apply without exemption

// ---------------------------------------------------------------------------

// Internal helper: 2026 tiered FOE base rebate (before ag bonus and cap)
function calcFoeBase(systemKw) {
  const tier1 = Math.min(systemKw, FOE_TIER1_KW) * FOE_TIER1_RATE;
  const tier2 = Math.max(0, systemKw - FOE_TIER1_KW) * FOE_TIER2_RATE;
  return Math.min(tier1 + tier2, FOE_BUSINESS_CAP);
}

/**
 * Calculate the full Wisconsin incentive stack for a solar project.
 *
 * @param {object} params
 * @param {number}  params.totalInstalledCost  - Full project cost before incentives ($)
 * @param {number}  params.systemKw            - DC system size in kW
 * @param {boolean} [params.isAgricultural]    - Qualifies for Focus on Energy Ag bonus?
 * @param {boolean} [params.domesticContent]   - US-made panels/inverters? (+10% ITC)
 * @param {boolean} [params.isEnergyCommunity] - IRS energy community location? (+10% ITC)
 * @param {boolean} [params.reapAvailable]     - USDA REAP grant window open?
 * @returns {object} Full incentive breakdown with net cost and coverage percentage
 */
function calculateIncentives(params) {
  const {
    totalInstalledCost,
    systemKw,
    isAgricultural     = false,
    domesticContent    = false,
    isEnergyCommunity  = false,
    reapAvailable      = false,
  } = params;

  // ── 1. Federal Investment Tax Credit (ITC) ─────────────────────────────
  let itcRate = ITC_BASE_RATE;
  if (domesticContent)   itcRate += ITC_DOMESTIC_BONUS;
  if (isEnergyCommunity) itcRate += ITC_ENERGY_COMM_BONUS;
  const itcCredit = totalInstalledCost * itcRate;

  // ── 2. Focus on Energy (2026 tiered: $600/kW × first 4 kW, then $50/kW) ──
  const foeBase  = calcFoeBase(systemKw);
  const foeBonus = isAgricultural ? FOE_AG_BONUS : 0;
  const foeTotal = foeBase + foeBonus;

  // ── 3. USDA REAP Grant ─────────────────────────────────────────────────
  const reapGrant = reapAvailable
    ? totalInstalledCost * REAP_GRANT_MAX_PCT
    : 0;
  const reapNote = reapAvailable
    ? 'REAP grant included — verify open window with your local USDA Rural Development office'
    : 'REAP backlogged in 2026 — contact USDA RD; guaranteed loans still available';

  // ── 4. Wisconsin Sales Tax Exemption ──────────────────────────────────
  const equipmentCost   = totalInstalledCost * EQUIPMENT_COST_FRACTION;
  const salesTaxSavings = equipmentCost * WI_STD_SALES_TAX;

  // ── 5. MACRS Accelerated Depreciation (5-year schedule) ────────────────
  // IRS rule: depreciable basis is reduced by 50% of the ITC credit amount
  const depreciableBasis   = totalInstalledCost - (itcCredit * 0.50);
  const firstYearDeduction = depreciableBasis * MACRS_BONUS_PCT;
  const remainingBasis     = depreciableBasis - firstYearDeduction;
  const macrsTaxSavings    = (firstYearDeduction + remainingBasis) * ASSUMED_TAX_RATE;

  // ── Totals ─────────────────────────────────────────────────────────────
  const totalIncentives = itcCredit + foeTotal + reapGrant + salesTaxSavings + macrsTaxSavings;
  const netCost         = totalInstalledCost - totalIncentives;

  return {
    inputs: { totalInstalledCost, systemKw, isAgricultural, domesticContent, isEnergyCommunity, reapAvailable },

    federalITC: {
      rate:    `${(itcRate * 100).toFixed(0)}%`,
      credit:  Math.round(itcCredit),
      bonuses: {
        domesticContent:   domesticContent   ? '+10%' : 'not applied',
        isEnergyCommunity: isEnergyCommunity ? '+10%' : 'not applied',
      },
      applyVia: 'IRS Form 3468 — file with federal tax return in year system is placed in service',
    },

    focusOnEnergy: {
      businessRebate: Math.round(foeBase),
      agBonus:        Math.round(foeBonus),
      total:          Math.round(foeTotal),
      deadline:       FOE_DEADLINE,
      warning:        'Register with Focus on Energy BEFORE installation begins — required for rebate',
      applyAt:        'focusonenergy.com/business/renewables',
    },

    usdaReap: {
      grant:  Math.round(reapGrant),
      note:   reapNote,
    },

    wiSalesTaxExemption: {
      savings: Math.round(salesTaxSavings),
      rate:    '0% on solar equipment (WI Stat. 77.54) — saves ~5% on equipment costs',
    },

    wiPropertyTax: {
      exempt: WI_PROPERTY_TAX_EXEMPT,
      note:   'Solar improvements do not increase assessed property value in Wisconsin',
    },

    macrsDepreciation: {
      depreciableBasis:   Math.round(depreciableBasis),
      firstYearBonus:     `${MACRS_BONUS_PCT * 100}% (2026 rate — confirm with CPA)`,
      firstYearDeduction: Math.round(firstYearDeduction),
      totalTaxSavings:    Math.round(macrsTaxSavings),
      assumedTaxRate:     `${ASSUMED_TAX_RATE * 100}%`,
      applyVia:           'IRS Form 4562 — work with a CPA experienced in renewable energy',
    },

    summary: {
      totalIncentives:    Math.round(totalIncentives),
      netCost:            Math.round(netCost),
      coveragePct:        `${Math.round((totalIncentives / totalInstalledCost) * 100)}%`,
      effectiveCostPct:   `${Math.round((netCost / totalInstalledCost) * 100)}%`,
    },
  };
}

/**
 * Quick helper: Focus on Energy rebate for a given system size.
 */
function foeRebate(systemKw, isAgricultural = false) {
  const base  = calcFoeBase(systemKw);
  const bonus = isAgricultural ? FOE_AG_BONUS : 0;
  return { base, bonus, total: base + bonus, deadline: FOE_DEADLINE };
}

/**
 * Quick helper: Federal ITC credit amount.
 */
function itcCredit(totalCost, domesticContent = false, isEnergyCommunity = false) {
  let rate = ITC_BASE_RATE;
  if (domesticContent)   rate += ITC_DOMESTIC_BONUS;
  if (isEnergyCommunity) rate += ITC_ENERGY_COMM_BONUS;
  return { rate: `${rate * 100}%`, credit: Math.round(totalCost * rate) };
}

/**
 * Estimate net capital required after the 30% ITC and Focus on Energy rebate.
 * Uses guide cost-per-watt midpoints — get contractor bids for precision.
 *
 * @param {number}  systemKw        - DC system size in kW
 * @param {boolean} [isAgricultural] - Apply Focus on Energy Ag bonus?
 * @returns {number} Estimated net cost after incentives ($)
 */
function calculateNetCost(systemKw, isAgricultural = false) {
  // Mid-point installed cost per watt — 2026 Midwest guide ranges
  let costPerW;
  if      (systemKw <= 100)  costPerW = 3.30;
  else if (systemKw <= 250)  costPerW = 2.65;
  else if (systemKw <= 500)  costPerW = 2.40;
  else if (systemKw <= 1000) costPerW = 2.10;
  else                       costPerW = 1.90;

  const totalCost  = systemKw * 1000 * costPerW;
  const itcSavings = totalCost * ITC_BASE_RATE;
  const foeSavings = calcFoeBase(systemKw) + (isAgricultural ? FOE_AG_BONUS : 0);

  return Math.round(totalCost - itcSavings - foeSavings);
}

/**
 * 2026 Live Edition entry point.
 * Source: Focus on Energy Q1 2026 Newsletter & USDA RD Wisconsin.
 *
 * Returns the Focus on Energy rebate (tiered 2026 rate + ag bonus),
 * ITC rate, and a USDA REAP status warning — suitable for quick lead checks.
 *
 * @param {number}  kw             - DC system size in kW
 * @param {boolean} [isAgricultural] - Include the $10,000 ag bonus?
 * @returns {object} Rebate summary with status and warning
 */
function calculate2026Rebates(kw, isAgricultural = true) {
  const foeBase  = calcFoeBase(kw);
  const agBonus  = isAgricultural ? FOE_AG_BONUS : 0;
  return {
    focusOnEnergy: foeBase + agBonus,
    itcValue:      ITC_BASE_RATE,
    status:        'LIVE_MAY_2026',
    warning:       'USDA REAP: 2026 guidance disincentivizes solar on productive cropland — non-ag land preferred',
  };
}

// ---------------------------------------------------------------------------
// Example usage (run with: node grant_engine.js)
// ---------------------------------------------------------------------------
if (require.main === module) {
  const result = calculateIncentives({
    totalInstalledCost: 1_000_000,
    systemKw:           500,
    isAgricultural:     true,
    domesticContent:    false,
    isEnergyCommunity:  false,
    reapAvailable:      false,
  });

  console.log('=== Wisconsin Grant & Incentive Calculator ===\n');
  console.log('Project: 500 kW | $1,000,000 installed | Agricultural producer\n');

  console.log(`Federal ITC (${result.federalITC.rate}):        $${result.federalITC.credit.toLocaleString()}`);
  console.log(`Focus on Energy (total):        $${result.focusOnEnergy.total.toLocaleString()}  (deadline: ${result.focusOnEnergy.deadline})`);
  console.log(`USDA REAP grant:                $${result.usdaReap.grant.toLocaleString()}  — ${result.usdaReap.note}`);
  console.log(`WI Sales Tax Savings:           $${result.wiSalesTaxExemption.savings.toLocaleString()}`);
  console.log(`MACRS Tax Savings (5yr):        $${result.macrsDepreciation.totalTaxSavings.toLocaleString()}`);
  console.log('─────────────────────────────────────────────');
  console.log(`Total Incentives:               $${result.summary.totalIncentives.toLocaleString()}  (${result.summary.coveragePct} of project cost)`);
  console.log(`Net Cost After Incentives:      $${result.summary.netCost.toLocaleString()}  (${result.summary.effectiveCostPct} of project cost)`);
  console.log();
  console.log(`⚠  ${result.focusOnEnergy.warning}`);
}

module.exports = { calculateIncentives, calculateNetCost, calculate2026Rebates, foeRebate, itcCredit, ITC_BASE_RATE, FOE_BUSINESS_CAP, FOE_AG_BONUS };
