import { describe, expect, it } from 'vitest';
import {
  ASSUMPTION_REFERENCES,
  DEFAULT_VERDICT_BANDS,
  PRESET_SCENARIOS,
  SECTOR_MULTIPLE_BENCHMARKS,
  computeAskDilutionHeatmap,
  computeFeasibleAskBand,
  computeOwnershipWaterfall,
  convertUnitScale,
  evaluateAsk,
  formatMoney,
  formatMonthlyMoney,
  solveGoalSeek,
  validateInput,
  type CheckInput,
} from '../src/engine';

function makeInput(overrides: Partial<CheckInput> = {}): CheckInput {
  return {
    ask: 50,
    dilutionPct: 20,
    annualRevenue: 9,
    priorRaise: 0,
    priorRaiseWasPriced: true,
    stepUpMultiple: 2,
    nextRoundMultiple: 7,
    monthsToNextRound: 18,
    cashNeeded: 0,
    esopTopUpPct: 0,
    verdictBands: { ...DEFAULT_VERDICT_BANDS },
    ...overrides,
  };
}

describe('Ask Reality Check Engine — Acceptance Tests (Article Examples A, B, C)', () => {
  it('Example A: ₹50 Cr ask on ₹75L/mo (₹9 Cr ARR) matches article numbers', () => {
    const presetA = PRESET_SCENARIOS.find((p) => p.id === 'a')!;
    const out = evaluateAsk(presetA.input, 'INR_CR');

    expect(out.validation.valid).toBe(true);
    // 20% dilution -> ₹250 Cr post-money, ₹200 Cr pre-money
    expect(out.metrics.impliedPostMoney.value).toBeCloseTo(250, 5);
    expect(out.metrics.impliedPreMoney.value).toBeCloseTo(200, 5);
    // Next round 2x -> ₹500 Cr pre-money
    expect(out.metrics.nextRoundPreMoney.value).toBeCloseTo(500, 5);
    // At 7x placeholder -> ₹71.43 Cr ARR, 7.94x growth -> Stiff
    expect(out.metrics.requiredNextAnnualRevenue.value).toBeCloseTo(500 / 7, 4);
    expect(out.metrics.requiredGrowthMultiple.value).toBeCloseTo(500 / 7 / 9, 4);
    expect(out.verdict.level).toBe('stiff');

    // Sensitivity rows: 20% -> 250 Cr, 25% -> 200 Cr, 33% -> ~151.5 Cr (article rounds 1/3 to 150 Cr)
    const row20 = out.sensitivity.find((r) => r.dilutionPct === 20)!;
    const row25 = out.sensitivity.find((r) => r.dilutionPct === 25)!;
    const row33 = out.sensitivity.find((r) => r.dilutionPct === 33)!;

    expect(row20.postMoney).toBeCloseTo(250, 5);
    expect(row25.postMoney).toBeCloseTo(200, 5);
    expect(row33.postMoney).toBeGreaterThanOrEqual(150);
    expect(row33.postMoney).toBeLessThanOrEqual(152);
  });

  it('Example B: Consumer brand (₹20 Cr ask on ₹12 Cr ARR, ₹40 Cr burn) surfaces ~7x pre-money, ~33.3 Cr next ARR, and ₹20 Cr funding shortfall', () => {
    const presetB = PRESET_SCENARIOS.find((p) => p.id === 'b')!;
    const out = evaluateAsk(presetB.input, 'INR_CR');

    expect(out.validation.valid).toBe(true);
    expect(out.metrics.impliedPostMoney.value).toBeCloseTo(100, 5);
    expect(out.metrics.impliedPreMoney.value).toBeCloseTo(80, 5);

    // Pre-money multiple is 80 / 12 = 6.67x (~7x in article); Post-money multiple is 100 / 12 = 8.33x
    expect(out.metrics.impliedPreRevenueMultiple.value).toBeCloseTo(6.6667, 3);
    expect(out.metrics.impliedPostRevenueMultiple.value).toBeCloseTo(8.3333, 3);

    // Next-round pre-money = ₹200 Cr; at 6x -> ₹33.33 Cr ARR (~₹35 Cr in article) = ₹2.78 Cr/mo (~₹3 Cr/mo)
    expect(out.metrics.nextRoundPreMoney.value).toBeCloseTo(200, 5);
    expect(out.metrics.requiredNextAnnualRevenue.value).toBeCloseTo(33.3333, 3);
    expect(out.metrics.requiredNextMonthlyRevenue.value).toBeCloseTo(2.7778, 3);

    // Growth multiple = 33.3333 / 12 = 2.7778x -> Reachable on revenue growth
    expect(out.metrics.requiredGrowthMultiple.value).toBeCloseTo(2.7778, 3);
    expect(out.verdict.level).toBe('reachable');

    // Multiple compression reason MUST fire because 8.33x (and 6.67x) > 6x next-round multiple
    const compressionReason = out.verdict.reasons.find((r) => r.id === 'multiple_compression');
    expect(compressionReason).toBeDefined();

    // Funding gap: burn needs ₹40 Cr vs ₹20 Cr ask -> ₹20 Cr shortfall
    expect(out.metrics.fundingGap.value).toBeCloseTo(20, 5);
    const shortfallReason = out.verdict.reasons.find((r) => r.id === 'funding_shortfall');
    expect(shortfallReason).toBeDefined();
  });

  it('Example C: Cautionary ₹150 Cr ask on ₹18 Cr ARR (₹1.5 Cr/mo) at 12x requires ₹100 Cr ARR (~5.56x growth -> Stiff)', () => {
    const presetC = PRESET_SCENARIOS.find((p) => p.id === 'c')!;
    const out = evaluateAsk(presetC.input, 'INR_CR');

    expect(out.validation.valid).toBe(true);
    // At 25% dilution -> ₹600 Cr post-money, ₹1,200 Cr next pre-money
    expect(out.metrics.impliedPostMoney.value).toBeCloseTo(600, 5);
    expect(out.metrics.nextRoundPreMoney.value).toBeCloseTo(1200, 5);
    // At 12x -> ₹100 Cr required ARR -> 100 / 18 = 5.5556x growth (~5.5x in article)
    expect(out.metrics.requiredNextAnnualRevenue.value).toBeCloseTo(100, 5);
    expect(out.metrics.requiredGrowthMultiple.value).toBeCloseTo(5.5556, 3);
    expect(out.verdict.level).toBe('stiff');

    // At 20% dilution in sensitivity table -> ₹750 Cr post-money, ₹1,500 Cr next pre-money
    const row20 = out.sensitivity.find((r) => r.dilutionPct === 20)!;
    expect(row20.postMoney).toBeCloseTo(750, 5);
    expect(row20.nextPreMoney).toBeCloseTo(1500, 5);
  });
});

