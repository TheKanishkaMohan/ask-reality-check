import { describe, expect, it } from 'vitest';
import {
  ASSUMPTION_REFERENCES,
  DEFAULT_FX_INR_PER_USD,
  DEFAULT_VERDICT_BANDS,
  LABELS,
  PRESET_SCENARIOS,
  SECTOR_MULTIPLE_BENCHMARKS,
  computeAskDilutionHeatmap,
  computeFeasibleAskBand,
  computeOwnershipWaterfall,
  convertUnitScale,
  evaluateAsk,
  formatMoney,
  formatMonthlyMoney,
  fromCr,
  solveGoalSeek,
  toCr,
  validateInput,
  type CheckInput,
} from '../src/engine';
import { generateMarkdownSummary } from '../src/ui/export';
import { buildQueryString } from '../src/ui/state';
import { buildXlsxFilename, generateXlsxBytes } from '../src/ui/xlsx';

function makeInput(overrides: Partial<CheckInput> = {}): CheckInput {
  return {
    ask: 20,
    dilutionPct: 20,
    annualRevenue: 12,
    priorRaise: 0,
    priorRaiseWasPriced: true,
    stepUpMultiple: 2,
    nextRoundMultiple: 7,
    monthsToNextRound: 18,
    cashNeeded: 0,
    monthlyBurn: 0,
    esopTopUpPct: 0,
    verdictBands: { ...DEFAULT_VERDICT_BANDS },
    ...overrides,
  };
}

describe('Valuation Check Engine — Defaults & Same-Company Scenarios (₹20 / ₹30 / ₹50 Cr)', () => {
  it('Default Preset A (₹20 Cr ask on ₹1 Cr/mo = ₹12 Cr ARR) lands in Conservative (~78%/yr)', () => {
    const presetA = PRESET_SCENARIOS.find((p) => p.id === 'a')!;
    const out = evaluateAsk(presetA.input, 'INR_CR');

    expect(out.validation.valid).toBe(true);
    expect(out.metrics.impliedPostMoney.value).toBeCloseTo(100, 5);
    expect(out.metrics.impliedPreMoney.value).toBeCloseTo(80, 5);
    expect(out.metrics.nextRoundPreMoney.value).toBeCloseTo(200, 5);
    expect(out.metrics.requiredNextAnnualRevenue.value).toBeCloseTo(200 / 7, 4);
    expect(out.metrics.requiredGrowthMultiple.value).toBeCloseTo(200 / 7 / 12, 4);
    expect(out.metrics.impliedCagrPct.value).toBeCloseTo(78.4, 0);
    expect(out.verdict.level).toBe('reachable');
    expect(out.verdict.headline).toBe(
      'Needs 2.4x revenue in 18 months to justify this price.'
    );
  });

  it('Same-company samples (₹20 / ₹30 / ₹50 Cr) span Conservative, Stretch, and Aggressive', () => {
    const [a, b, c] = PRESET_SCENARIOS;
    expect(a && b && c).toBeDefined();
    expect(a!.input.annualRevenue).toBe(12);
    expect(b!.input.annualRevenue).toBe(12);
    expect(c!.input.annualRevenue).toBe(12);

    const outA = evaluateAsk(a!.input, 'INR_CR');
    const outB = evaluateAsk(b!.input, 'INR_CR');
    const outC = evaluateAsk(c!.input, 'INR_CR');

    expect(outA.verdict.level).toBe('reachable');
    expect(outB.verdict.level).toBe('stretch');
    expect(outC.verdict.level).toBe('stiff');

    expect(outB.metrics.impliedPostMoney.value).toBeCloseTo(150, 5);
    expect(outB.metrics.impliedCagrPct.value).toBeCloseTo(133.8, 0);

    expect(outC.metrics.impliedPostMoney.value).toBeCloseTo(250, 5);
    expect(outC.metrics.impliedCagrPct.value).toBeCloseTo(228.44, 1);

    const row20 = outC.sensitivity.find((r) => r.dilutionPct === 20)!;
    const row25 = outC.sensitivity.find((r) => r.dilutionPct === 25)!;
    const row33 = outC.sensitivity.find((r) => r.dilutionPct === 33)!;
    expect(row20.postMoney).toBeCloseTo(250, 5);
    expect(row25.postMoney).toBeCloseTo(200, 5);
    expect(row33.postMoney).toBeGreaterThanOrEqual(150);
    expect(row33.postMoney).toBeLessThanOrEqual(152);
  });
});

