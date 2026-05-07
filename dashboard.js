/**
 * SOLAR SCOUT COMMAND CENTER (dashboard.js)
 * Data Freshness: May 2026
 */

const land = require('./land_scouter');
const grants = require('./grant_engine');
const equipment = require('./equipment_matcher');
const strategy = require('./strategy_ranker');

const VALID_COUNTIES  = land.COUNTY_SUN_DATA.map(c => c.name);
const VALID_UTILITIES = Object.keys(strategy.UTILITY_MODEL_MAP);

const [,, argCounty, argUtility, argSize, argTracker] = process.argv;

if (argCounty && !VALID_COUNTIES.includes(argCounty)) {
    console.error(`Unknown county "${argCounty}". Valid options:\n  ${VALID_COUNTIES.join(', ')}`);
    process.exit(1);
}
if (argUtility && !VALID_UTILITIES.includes(argUtility)) {
    console.error(`Unknown utility "${argUtility}". Valid options:\n  ${VALID_UTILITIES.join('\n  ')}`);
    process.exit(1);
}
if (argSize !== undefined && (isNaN(Number(argSize)) || Number(argSize) <= 0)) {
    console.error(`Invalid size "${argSize}". Must be a positive number in kW (e.g. 100, 500, 1000).`);
    process.exit(1);
}
if (argTracker !== undefined && argTracker !== 'tracker') {
    console.error(`Invalid tracker value "${argTracker}". Pass "tracker" to enable, or omit for fixed-tilt.`);
    process.exit(1);
}

const DASHBOARD_CONFIG = {
    unitId:     "Unit 01 Pilot",
    sizeKW:     argSize   ? Number(argSize) : 250,
    county:     argCounty  || "Dane",
    utility:    argUtility || "Madison Gas & Electric",
    hasTracker: argTracker === 'tracker',
};

function displayDataVitalSigns() {
    console.log("====================================================");
    console.log("📡 DATA VITAL SIGNS: FRESHNESS REPORT");
    console.log("====================================================");

    // Grant Freshness
    console.log("💰 GRANTS: Focus on Energy 2026 (Updated April 2026)");
    console.log("   - WARNING: USDA REAP Grants halted as of March 31, 2026.");
    console.log("   - STATUS: Focus on Energy apps close Aug 31, 2026.");

    // Equipment Freshness
    console.log("\n🔧 EQUIPMENT: 2026 Midwest Market Standards");
    console.log("   - Specs: Jinko Tiger Neo / SMA Tripower benchmarks verified Q2 2026.");

    // Grid Freshness
    console.log("\n🔌 GRID: 2026/2027 Rate Case Settlements");
    console.log("   - Includes: New Alliant 2026 base rate adjustments.");
    console.log("   - Includes: Updated We Energies solar export credits ($0.03636).");
    console.log("====================================================\n");
}

function runPilotAssessment() {
    displayDataVitalSigns();

    console.log(`🚀 RUNNING ASSESSMENT: ${DASHBOARD_CONFIG.unitId}`);

    const landScore = land.getScore(DASHBOARD_CONFIG.county);
    const netCost = grants.calculateNetCost(DASHBOARD_CONFIG.sizeKW);
    const rebates2026 = grants.calculate2026Rebates(DASHBOARD_CONFIG.sizeKW);
    const hardware = equipment.getStandardKit(DASHBOARD_CONFIG.sizeKW, DASHBOARD_CONFIG.hasTracker);
    const revenueRank = strategy.rankLead(DASHBOARD_CONFIG.utility, DASHBOARD_CONFIG.sizeKW, DASHBOARD_CONFIG.hasTracker);

    console.log(`\n📍 SITE: ${DASHBOARD_CONFIG.county} County`);
    console.log(`   - Score: ${landScore}/100 (Priority Lead)`);

    console.log(`\n💸 FINANCIALS: ${DASHBOARD_CONFIG.sizeKW} kW System`);
    console.log(`   - FOE Rebate (${rebates2026.status}): $${rebates2026.focusOnEnergy.toLocaleString()}`);
    console.log(`   - Estimated Net Capital: $${netCost.toLocaleString()} (After 30% ITC + FOE)`);

    console.log(`\n📦 HARDWARE:`);
    console.log(`   - Panels:  ${hardware.panelCount}x Bifacial N-Type (Snow Bonus Ready)`);
    console.log(`   - Racking: ${hardware.rackingType} (${hardware.rackingOutputGain})`);

    console.log(`\n🏆 STRATEGY:`);
    console.log(`   - Tier: ${revenueRank.tier} (Goal: 10-15 year payback)`);
    console.log(`   - Strategy: ${revenueRank.advice}`);
    console.log("====================================================");
}

runPilotAssessment();