describe('Ask Reality Check Engine — Edge Cases & Prototype Bug Fixes', () => {
  it('handles zero revenue gracefully without NaN or Infinity', () => {
    const out = evaluateAsk(makeInput({ annualRevenue: 0 }), 'INR_CR');
    expect(out.validation.valid).toBe(true);
    expect(out.verdict.level).toBe('incomplete');
    expect(out.metrics.impliedPostMoney.value).toBe(250);
    expect(out.metrics.impliedPostRevenueMultiple.value).toBeNull();
    expect(out.metrics.requiredGrowthMultiple.value).toBeNull();
    expect(out.metrics.impliedCagrPct.value).toBeNull();
    expect(out.metrics.impliedPostRevenueMultiple.formattedValue).toBe('Enter revenue');
  });

  it('rejects zero, negative, and >=100% dilution with clear validation errors', () => {
    const zeroDil = evaluateAsk(makeInput({ dilutionPct: 0 }));
    expect(zeroDil.validation.valid).toBe(false);
    expect(zeroDil.verdict.level).toBe('invalid');

    const negDil = evaluateAsk(makeInput({ dilutionPct: -10 }));
    expect(negDil.validation.valid).toBe(false);

    const fullDil = evaluateAsk(makeInput({ dilutionPct: 100 }));
    expect(fullDil.validation.valid).toBe(false);

    const overDil = evaluateAsk(makeInput({ dilutionPct: 120 }));
    expect(overDil.validation.valid).toBe(false);
  });

  it('rejects dilution + ESOP top-up >= 100% so effective pre-money never goes negative', () => {
    const invalidEsop = validateInput(makeInput({ dilutionPct: 80, esopTopUpPct: 25 }));
    expect(invalidEsop.valid).toBe(false);
    expect(invalidEsop.errors.some((e) => e.field === 'esopAndDilution')).toBe(true);

    // Valid ESOP top-up: 20% dilution + 10% ESOP pool on ₹50 Cr ask (₹250 Cr post, ₹200 Cr pre -> ₹175 Cr effective pre)
    const validEsop = evaluateAsk(makeInput({ ask: 50, dilutionPct: 20, esopTopUpPct: 10 }));
    expect(validEsop.validation.valid).toBe(true);
    expect(validEsop.metrics.effectivePreMoneyAfterEsop.value).toBeCloseTo(175, 5);
  });

  it('distinguishes missing prior raise, priced prior raise, and unpriced prior raise', () => {
    // Missing prior raise (0)
    const noPrior = evaluateAsk(makeInput({ priorRaise: 0 }));
    expect(noPrior.metrics.askToPriorRaiseMultiple.value).toBeNull();
    expect(noPrior.verdict.reasons.some((r) => r.id.startsWith('prior_raise'))).toBe(false);

    // Priced prior raise of ₹10 Cr vs ₹100 Cr ask (10x -> above 3-4x band)
    const pricedHigh = evaluateAsk(
      makeInput({ ask: 100, priorRaise: 10, priorRaiseWasPriced: true })
    );
    expect(pricedHigh.metrics.askToPriorRaiseMultiple.value).toBeCloseTo(10, 5);
    expect(pricedHigh.verdict.reasons.some((r) => r.id === 'prior_raise_high')).toBe(true);

    // Unpriced prior raise (e.g. grant/convertible) of ₹10 Cr vs ₹100 Cr ask -> does not fire priced warning
    const unpriced = evaluateAsk(
      makeInput({ ask: 100, priorRaise: 10, priorRaiseWasPriced: false })
    );
    expect(unpriced.verdict.reasons.some((r) => r.id === 'prior_raise_high')).toBe(false);
    expect(unpriced.verdict.reasons.some((r) => r.id === 'prior_raise_unpriced')).toBe(true);
  });

  it('handles cash needed below the ask (runway buffer) vs above the ask (shortfall)', () => {
    const bufferCase = evaluateAsk(makeInput({ ask: 25, cashNeeded: 18 }));
    expect(bufferCase.metrics.fundingGap.value).toBe(0);
    expect(bufferCase.metrics.fundingGap.formattedValue).toBe('None');
    expect(bufferCase.verdict.reasons.some((r) => r.id === 'funding_buffer')).toBe(true);
  });

  it('includes custom user dilution and a lower step-down row when user dilution is lowest', () => {
    const dil12 = evaluateAsk(makeInput({ dilutionPct: 12 }));
    expect(dil12.sensitivity.map((r) => r.dilutionPct)).toEqual([5, 12, 20, 25, 33]);
    expect(dil12.sensitivity.find((r) => r.dilutionPct === 12)?.isUserSelected).toBe(true);

    const dil15 = evaluateAsk(makeInput({ dilutionPct: 15 }));
    expect(dil15.sensitivity.map((r) => r.dilutionPct)).toEqual([10, 15, 20, 25, 33]);

    const dil20 = evaluateAsk(makeInput({ dilutionPct: 20 }));
    expect(dil20.sensitivity.map((r) => r.dilutionPct)).toEqual([15, 20, 25, 33]);

    const dil25 = evaluateAsk(makeInput({ dilutionPct: 25 }));
    expect(dil25.sensitivity.map((r) => r.dilutionPct)).toEqual([20, 25, 33]);
  });
});