describe('Valuation Check Engine — Validation, Burn Plan, ESOP & Pre-Revenue Pointer', () => {
  it('handles ARR = 0 with Pre-revenue badge and DeepTech Round Planner pointer', () => {
    const out = evaluateAsk(makeInput({ annualRevenue: 0 }), 'INR_CR');
    expect(out.validation.valid).toBe(true);
    expect(out.verdict.level).toBe('incomplete');
    expect(out.verdict.headline).toBe(LABELS.preRevenueHeadline);
    expect(out.metrics.impliedPostMoney.value).toBe(100);
    expect(out.metrics.impliedPostRevenueMultiple.value).toBeNull();
    expect(out.metrics.requiredGrowthMultiple.value).toBeNull();
    expect(out.metrics.impliedCagrPct.value).toBeNull();
    expect(out.metrics.impliedPostRevenueMultiple.formattedValue).toBe('Pre-revenue');
    const missingRevReason = out.verdict.reasons.find((r) => r.id === 'missing_revenue');
    expect(missingRevReason?.text).toContain('DeepTech Round Planner coming soon');
  });

  it('rejects invalid dilution, months, ask, multiple, and negative monthlyBurn cleanly', () => {
    expect(evaluateAsk(makeInput({ dilutionPct: 0 })).validation.valid).toBe(false);
    expect(evaluateAsk(makeInput({ dilutionPct: -10 })).validation.valid).toBe(false);
    expect(evaluateAsk(makeInput({ dilutionPct: 100 })).validation.valid).toBe(false);
    expect(evaluateAsk(makeInput({ dilutionPct: 120 })).validation.valid).toBe(false);
    expect(evaluateAsk(makeInput({ monthsToNextRound: 0 })).validation.valid).toBe(false);
    expect(evaluateAsk(makeInput({ ask: 0 })).validation.valid).toBe(false);
    expect(evaluateAsk(makeInput({ nextRoundMultiple: 0 })).validation.valid).toBe(false);
    expect(evaluateAsk(makeInput({ monthlyBurn: -1 })).validation.valid).toBe(false);
  });

  it('rejects dilution + ESOP >= 100% and lowers effective pre-money cleanly without altering R2 target', () => {
    const invalidEsop = validateInput(makeInput({ dilutionPct: 80, esopTopUpPct: 25 }));
    expect(invalidEsop.valid).toBe(false);
    expect(invalidEsop.errors.some((e) => e.field === 'esopAndDilution')).toBe(true);

    // 20% dilution + 10% ESOP on ₹20 Cr ask: ₹100 Cr post, ₹80 Cr pre -> ₹70 Cr effective pre; R2 still ₹200 Cr
    const validEsop = evaluateAsk(makeInput({ ask: 20, dilutionPct: 20, esopTopUpPct: 10 }));
    expect(validEsop.validation.valid).toBe(true);
    expect(validEsop.metrics.impliedPostMoney.value).toBeCloseTo(100, 5);
    expect(validEsop.metrics.impliedPreMoney.value).toBeCloseTo(80, 5);
    expect(validEsop.metrics.effectivePreMoneyAfterEsop.value).toBeCloseTo(70, 5);
    expect(validEsop.metrics.nextRoundPreMoney.value).toBeCloseTo(200, 5);
  });

  it('distinguishes unset, priced, and unpriced prior R0 raises', () => {
    const noPrior = evaluateAsk(makeInput({ priorRaise: 0 }));
    expect(noPrior.metrics.askToPriorRaiseMultiple.value).toBeNull();
    expect(noPrior.verdict.reasons.some((r) => r.id.startsWith('prior_raise'))).toBe(false);

    const pricedHigh = evaluateAsk(
      makeInput({ ask: 50, priorRaise: 5, priorRaiseWasPriced: true })
    );
    expect(pricedHigh.metrics.askToPriorRaiseMultiple.value).toBeCloseTo(10, 5);
    expect(pricedHigh.verdict.reasons.some((r) => r.id === 'prior_raise_high')).toBe(true);

    const unpriced = evaluateAsk(
      makeInput({ ask: 50, priorRaise: 5, priorRaiseWasPriced: false })
    );
    expect(unpriced.verdict.reasons.some((r) => r.id === 'prior_raise_high')).toBe(false);
    expect(unpriced.verdict.reasons.some((r) => r.id === 'prior_raise_unpriced')).toBe(true);
  });

  it('computes cash need from optional monthly net burn × months and hides when unset', () => {
    const unset = evaluateAsk(makeInput({ ask: 20, monthlyBurn: 0, cashNeeded: 0 }));
    expect(unset.metrics.fundingGap.formattedValue).toBe('Not set');
    expect(unset.verdict.reasons.some((r) => r.id.startsWith('funding_'))).toBe(false);

    // 2 Cr/mo × 18 mo = 36 Cr needed vs 20 Cr ask -> 16 Cr shortfall
    const shortfall = evaluateAsk(
      makeInput({ ask: 20, monthlyBurn: 2, monthsToNextRound: 18 })
    );
    expect(shortfall.metrics.fundingGap.value).toBeCloseTo(16, 5);
    expect(shortfall.verdict.reasons.some((r) => r.id === 'funding_shortfall')).toBe(true);

    // 1 Cr/mo × 18 mo = 18 Cr needed vs 25 Cr ask -> None shortfall, buffer reason
    const buffer = evaluateAsk(
      makeInput({ ask: 25, monthlyBurn: 1, monthsToNextRound: 18 })
    );
    expect(buffer.metrics.fundingGap.value).toBe(0);
    expect(buffer.metrics.fundingGap.formattedValue).toBe('None');
    expect(buffer.verdict.reasons.some((r) => r.id === 'funding_buffer')).toBe(true);
  });

  it('includes custom user dilution and step-down rows', () => {
    const dil12 = evaluateAsk(makeInput({ dilutionPct: 12 }));
    expect(dil12.sensitivity.map((r) => r.dilutionPct)).toEqual([5, 12, 20, 25, 33]);
    expect(dil12.sensitivity.find((r) => r.dilutionPct === 12)?.isUserSelected).toBe(true);

    const dil20 = evaluateAsk(makeInput({ dilutionPct: 20 }));
    expect(dil20.sensitivity.map((r) => r.dilutionPct)).toEqual([15, 20, 25, 33]);
  });
});

