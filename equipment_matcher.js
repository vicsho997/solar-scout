'use strict';

// ── Panel catalog (N-Type bifacial recommended for Wisconsin ground mount) ──
const PANEL_CATALOG = [
  {
    id:            'jinko-tiger-neo-605',
    model:         'JinkoSolar Tiger Neo 605W',
    wattage:       605,
    efficiency:    0.2369,
    type:          'N-Type Mono Bifacial',
    pricePerWatt:  0.26,
    bifacial:      true,
    // 5–15% rear-side gain from snow reflection in WI winters
    bifacialGain:  { min: 0.05, max: 0.15 },
    tier:          'TOP PICK',
    bestFor:       'Best all-around WI ground mount',
    certifications: ['IEC 61215', 'IEC 61730', 'UL 1703'],
  },
  {
    id:            'trina-vertex-s-605',
    model:         'Trinasolar Vertex S+ 605W',
    wattage:       605,
    efficiency:    0.2370,
    type:          'N-Type Mono Bifacial',
    pricePerWatt:  0.27,
    bifacial:      true,
    bifacialGain:  { min: 0.05, max: 0.15 },
    tier:          'PREMIUM',
    bestFor:       'Excellent warranty, proven reliability',
    certifications: ['IEC 61215', 'IEC 61730'],
  },
  {
    id:            'risen-hjt-740',
    model:         'Risen Energy HJT 740W',
    wattage:       740,
    efficiency:    0.2380,
    type:          'HJT Bifacial',
    pricePerWatt:  0.32,
    bifacial:      true,
    bifacialGain:  { min: 0.06, max: 0.15 }, // HJT has stronger low-light / cold response
    tier:          'HIGH-EFFICIENCY',
    bestFor:       'Highest efficiency, cold climate bonus',
    certifications: ['IEC 61215', 'IEC 61730'],
  },
  {
    id:            'longi-hi-mo7-610',
    model:         'LONGi Hi-MO 7 610W',
    wattage:       610,
    efficiency:    0.2350,
    type:          'N-Type Mono Bifacial',
    pricePerWatt:  0.25,
    bifacial:      true,
    bifacialGain:  { min: 0.05, max: 0.12 },
    tier:          'BUDGET',
    bestFor:       'Budget-conscious, strong brand',
    certifications: ['IEC 61215', 'IEC 61730'],
  },
];

// ── Inverter catalog ────────────────────────────────────────────────────────
const INVERTER_CATALOG = [
  {
    id:           'sma-sunny-tripower-core2',
    model:        'SMA Sunny Tripower CORE2 110kW',
    type:         'String',
    capacityKw:   110,
    efficiency:   0.986,
    maxSystemMw:  1.0,   // Guide recommendation: string inverters for sub-1MW
    tier:         'TOP PICK',
    bestFor:      '100kW–1MW systems, reliable, proven',
    certifications: ['IEEE 1547', 'UL 1741', 'UL 1741-SA'],
    features:     ['No single point of failure', 'Shade-tolerant string configuration', 'Remote monitoring'],
  },
  {
    id:           'solaredge-commercial-hd',
    model:        'SolarEdge Commercial HD-Wave 82.8kW',
    type:         'String + Optimizer',
    capacityKw:   82.8,
    efficiency:   0.990,
    maxSystemMw:  0.5,
    tier:         'OPTIMIZER',
    bestFor:      'Sites with partial shading; module-level monitoring',
    certifications: ['IEEE 1547', 'UL 1741'],
    features:     ['Per-module power optimization', 'Module-level monitoring', 'Rapid shutdown'],
  },
  {
    id:           'growatt-max-320',
    model:        'Growatt MAX 320KTL3-X',
    type:         'String',
    capacityKw:   320,
    efficiency:   0.9903,
    maxSystemMw:  2.0,
    tier:         'BUDGET-LARGE',
    bestFor:      'Large systems (1–2 MW), budget option',
    certifications: ['IEC 62109', 'UL 1741'],
    features:     ['High DC voltage input', 'Multi-string configuration'],
  },
  {
    id:           'abb-fimer-pvs300',
    model:        'ABB/Fimer PVS-300',
    type:         'Central',
    capacityKw:   300,
    efficiency:   0.987,
    maxSystemMw:  5.0,
    tier:         'CENTRAL',
    bestFor:      '1MW+ farms, lower cost per kW',
    certifications: ['IEC 62109', 'UL 1741'],
    features:     ['Single central unit', 'Lower $/kW at scale', 'Single point of failure — plan redundancy'],
  },
];