describe('Ask Reality Check Engine — Goal-Seek Mode & Unit Formatting', () => {
  it('solves for max_ask and round-trips to the exact target growth multiple', () => {
    const baseInput = makeInput({ ask: 50, dilutionPct: 20, annualRevenue: 9, nextRoundMultiple: 7 });
    const seek = solveGoalSeek(baseInput, 'max_ask', 3.0, 'INR_CR');

    expect(seek.isFeasible).toBe(true);
    // Max ask for 3x growth: 9 * 3 * 7 / 2 * 0.20 = 18.9 Cr
    expect(seek.solvedValue).toBeCloseTo(18.9, 5);

    const checkRoundTrip = evaluateAsk({ ...baseInput, ask: seek.solvedValue! });
    expect(checkRoundTrip.metrics.requiredGrowthMultiple.value).toBeCloseTo(3.0, 5);
    expect(checkRoundTrip.verdict.level).toBe('reachable');
  });

  it('solves for required_revenue and round-trips to the exact target growth multiple', () => {
    const baseInput = makeInput({ ask: 50, dilutionPct: 20, annualRevenue: 9, nextRoundMultiple: 7 });
    const seek = solveGoalSeek(baseInput, 'required_revenue', 3.0, 'INR_CR');

    expect(seek.isFeasible).toBe(true);
    // Required ARR for ₹50 Cr ask at 3x growth: (50 / 0.2 * 2 / 7) / 3 = 23.8095 Cr
    expect(seek.solvedValue).toBeCloseTo(500 / 21, 4);

    const checkRoundTrip = evaluateAsk({ ...baseInput, annualRevenue: seek.solvedValue! });
    expect(checkRoundTrip.metrics.requiredGrowthMultiple.value).toBeCloseTo(3.0, 5);
  });

  it('solves for required_dilution and flags infeasible dilution when >= 100%', () => {
    const baseInput = makeInput({ ask: 30, dilutionPct: 20, annualRevenue: 12, nextRoundMultiple: 6 });
    // Max post at 3x growth = 12 * 3 * 6 / 2 = 108 Cr. For 30 Cr ask, required dilution = 30 / 108 = 27.78%
    const seek = solveGoalSeek(baseInput, 'required_dilution', 3.0, 'INR_CR');
    expect(seek.isFeasible).toBe(true);
    expect(seek.solvedValue).toBeCloseTo((30 / 108) * 100, 4);

    const checkRoundTrip = evaluateAsk({ ...baseInput, dilutionPct: seek.solvedValue! });
    expect(checkRoundTrip.metrics.requiredGrowthMultiple.value).toBeCloseTo(3.0, 5);

    // Infeasible ask: ₹150 Cr ask when max post-money is ₹108 Cr -> requires >100% dilution
    const infeasibleSeek = solveGoalSeek(
      { ...baseInput, ask: 150 },
      'required_dilution',
      3.0,
      'INR_CR'
    );
    expect(infeasibleSeek.isFeasible).toBe(false);
    expect(infeasibleSeek.solvedValue).toBeGreaterThan(100);
  });

  it('formats units and converts between INR_CR and INR_LAKH accurately', () => {
    expect(formatMoney(250, 'INR_CR')).toBe('₹250 Cr');
    expect(formatMoney(5, 'USD_M')).toBe('$5M');
    expect(formatMonthlyMoney(0.75, 'INR_CR')).toContain('₹75 Lakh/mo');
    expect(convertUnitScale(0.75, 'INR_CR', 'INR_LAKH')).toBe(75);
    expect(convertUnitScale(75, 'INR_LAKH', 'INR_CR')).toBe(0.75);
  });
});