describe('Canonical Unit Handling (INR Cr internal), FX Conversion & Lossless Round-Trips', () => {
  it('converts losslessly across INR_CR -> USD_M -> INR_LAKH -> INR_CR with default and custom FX', () => {
    const originalCr = 20;
    const usdM = fromCr(originalCr, 'USD_M', DEFAULT_FX_INR_PER_USD);
    expect(usdM).toBeCloseTo(20 / 8.5, 10);

    const backFromUsd = toCr(usdM, 'USD_M', DEFAULT_FX_INR_PER_USD);
    expect(backFromUsd).toBeCloseTo(originalCr, 12);

    const lakhs = fromCr(backFromUsd, 'INR_LAKH', DEFAULT_FX_INR_PER_USD);
    expect(lakhs).toBeCloseTo(2000, 12);

    const backToCr = toCr(lakhs, 'INR_LAKH', DEFAULT_FX_INR_PER_USD);
    expect(backToCr).toBeCloseTo(originalCr, 12);

    // Custom FX ₹90/USD: ₹18 Cr = $2.0M
    expect(fromCr(18, 'USD_M', 90)).toBeCloseTo(2.0, 12);
    expect(toCr(2.0, 'USD_M', 90)).toBeCloseTo(18, 12);
    expect(convertUnitScale(0.75, 'INR_CR', 'INR_LAKH')).toBe(75);
    expect(convertUnitScale(75, 'INR_LAKH', 'INR_CR')).toBe(0.75);
  });

  it('formats canonical ₹ Cr outputs consistently across INR_CR, INR_LAKH, and USD_M', () => {
    expect(formatMoney(20, 'INR_CR')).toBe('₹20 Cr');
    expect(formatMoney(20, 'INR_LAKH')).toBe('₹2,000 Lakh');
    expect(formatMoney(20, 'USD_M', 2, 85)).toBe('$2.35M');
    expect(formatMoney(20, 'USD_M', 2, 90)).toBe('$2.22M');
    expect(formatMonthlyMoney(1, 'INR_CR')).toBe('₹1 Cr/mo');
    expect(formatMonthlyMoney(0.75, 'INR_CR')).toContain('₹75 Lakh/mo');
    expect(formatMonthlyMoney(1, 'USD_M', 85)).toContain('$118K/mo');

    // Evaluating canonical input in USD_M produces real $M valuations, not relabelled Cr
    const outUsd = evaluateAsk(makeInput({ ask: 20, dilutionPct: 20 }), 'USD_M', 85);
    expect(outUsd.metrics.impliedPostMoney.value).toBeCloseTo(100, 5);
    expect(outUsd.metrics.impliedPostMoney.formattedValue).toBe('$11.8M');
  });
});