// DC/AC oversize ratio — industry standard for WI ground-mount
const DC_AC_RATIO = 1.15;

// ---------------------------------------------------------------------------

/**
 * Select the optimal panel for a system.
 *
 * @param {object} opts
 * @param {number}  opts.systemKw    - Total DC system size in kW
 * @param {string}  [opts.priority]  - 'performance' | 'budget' | 'balanced' (default)
 * @param {boolean} [opts.snowEnv]   - Wisconsin winter environment — prioritize bifacial (default true)
 * @returns {object} Recommended panel with count, cost estimate, and bifacial bonus note
 */
function selectPanel({ systemKw, priority = 'balanced', snowEnv = true }) {
  const candidates = PANEL_CATALOG.filter(p => (snowEnv ? p.bifacial : true));

  let panel;
  if (priority === 'budget') {
    panel = candidates.reduce((best, p) => (p.pricePerWatt < best.pricePerWatt ? p : best));
  } else if (priority === 'performance') {
    panel = candidates.reduce((best, p) => (p.efficiency > best.efficiency ? p : best));
  } else {
    panel = candidates.find(p => p.tier === 'TOP PICK') || candidates[0];
  }

  const panelCount        = Math.ceil((systemKw * 1000) / panel.wattage);
  const estimatedCost     = Math.round(systemKw * 1000 * panel.pricePerWatt);
  const bifacialBonusLow  = snowEnv ? panel.bifacialGain.min  : 0;
  const bifacialBonusHigh = snowEnv ? panel.bifacialGain.max  : 0;

  return {
    panel,
    panelCount,
    estimatedPanelCost: estimatedCost,
    winterBifacialBonus: {
      low:  `${bifacialBonusLow  * 100}%`,
      high: `${bifacialBonusHigh * 100}%`,
    },
    note: snowEnv
      ? `Bifacial rear-side gains of ${bifacialBonusLow * 100}–${bifacialBonusHigh * 100}% expected in WI winters from snow reflection`
      : 'Standard front-side production only — bifacial bonus not applied',
  };
}

/**
 * Select the optimal inverter for a system.
 *
 * Guide rule: use string inverters for sub-1MW for reliability (no single point of failure).
 *
 * @param {number} systemKw - DC system size in kW
 * @returns {object} Recommended inverter with unit count and wiring note
 */
function selectInverter(systemKw) {
  const systemMw = systemKw / 1000;

  let inverter;
  if (systemMw <= 1.0) {
    // SMA Sunny Tripower CORE2 — top pick for sub-1MW string reliability
    inverter = INVERTER_CATALOG.find(i => i.id === 'sma-sunny-tripower-core2');
  } else if (systemMw <= 2.0) {
    inverter = INVERTER_CATALOG.find(i => i.id === 'growatt-max-320');
  } else {
    inverter = INVERTER_CATALOG.find(i => i.id === 'abb-fimer-pvs300');
  }

  const requiredAcKw = systemKw / DC_AC_RATIO;
  const unitCount    = Math.ceil(requiredAcKw / inverter.capacityKw);

  return {
    inverter,
    unitCount,
    dcAcRatio:    DC_AC_RATIO,
    requiredAcKw: Math.round(requiredAcKw),
    reliabilityNote: systemMw <= 1.0
      ? 'String inverters chosen: no single point of failure — ideal for sub-1MW per guide recommendation'
      : 'Multiple units provide redundancy — one unit offline does not halt the full farm',
  };
}

/**
 * Recommend a racking system based on system size.
 */
function selectRacking(systemKw) {
  if (systemKw >= 1000) {
    return {
      type:       'Single-Axis Tracker (SAT)',
      outputGain: '+20–30% more annual energy vs. fixed tilt',
      costPremium: '+$0.10–$0.20/W over fixed tilt',
      brands:     ['Nextracker NX Horizon', 'Array Technologies DPR', 'GameChange Solar'],
      note:       'Recommended for 1MW+ where ROI justifies the cost premium',
    };
  }
  return {
    type:       'Fixed-Tilt Ground Mount',
    outputGain: 'Baseline — most cost-effective option',
    costPremium: 'Base cost',
    brands:     ['Iron Ridge', 'Unirac'],
    note:       'Most common choice for systems under 1MW; lower upfront cost',
  };
}