import { generateMarkdownSummary } from '../src/ui/export';
import { buildQueryString } from '../src/ui/state';
import { buildXlsxFilename, generateXlsxBytes } from '../src/ui/xlsx';

describe('Share & Export — Markdown Summary, XLSX Workbook & URL State Serialization', () => {
  it('generates a complete Markdown summary including verdict, metrics, and goal-seek', () => {
    const presetB = PRESET_SCENARIOS.find((p) => p.id === 'b')!;
    const md = generateMarkdownSummary(presetB.input, 'INR_CR', 'max_ask', 3.0);

    expect(md).toContain('# Valuation Check: Summary (₹ Cr)');
    expect(md).toContain('Reachable: 2.8x revenue growth needed in 18 months');
    expect(md).toContain('₹100 Cr');
    expect(md).toContain('₹80 Cr');
    expect(md).toContain('Goal-Seek & Feasible Ask Band');
    expect(md).not.toContain('—');
  });

  it('generates a valid PKZIP OOXML .xlsx workbook with live Excel formulas and zero Sajith references', () => {
    const presetB = PRESET_SCENARIOS.find((p) => p.id === 'b')!;
    const bytes = generateXlsxBytes(presetB.input, 'INR_CR', 'max_ask', 3.0);

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(2000);
    // PKZIP local file header signature (PK\x03\x04)
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);

    const rawText = new TextDecoder().decode(bytes);
    expect(rawText).toContain('[Content_Types].xml');
    expect(rawText).toContain('xl/workbook.xml');
    expect(rawText).toContain('xl/styles.xml');
    expect(rawText).toContain('xl/worksheets/sheet1.xml');
    expect(rawText).toContain('xl/worksheets/sheet2.xml');
    expect(rawText).toContain('Rules &amp; Benchmarks');
    // Live formulas and Example B cached outputs (100 post, 80 pre, 200 next pre, 20 shortfall, CAGR/CMGR)
    expect(rawText).toContain('<f>B4/(B5/100)</f><v>100</v>');
    expect(rawText).toContain('<f>B16-B4</f><v>80</v>');
    expect(rawText).toContain('<f>B16*B9</f><v>200</v>');
    expect(rawText).toContain('<f>IF(B6&gt;0,(B24^(12/B11))-1,0)</f>');
    expect(rawText).toContain('<f>MAX(0,B12-B4)</f><v>20</v>');
    expect(rawText.toLowerCase()).not.toContain('sajith');
    expect(buildXlsxFilename(presetB.input, 'INR_CR')).toBe('valuation-check-20-cr.xlsx');
  });

  it('serializes only non-default delta state into compact shareable URL query parameters', () => {
    const presetA = PRESET_SCENARIOS.find((p) => p.id === 'a')!;
    const presetB = PRESET_SCENARIOS.find((p) => p.id === 'b')!;

    // Default Preset A -> clean root URL with zero query parameters
    expect(
      buildQueryString({
        unit: presetA.unit,
        activePresetId: 'a',
        input: { ...presetA.input },
        goalSeekTarget: 'max_ask',
        goalSeekGrowth: presetA.input.verdictBands.reachableMax,
      })
    ).toBe('');

    // Non-default Preset B -> single p=b parameter
    expect(
      buildQueryString({
        unit: presetB.unit,
        activePresetId: 'b',
        input: { ...presetB.input },
        goalSeekTarget: 'max_ask',
        goalSeekGrowth: presetB.input.verdictBands.reachableMax,
      })
    ).toBe('p=b');

    // Custom values -> emit only parameters that differ from Default A
    const qs = buildQueryString({
      unit: 'USD_M',
      activePresetId: null,
      input: { ...presetA.input, ask: 5, priorRaise: 1.5, priorRaiseWasPriced: false },
      goalSeekTarget: 'required_revenue',
      goalSeekGrowth: 3.5,
    });

    expect(qs).toContain('u=USD_M');
    expect(qs).toContain('ask=5');
    expect(qs).toContain('prior=1.5');
    expect(qs).toContain('priced=0');
    expect(qs).toContain('gst=required_revenue');
    expect(qs).toContain('gsg=3.5');
    expect(qs).not.toContain('dil=20');
    expect(qs).not.toContain('rev=9');
    expect(qs).not.toContain('step=2');
    expect(qs).not.toContain('mult=7');
    expect(qs).not.toContain('m=18');
  });
});