describe('Goal-Seek Solver — Round-Trips', () => {
  it('solves for max_ask, required_revenue, and required_dilution accurately', () => {
    const baseInput = makeInput({
      ask: 50,
      dilutionPct: 20,
      annualRevenue: 9,
      nextRoundMultiple: 7,
    });
    const seekAsk = solveGoalSeek(baseInput, 'max_ask', 3.0, 'INR_CR');
    expect(seekAsk.isFeasible).toBe(true);
    expect(seekAsk.solvedValue).toBeCloseTo(18.9, 5);
    expect(
      evaluateAsk({ ...baseInput, ask: seekAsk.solvedValue! }).metrics.requiredGrowthMultiple.value
    ).toBeCloseTo(3.0, 5);

    const seekRev = solveGoalSeek(baseInput, 'required_revenue', 3.0, 'INR_CR');
    expect(seekRev.isFeasible).toBe(true);
    expect(seekRev.solvedValue).toBeCloseTo(500 / 21, 4);

    const seekDil = solveGoalSeek(
      makeInput({ ask: 30, dilutionPct: 20, annualRevenue: 12, nextRoundMultiple: 6 }),
      'required_dilution',
      3.0,
      'INR_CR'
    );
    expect(seekDil.isFeasible).toBe(true);
    expect(seekDil.solvedValue).toBeCloseTo((30 / 108) * 100, 4);

    const infeasible = solveGoalSeek(
      makeInput({ ask: 150, dilutionPct: 20, annualRevenue: 12, nextRoundMultiple: 6 }),
      'required_dilution',
      3.0,
      'INR_CR'
    );
    expect(infeasible.isFeasible).toBe(false);
    expect(infeasible.solvedValue).toBeGreaterThan(100);
  });
});

