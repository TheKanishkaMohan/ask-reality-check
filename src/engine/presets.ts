import { LABELS } from './labels';
import type {
  AssumptionReference,
  PresetScenario,
  SectorMultipleBenchmark,
  VerdictBands,
} from './types';

export const DEFAULT_VERDICT_BANDS: VerdictBands = {
  reachableMax: 3.0,
  stretchMax: 5.0,
};

export const PRESET_SCENARIOS: PresetScenario[] = [
  {
    id: 'a',
    name: 'Conservative ask: ₹20 Cr on ₹1 Cr/mo',
    shortLabel: '₹20 Cr · Conservative',
    description:
      'Same company on ₹1 Cr/mo (₹12 Cr ARR): raising ₹20 Cr at 20% dilution sets ₹100 Cr post-money. Reaching ₹200 Cr R2 pre-money at 7x needs ₹28.6 Cr ARR (2.4x growth, 78%/yr).',
    unit: 'INR_CR',
    input: {
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
    },
  },
  {
    id: 'b',
    name: 'Stretch ask: ₹30 Cr on ₹1 Cr/mo',
    shortLabel: '₹30 Cr · Stretch',
    description:
      'Same company on ₹1 Cr/mo (₹12 Cr ARR): raising ₹30 Cr at 20% dilution sets ₹150 Cr post-money. Reaching ₹300 Cr R2 pre-money at 7x needs ₹42.9 Cr ARR (3.6x growth, 134%/yr).',
    unit: 'INR_CR',
    input: {
      ask: 30,
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
    },
  },
  {
    id: 'c',
    name: 'Aggressive ask: ₹50 Cr on ₹1 Cr/mo',
    shortLabel: '₹50 Cr · Aggressive',
    description:
      'Same company on ₹1 Cr/mo (₹12 Cr ARR): raising ₹50 Cr at 20% dilution sets ₹250 Cr post-money. Reaching ₹500 Cr R2 pre-money at 7x needs ₹71.4 Cr ARR (6x growth, 228%/yr).',
    unit: 'INR_CR',
    input: {
      ask: 50,
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
    },
  },
];

export const ASSUMPTION_REFERENCES: AssumptionReference[] = [
  {
    id: 'ask_price_tag',
    parameter: 'Early valuations come from two numbers',
    defaultValue: '20% to 25% dilution',
    origin: LABELS.ruleOfThumbTag,
    explanation:
      'Early rounds are rarely priced with a DCF model. Your R1 ask and dilution set your R1 valuation directly. Asking for ₹20 Cr at 20% dilution signals a ₹100 Cr post-money.',
  },
  {
    id: 'step_up',
    parameter: 'R2 must pay at least 2x your R1 price',
    defaultValue: '2.0x in 15 to 18 mo',
    origin: LABELS.ruleOfThumbTag,
    explanation:
      "R1 investors back today's price only if R2 can pay at least 2x your R1 post-money in 15 to 18 months.",
  },
  {
    id: 'multiple_compression',
    parameter: 'Multiples shrink as you scale',
    defaultValue: 'Multiple compression',
    origin: LABELS.ruleOfThumbTag,
    explanation:
      'Early rounds pay more per rupee of revenue on promise. Later rounds pay less on proven scale. When multiples drop from R1 to R2, revenue must grow much faster than 2x to double valuation.',
  },
  {
    id: 'growth_pace',
    parameter: 'Required CAGR sets the pricing band',
    defaultValue: '≤108%/yr and ≤192%/yr',
    origin: LABELS.ruleOfThumbTag,
    explanation:
      'Tripling in 18 months (108%/yr CAGR) is an ambitious but reachable growth hurdle for strong startups, so asks inside this threshold are priced as Conservative. Asks requiring 3x to 5x growth (108% to 192%/yr CAGR) are priced as Stretch, and asks above 192%/yr are priced as Aggressive. Growth thresholds adjust automatically when you change months to R2.',
  },
  {
    id: 'prior_and_esop',
    parameter: 'R0 raise and ESOP are extra checks',
    defaultValue: '3x to 4x R0 · Pre-money ESOP',
    origin: LABELS.ruleOfThumbTag,
    explanation:
      "Raising 3x to 4x your last priced round (R0) is common, though grants and notes are exempt. Any ESOP pool created this round comes out of pre-money, lowering existing holders' effective valuation while R2 targets stay tied to headline post-money.",
  },
];

export const SECTOR_MULTIPLE_BENCHMARKS: SectorMultipleBenchmark[] = [
  {
    id: 'd2c',
    sector: 'D2C / Consumer Brands',
    p25: 2.0,
    p50: 3.5,
    p75: 6.0,
    note: 'Gross margins, paid marketing, and listed FMCG comps keep multiples modest.',
  },
  {
    id: 'saas_ai',
    sector: 'B2B SaaS / Vertical AI',
    p25: 5.5,
    p50: 9.0,
    p75: 15.0,
    note: 'High gross margins (75%+) and sticky recurring revenue support higher multiples.',
  },
  {
    id: 'deeptech_hw',
    sector: 'DeepTech: Hardware & Mfg (TRL 7-9)',
    p25: 2.5,
    p50: 5.0,
    p75: 8.5,
    note: 'Hardware costs and capex weigh on multiples; investors also check gross profit and order book.',
  },
  {
    id: 'deeptech_ip',
    sector: 'DeepTech: IP / Software-Led',
    p25: 5.0,
    p50: 10.0,
    p75: 18.0,
    note: 'Semicon IP, defence systems, and autonomy earn stronger multiples from durable IP and software margins.',
  },
  {
    id: 'marketplace',
    sector: 'Marketplace / Low-Margin Commerce',
    p25: 1.5,
    p50: 2.5,
    p75: 4.0,
    note: 'Investors value net take-rate and contribution margin rather than gross GMV.',
  },
];