describe('CAGR-Normalised Horizon Verdicts, ELI10 Rules & Sector Benchmarks', () => {
  it('scales verdict ceilings by CAGR when monthsToNextRound differs from 18 months', () => {
    // Ask = 18.9 Cr on 9 Cr ARR, 20% dilution, 7x multiple -> exact 3.0x growth needed
    const out18 = evaluateAsk(makeInput({ ask: 18.9, monthsToNextRound: 18 }), 'INR_CR');
    expect(out18.verdict.level).toBe('reachable');

    // Same 3.0x growth in 12 months = 200%/yr CAGR -> Stiff (> 192%/yr)
    const out12 = evaluateAsk(makeInput({ ask: 18.9, monthsToNextRound: 12 }), 'INR_CR');
    expect(out12.metrics.impliedCagrPct.value).toBeCloseTo(200, 3);
    expect(out12.verdict.level).toBe('stiff');

    // Ask = 25.2 Cr -> 4.0x growth needed: Stretch in 18 mo (152%/yr), Reachable in 24 mo (100%/yr)
    const stretch18 = evaluateAsk(makeInput({ ask: 25.2, monthsToNextRound: 18 }), 'INR_CR');
    expect(stretch18.verdict.level).toBe('stretch');

    const reach24 = evaluateAsk(makeInput({ ask: 25.2, monthsToNextRound: 24 }), 'INR_CR');
    expect(reach24.metrics.impliedCagrPct.value).toBeCloseTo(100, 3);
    expect(reach24.verdict.level).toBe('reachable');

    // Feasible ask band grows monotonically with longer runway at constant CAGR
    const band12 = computeFeasibleAskBand(makeInput({ monthsToNextRound: 12 }));
    const band18 = computeFeasibleAskBand(makeInput({ monthsToNextRound: 18 }));
    const band24 = computeFeasibleAskBand(makeInput({ monthsToNextRound: 24 }));
    expect(band12.reachableAsk).toBeLessThan(band18.reachableAsk);
    expect(band18.reachableAsk).toBeLessThan(band24.reachableAsk);
  });

  it('provides 5 ELI10 rules and well-ordered P25 < P50 < P75 sector benchmarks with zero em-dashes', () => {
    expect(ASSUMPTION_REFERENCES).toHaveLength(5);
    expect(SECTOR_MULTIPLE_BENCHMARKS.length).toBeGreaterThanOrEqual(4);
    for (const r of ASSUMPTION_REFERENCES) {
      expect(r.parameter).not.toContain('—');
      expect(r.defaultValue).not.toContain('—');
      expect(r.explanation).not.toContain('—');
    }
    for (const s of SECTOR_MULTIPLE_BENCHMARKS) {
      expect(s.p25).toBeLessThan(s.p50);
      expect(s.p50).toBeLessThan(s.p75);
      expect(s.note.length).toBeGreaterThan(10);
      expect(s.sector).not.toContain('—');
      expect(s.note).not.toContain('—');
    }
    for (const p of PRESET_SCENARIOS) {
      expect(p.description).not.toContain('—');
      const out = evaluateAsk(p.input, p.unit);
      expect(out.verdict.headline).not.toContain('—');
      for (const reason of out.verdict.reasons) {
        expect(reason.text).not.toContain('—');
      }
    }
  });
});

