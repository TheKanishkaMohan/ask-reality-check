import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VERDICT_BANDS,
  PRESET_SCENARIOS,
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

  it('includes custom user dilution in the sensitivity table sorted alongside 20%, 25%, 33%', () => {
    const customDil = evaluateAsk(makeInput({ dilutionPct: 15 }));
    expect(customDil.sensitivity.map((r) => r.dilutionPct)).toEqual([15, 20, 25, 33]);
    expect(customDil.sensitivity.find((r) => r.dilutionPct === 15)?.isUserSelected).toBe(true);
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

describe('Share & Export — Markdown Summary and URL State Serialization', () => {
  it('generates a complete Markdown summary including verdict, metrics, and goal-seek', () => {
    const presetB = PRESET_SCENARIOS.find((p) => p.id === 'b')!;
    const md = generateMarkdownSummary(presetB.input, 'INR_CR', 'max_ask', 3.0);

    expect(md).toContain('# Ask Reality Check — Summary (₹ Cr)');
    expect(md).toContain('Reachable: 2.8x revenue growth needed in 18 months');
    expect(md).toContain('₹100 Cr');
    expect(md).toContain('₹80 Cr');
    expect(md).toContain('Goal-Seek & Feasible Ask Band');
  });

  it('serializes state into compact URL query parameters', () => {
    const presetA = PRESET_SCENARIOS.find((p) => p.id === 'a')!;
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
  });
});