describe('Share & Export — Markdown Summary, XLSX Workbook & URL State Serialization', () => {
  it('generates unit-consistent Markdown summary with Pricing check & Rule of thumb tags', () => {
    const presetA = PRESET_SCENARIOS.find((p) => p.id === 'a')!;
    const md = generateMarkdownSummary(
      { ...presetA.input, monthlyBurn: 2 },
      'INR_CR',
      'max_ask',
      3.0,
      DEFAULT_FX_INR_PER_USD
    );

    expect(md).toContain('# Valuation Check: Summary (₹ Cr)');
    expect(md).toContain('**Pricing check:** Needs 2.4x revenue in 18 months to justify this price.');
    expect(md).toContain('Rule of thumb · reviewed Nov 2026');
    expect(md).toContain('**Monthly Net Burn:**');
    expect(md).toContain('₹100 Cr');
    expect(md).not.toContain('—');
    expect(md).not.toContain('VC Benchmark');
    expect(md).not.toContain('Tool Assumption');

    const mdUsd = generateMarkdownSummary(presetA.input, 'USD_M', 'max_ask', 3.0, 90);
    expect(mdUsd).toContain('$M at ₹90/USD');
    expect(mdUsd).toContain('$2.22M');
  });

  it('generates unit-consistent PKZIP OOXML .xlsx workbooks in INR Cr, INR Lakh, and USD ($M)', () => {
    const presetA = PRESET_SCENARIOS.find((p) => p.id === 'a')!;
    const bytesCr = generateXlsxBytes(
      { ...presetA.input, monthlyBurn: 2 },
      'INR_CR',
      'max_ask',
      3.0,
      85
    );
    expect(bytesCr[0]).toBe(0x50);
    expect(bytesCr[1]).toBe(0x4b);

    const rawCr = new TextDecoder().decode(bytesCr);
    expect(rawCr).toContain('<f>B4/(B5/100)</f><v>100</v>');
    expect(rawCr).toContain('<f>B16-B4</f><v>80</v>');
    expect(rawCr).toContain('<f>B16*B9</f><v>200</v>');
    expect(rawCr).toContain('<f>MAX(0,(B12*B11)-B4)</f><v>16</v>');
    expect(rawCr).toContain('Rule of thumb');
    expect(rawCr.toLowerCase()).not.toContain('sajith');
    expect(rawCr).not.toContain('VC Benchmark');
    expect(rawCr).not.toContain('Tool Assumption');
    expect(buildXlsxFilename(presetA.input, 'INR_CR', 85)).toBe('valuation-check-20-cr.xlsx');

    // USD_M workbook scales inputs & cached outputs by 1 / (85 / 10)
    const bytesUsd = generateXlsxBytes(presetA.input, 'USD_M', 'max_ask', 3.0, 85);
    const rawUsd = new TextDecoder().decode(bytesUsd);
    expect(rawUsd).toContain('Monetary unit: $M (FX: ₹85/USD)');
    expect(rawUsd).toContain(`<f>B4/(B5/100)</f><v>${100 / 8.5}</v>`);
    expect(buildXlsxFilename(presetA.input, 'USD_M', 85)).toBe('valuation-check-2.35-usd-m.xlsx');

    const bytesLakh = generateXlsxBytes(presetA.input, 'INR_LAKH', 'max_ask', 3.0, 85);
    const rawLakh = new TextDecoder().decode(bytesLakh);
    expect(rawLakh).toContain('<f>B4/(B5/100)</f><v>10000</v>');
    expect(buildXlsxFilename(presetA.input, 'INR_LAKH', 85)).toBe(
      'valuation-check-2000-lakh.xlsx'
    );
  });

  it('serializes compact unit-consistent shareable URL query parameters', () => {
    const presetA = PRESET_SCENARIOS.find((p) => p.id === 'a')!;
    const presetB = PRESET_SCENARIOS.find((p) => p.id === 'b')!;

    expect(
      buildQueryString({
        unit: 'INR_CR',
        fxInrPerUsd: DEFAULT_FX_INR_PER_USD,
        activePresetId: 'a',
        input: { ...presetA.input },
        goalSeekTarget: 'max_ask',
        goalSeekGrowth: presetA.input.verdictBands.reachableMax,
      })
    ).toBe('');

    expect(
      buildQueryString({
        unit: 'INR_CR',
        fxInrPerUsd: DEFAULT_FX_INR_PER_USD,
        activePresetId: 'b',
        input: { ...presetB.input },
        goalSeekTarget: 'max_ask',
        goalSeekGrowth: presetB.input.verdictBands.reachableMax,
      })
    ).toBe('p=b');

    expect(
      buildQueryString({
        unit: 'USD_M',
        fxInrPerUsd: 90,
        activePresetId: 'b',
        input: { ...presetB.input },
        goalSeekTarget: 'max_ask',
        goalSeekGrowth: presetB.input.verdictBands.reachableMax,
      })
    ).toBe('p=b&u=USD_M&fx=90');

    // Custom values in USD_M at FX 85: ask 42.5 Cr = $5M, priorRaise 8.5 Cr = $1M, monthlyBurn 0.85 Cr = $0.1M
    const qs = buildQueryString({
      unit: 'USD_M',
      fxInrPerUsd: 85,
      activePresetId: null,
      input: {
        ...presetA.input,
        ask: 42.5,
        priorRaise: 8.5,
        priorRaiseWasPriced: false,
        monthlyBurn: 0.85,
      },
      goalSeekTarget: 'required_revenue',
      goalSeekGrowth: 3.5,
    });

    expect(qs).toContain('u=USD_M');
    expect(qs).toContain('ask=5');
    expect(qs).toContain('prior=1');
    expect(qs).toContain('burn=0.1');
    expect(qs).toContain('priced=0');
    expect(qs).toContain('gst=required_revenue');
    expect(qs).toContain('gsg=3.5');
    expect(qs).not.toContain('dil=20');
    expect(qs).not.toContain('step=2');
  });
});