/**
 * Build a complete matched equipment package for a system.
 *
 * @param {object} params
 * @param {number}  params.systemKw
 * @param {string}  [params.panelPriority] - 'performance' | 'budget' | 'balanced'
 * @param {boolean} [params.snowEnv]       - Wisconsin winter environment (default true)
 * @returns {object} Full equipment package: panels, inverter, racking, and certifications
 */
function matchEquipment({ systemKw, panelPriority = 'balanced', snowEnv = true }) {
  return {
    systemKw,
    panels:   selectPanel({ systemKw, priority: panelPriority, snowEnv }),
    inverter: selectInverter(systemKw),
    racking:  selectRacking(systemKw),
    wiRequirements: {
      inverterCertification: 'IEEE 1547 + UL 1741 — required by all WI utilities',
      panelCertification:    'IEC 61215 + IEC 61730',
      antiIslanding:         'Automatic disconnect when grid goes down — protects utility lineworkers',
      pto:                   'Equipment must pass all inspections before Permission to Operate (PTO) is granted',
    },
  };
}

/**
 * Return a simplified standard equipment kit for a given system size.
 * Thin wrapper around matchEquipment() with WI-optimised defaults.
 *
 * @param {number} systemKw - DC system size in kW
 * @returns {object} Flat kit summary: panelCount, models, inverter count, racking type
 */
function getStandardKit(systemKw, hasTracker = false) {
  const pkg = matchEquipment({ systemKw, panelPriority: 'balanced', snowEnv: true });
  const racking = hasTracker
    ? { type: 'Single-Axis Tracker (SAT)', outputGain: '+20–30%', note: 'Tracker override active' }
    : pkg.racking;
  return {
    panelModel:          pkg.panels.panel.model,
    panelCount:          pkg.panels.panelCount,
    inverterModel:       pkg.inverter.inverter.model,
    inverterCount:       pkg.inverter.unitCount,
    rackingType:         racking.type,
    rackingOutputGain:   racking.outputGain,
    estimatedPanelCost:  pkg.panels.estimatedPanelCost,
    winterBifacialBonus: pkg.panels.winterBifacialBonus,
  };
}

// ---------------------------------------------------------------------------
// Example usage (run with: node equipment_matcher.js)
// ---------------------------------------------------------------------------
if (require.main === module) {
  console.log('=== Equipment Matcher — 500 kW WI Ground-Mount System ===\n');
  const pkg = matchEquipment({ systemKw: 500, panelPriority: 'balanced', snowEnv: true });

  const p = pkg.panels;
  console.log(`Panels:   ${p.panel.model} (${p.panel.tier})`);
  console.log(`          ${p.panelCount} panels @ $${p.panel.pricePerWatt}/W = $${p.estimatedPanelCost.toLocaleString()}`);
  console.log(`          Winter bifacial bonus: ${p.winterBifacialBonus.low} – ${p.winterBifacialBonus.high}`);

  const inv = pkg.inverter;
  console.log(`\nInverter: ${inv.inverter.model} (${inv.inverter.tier})`);
  console.log(`          ${inv.unitCount} units | DC/AC ratio: ${inv.dcAcRatio} | AC output: ${inv.requiredAcKw} kW`);
  console.log(`          ${inv.reliabilityNote}`);

  const r = pkg.racking;
  console.log(`\nRacking:  ${r.type}`);
  console.log(`          Output gain: ${r.outputGain}`);
  console.log(`          ${r.note}`);

  console.log(`\nWI Certifications:`);
  console.log(`  Inverter: ${pkg.wiRequirements.inverterCertification}`);
  console.log(`  Panels:   ${pkg.wiRequirements.panelCertification}`);
}

module.exports = { matchEquipment, selectPanel, selectInverter, selectRacking, getStandardKit, PANEL_CATALOG, INVERTER_CATALOG };
