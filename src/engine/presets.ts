import type { AssumptionReference, PresetScenario, VerdictBands } from './types';

export const DEFAULT_VERDICT_BANDS: VerdictBands = {
  reachableMax: 3.0,
  stretchMax: 5.0,
};

export const PRESET_SCENARIOS: PresetScenario[] = [
  {
    id: 'a',
    name: 'Example A: ₹50 Cr ask on ₹75L/mo',
    shortLabel: 'Note: ₹50 Cr ask',
    description:
      'The note’s opening example: ₹50 Cr ask on ₹75 lakh/month (₹9 Cr ARR). At 20–25% dilution the ask implies ₹200–250 Cr post-money, requiring ₹400–500 Cr next-round pre-money in 15–18 months. (The 7x next-round multiple is our placeholder.)',
    unit: 'INR_CR',
    input: {
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
    },
  },
  {
    id: 'b',
    name: 'Example B: Consumer brand sized to milestone',
    shortLabel: 'Note: sized to milestone',
    description:
      'The note’s consumer brand: doing ₹1 Cr/month (₹12 Cr ARR), raising ₹20 Cr at ₹80 Cr pre-money (~6.7x pre-money / 8.3x post-money) and ₹100 Cr post-money. Next round needs ₹200 Cr pre-money at 6x (~₹33.3 Cr ARR, or ~₹2.8–3 Cr/mo). But the burn plan requires ₹40 Cr to get there, leaving a ₹20 Cr shortfall.',
    unit: 'INR_CR',
    input: {
      ask: 20,
      dilutionPct: 20,
      annualRevenue: 12,
      priorRaise: 0,
      priorRaiseWasPriced: true,
      stepUpMultiple: 2,
      nextRoundMultiple: 6,
      monthsToNextRound: 18,
      cashNeeded: 40,
      esopTopUpPct: 0,
      verdictBands: { ...DEFAULT_VERDICT_BANDS },
    },
  },
  {
    id: 'c',
    name: 'Example C: ₹150 Cr cautionary pitch',
    shortLabel: 'Note: ₹150 Cr ask',
    description:
      'The note’s cautionary consumer services pitch: ₹150 Cr ask on ₹1.5 Cr/month (₹18 Cr ARR) implies ₹600–750 Cr post-money. Clearing a ₹1,200+ Cr next round even at a generous 12x multiple demands ₹100 Cr ARR (~5.6x growth in 15–18 months — "Stiff").',
    unit: 'INR_CR',
    input: {
      ask: 150,
      dilutionPct: 25,
      annualRevenue: 18,
      priorRaise: 0,
      priorRaiseWasPriced: true,
      stepUpMultiple: 2,
      nextRoundMultiple: 12,
      monthsToNextRound: 18,
      cashNeeded: 0,
      esopTopUpPct: 0,
      verdictBands: { ...DEFAULT_VERDICT_BANDS },
    },
  },
];

export const ASSUMPTION_REFERENCES: AssumptionReference[] = [
  {
    id: 'dilution_band',
    parameter: 'Early-stage dilution band (20%–25%)',
    defaultValue: '20% (4x–5x ask)',
    origin: 'Source Article',
    explanation:
      'Sajith Pai notes that early-stage rounds typically involve 20%–25% dilution, so VCs multiply your ask by 4x–5x to read your implied post-money valuation (with 33% as a high-dilution edge case).',
  },
  {
    id: 'step_up',
    parameter: 'Minimum next-round valuation step-up',
    defaultValue: '2.0x post-money',
    origin: 'Source Article',
    explanation:
      'Incoming VCs underwrite the current round by asking whether the next round’s pre-money valuation can be at least 2x the present post-money valuation.',
  },
  {
    id: 'horizon',
    parameter: 'Time to next round benchmark',
    defaultValue: '15–18 months',
    origin: 'Source Article',
    explanation:
      'Standard seed/early-stage runway window over which the 2x+ valuation bump is evaluated. Staged tranches or deep-tech/hardware horizons may differ.',
  },
  {
    id: 'prior_raise_band',
    parameter: 'Ask vs. previous priced raise ratio',
    defaultValue: '3.0x–4.0x',
    origin: 'Source Article',
    explanation:
      'If you raised ₹10 Cr in a priced pre-seed round, a typical next-round ask is ₹30–40 Cr (aligning with a 2–3x valuation bump). Does not apply to grants or unpriced angel notes.',
  },
  {
    id: 'esop_pool',
    parameter: 'Pre-money ESOP pool top-up deduction',
    defaultValue: '0% (optional input)',
    origin: 'Source Article (Comments)',
    explanation:
      'As noted by Adityavikram Banka and confirmed by Sajith Pai in the article comments, a pre-money ESOP pool top-up comes out of existing shareholders’ stake, lowering effective pre-money valuation.',
  },
  {
    id: 'verdict_bands',
    parameter: 'Growth verdict bands (Reachable ≤ 3x, Stretch ≤ 5x, Stiff > 5x)',
    defaultValue: '3.0x / 5.0x',
    origin: 'Our Assumption',
    explanation:
      'Inferred from the article’s examples: ~2.8x–3x in Example B is treated as an achievable milestone, whereas ~5.5x in Example C is called "Stiff". Configurable in Settings.',
  },
  {
    id: 'example_a_multiple',
    parameter: 'Example A next-round revenue multiple',
    defaultValue: '7.0x ARR',
    origin: 'Our Assumption',
    explanation:
      'The article leaves the next-round revenue multiple in Example A open ("?"). We use 7x (matching the starting multiple in Example B) as a placeholder.',
  },
  {
    id: 'cagr_formula',
    parameter: 'Compound annualised growth rate (CAGR)',
    defaultValue: '(Growth)^(12 / Months) − 1',
    origin: 'Our Assumption',
    explanation:
      'Converts the total revenue multiple over the runway horizon into an equivalent annualised compounding rate.',
  },
];