describe('CAGR-Normalised Horizon Bands, Credibility Labels & Sector Benchmarks', () => {
  it('scales pricing ceilings by CAGR when monthsToNextRound differs from 18 months', () => {
    const out18 = evaluateAsk(
      makeInput({ ask: 18.9, annualRevenue: 9, monthsToNextRound: 18 }),
      'INR_CR'
    );
    expect(out18.verdict.level).toBe('reachable');

    const out12 = evaluateAsk(
      makeInput({ ask: 18.9, annualRevenue: 9, monthsToNextRound: 12 }),
      'INR_CR'
    );
    expect(out12.metrics.impliedCagrPct.value).toBeCloseTo(200, 3);
    expect(out12.verdict.level).toBe('stiff');

    const band12 = computeFeasibleAskBand(makeInput({ monthsToNextRound: 12 }));
    const band18 = computeFeasibleAskBand(makeInput({ monthsToNextRound: 18 }));
    const band24 = computeFeasibleAskBand(makeInput({ monthsToNextRound: 24 }));
    expect(band12.reachableAsk).toBeLessThan(band18.reachableAsk);
    expect(band18.reachableAsk).toBeLessThan(band24.reachableAsk);
  });

  it('uses unified credibility labels and zero em-dashes across rules, benchmarks, and India notes', () => {
    expect(ASSUMPTION_REFERENCES).toHaveLength(5);
    expect(SECTOR_MULTIPLE_BENCHMARKS.length).toBeGreaterThanOrEqual(4);
    expect(LABELS.indiaNotes.length).toBeGreaterThanOrEqual(4);

    for (const r of ASSUMPTION_REFERENCES) {
      expect(r.origin).toBe(LABELS.ruleOfThumbTag);
      expect(r.parameter).not.toContain('—');
      expect(r.explanation).not.toContain('—');
    }
    for (const s of SECTOR_MULTIPLE_BENCHMARKS) {
      expect(s.p25).toBeLessThan(s.p50);
      expect(s.p50).toBeLessThan(s.p75);
      expect(s.sector).not.toContain('—');
      expect(s.note).not.toContain('—');
    }
    for (const n of LABELS.indiaNotes) {
      expect(n.title).not.toContain('—');
      expect(n.body).not.toContain('—');
    }
  });
});

describe('Ask vs. Dilution Sensitivity Heatmap & Founder Ownership Waterfall', () => {
  it('computes a 5-row sensitivity grid spanning Conservative, Stretch, and Aggressive', () => {
    const presetC = PRESET_SCENARIOS.find((p) => p.id === 'c')!;
    const heatmap = computeAskDilutionHeatmap(presetC.input);

    expect(heatmap.available).toBe(true);
    expect(heatmap.dilutions).toEqual([15, 20, 25, 30]);
    expect(heatmap.rows).toHaveLength(5);
    expect(heatmap.rows.some((r) => r.ask === 50 && r.isCurrentAsk)).toBe(true);

    const allCells = heatmap.rows.flatMap((r) => r.cells);
    const levels = new Set(allCells.map((c) => c.level));
    expect(levels.has('reachable')).toBe(true);
    expect(levels.has('stretch')).toBe(true);
    expect(levels.has('stiff')).toBe(true);

    const zeroRevHeatmap = computeAskDilutionHeatmap(makeInput({ annualRevenue: 0 }));
    expect(zeroRevHeatmap.available).toBe(false);
  });

  it('computes founder ownership across R0, ESOP, R1, and illustrative R2', () => {
    const baseWf = computeOwnershipWaterfall(makeInput());
    expect(baseWf.valid).toBe(true);
    expect(baseWf.founderPreR1Pct).toBeCloseTo(100, 5);
    expect(baseWf.founderPostR1Pct).toBeCloseTo(80, 5);
    expect(baseWf.founderPostR2Pct).toBeCloseTo(64, 5);

    const fullWf = computeOwnershipWaterfall(
      makeInput({
        priorRaise: 10,
        priorRaiseWasPriced: true,
        priorDilutionPct: 15,
        esopTopUpPct: 10,
        dilutionPct: 20,
        nextRoundDilutionPct: 20,
      })
    );
    expect(fullWf.valid).toBe(true);
    expect(fullWf.founderPostR1Pct).toBeCloseTo(59.5, 5);
    expect(fullWf.r0InvestorPostR1Pct).toBeCloseTo(10.5, 5);
    expect(fullWf.founderPostR2Pct).toBeCloseTo(47.6, 5);
  });
});