describe('Ask vs. Dilution Sensitivity Heatmap & Founder Ownership Waterfall', () => {
  it('computes a 5-row sensitivity grid spanning Reachable, Stretch, and Stiff and marks the current cell', () => {
    const presetA = PRESET_SCENARIOS.find((p) => p.id === 'a')!;
    const heatmap = computeAskDilutionHeatmap(presetA.input);

    expect(heatmap.available).toBe(true);
    expect(heatmap.dilutions).toEqual([15, 20, 25, 30]);
    expect(heatmap.rows).toHaveLength(5);
    expect(heatmap.rows.some((r) => r.ask === 50 && r.isCurrentAsk)).toBe(true);

    const allCells = heatmap.rows.flatMap((r) => r.cells);
    const currentCells = allCells.filter((c) => c.isCurrent);
    expect(currentCells).toHaveLength(1);
    expect(currentCells[0]!.ask).toBe(50);
    expect(currentCells[0]!.dilutionPct).toBe(20);
    expect(currentCells[0]!.level).toBe('stiff');

    const levels = new Set(allCells.map((c) => c.level));
    expect(levels.has('reachable')).toBe(true);
    expect(levels.has('stretch')).toBe(true);
    expect(levels.has('stiff')).toBe(true);

    const customHeatmap = computeAskDilutionHeatmap(makeInput({ dilutionPct: 12 }));
    expect(customHeatmap.dilutions).toEqual([5, 12, 20, 25]);

    const highDilHeatmap = computeAskDilutionHeatmap(makeInput({ dilutionPct: 33 }));
    expect(highDilHeatmap.dilutions).toEqual([20, 25, 30, 33]);

    const zeroRevHeatmap = computeAskDilutionHeatmap(makeInput({ annualRevenue: 0 }));
    expect(zeroRevHeatmap.available).toBe(false);
    expect(zeroRevHeatmap.rows).toHaveLength(0);
  });

  it('computes founder ownership across R0, ESOP, R1, and illustrative R2 with cap-table reconciliation', () => {
    const baseWf = computeOwnershipWaterfall(makeInput());
    expect(baseWf.valid).toBe(true);
    expect(baseWf.r0DilutionIsAssumed).toBe(false);
    expect(baseWf.founderPreR1Pct).toBeCloseTo(100, 5);
    expect(baseWf.founderPostR1Pct).toBeCloseTo(80, 5);
    expect(baseWf.founderPostR2Pct).toBeCloseTo(64, 5);

    const assumedR0Wf = computeOwnershipWaterfall(
      makeInput({ priorRaise: 10, priorRaiseWasPriced: true })
    );
    expect(assumedR0Wf.valid).toBe(true);
    expect(assumedR0Wf.r0DilutionIsAssumed).toBe(true);
    expect(assumedR0Wf.r0DilutionPct).toBe(15);
    expect(assumedR0Wf.founderPreR1Pct).toBeCloseTo(85, 5);

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
    expect(fullWf.r0DilutionIsAssumed).toBe(false);
    expect(fullWf.founderPostR1Pct).toBeCloseTo(59.5, 5);
    expect(fullWf.r0InvestorPostR1Pct).toBeCloseTo(10.5, 5);
    expect(fullWf.founderPostR2Pct).toBeCloseTo(47.6, 5);

    const totalPostR1 =
      fullWf.founderPostR1Pct +
      fullWf.r0InvestorPostR1Pct +
      fullWf.esopTopUpPct +
      fullWf.r1DilutionPct;
    expect(totalPostR1).toBeCloseTo(100, 5);

    for (const s of fullWf.steps) {
      expect(s.label).not.toContain('—');
      expect(s.sublabel).not.toContain('—');
    }
  });
});
