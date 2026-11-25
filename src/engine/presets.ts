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
    name: 'High ask: ₹50 Cr on ₹75L/mo',
    shortLabel: '₹50 Cr ask on ₹9 Cr ARR',
    description:
      'High R1 ask: raising ₹50 Cr on ₹9 Cr ARR sets a ₹250 Cr R1 post-money at 20% dilution. R2 pre-money then needs ₹500 Cr in 18 months, requiring ₹71.4 Cr ARR at a 7x R2 multiple.',
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
    name: 'Milestone-sized: ₹20 Cr on ₹1 Cr/mo',
    shortLabel: '₹20 Cr sized to milestone',
    description:
      'Sized to growth: raising ₹20 Cr on ₹12 Cr ARR sets a ₹100 Cr R1 post-money at 20% dilution. R2 needs ₹200 Cr pre-money, or ₹33.3 Cr ARR at 6x (2.8x growth). The ₹40 Cr burn plan leaves a ₹20 Cr gap to bridge.',
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
    name: 'Aggressive ask: ₹150 Cr on ₹1.5 Cr/mo',
    shortLabel: '₹150 Cr aggressive ask',
    description:
      'Aggressive R1 ask: raising ₹150 Cr on ₹18 Cr ARR implies ₹600 Cr post-money at 25% dilution. Reaching a ₹1,200 Cr R2 pre-money even at 12x demands ₹100 Cr ARR, which is 5.6x growth in 18 months.',
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
    id: 'ask_price_tag',
    parameter: 'Early valuations come from two numbers',
    defaultValue: '20% to 25% dilution',
    origin: 'VC Benchmark',
    explanation:
      'Early rounds are rarely priced with a DCF model. Your R1 ask and dilution set your R1 valuation directly. Asking for ₹20 Cr at 20% dilution signals a ₹100 Cr post-money.',
  },
  {
    id: 'step_up',
    parameter: 'R2 must pay at least 2x your R1 price',
    defaultValue: '2.0x in 15 to 18 mo',
    origin: 'VC Benchmark',
    explanation:
      "R1 investors back today's price only if R2 can pay at least 2x your R1 post-money in 15 to 18 months.",
  },
  {
    id: 'multiple_compression',
    parameter: 'Multiples shrink as you scale',
    defaultValue: 'Multiple compression',
    origin: 'VC Benchmark',
    explanation:
      'Early rounds pay more per rupee of revenue on promise. Later rounds pay less on proven scale. When multiples drop from R1 to R2, revenue must grow much faster than 2x to double valuation.',
  },
  {
    id: 'growth_pace',
    parameter: 'Required CAGR sets the verdict',
    defaultValue: '≤108%/yr and ≤192%/yr',
    origin: 'Tool Assumption',
    explanation:
      'Tripling in 18 months (108%/yr CAGR) is reachable for strong startups. Growing 3x to 5x (108% to 192%/yr CAGR) is a stretch. Above 192%/yr CAGR is stiff. Thresholds adjust automatically when you change months to R2.',
  },
  {
    id: 'prior_and_esop',
    parameter: 'R0 raise and ESOP are extra reality checks',
    defaultValue: '3x to 4x R0 · Pre-money ESOP',
    origin: 'VC Benchmark',
    explanation:
      "Raising 3x to 4x your last priced round (R0) is typical, though grants and notes are exempt. A pre-money ESOP top-up lowers founders' effective R1 valuation, while R2 targets stay tied to headline post-money.",
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
