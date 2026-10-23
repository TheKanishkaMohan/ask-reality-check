export type CurrencyUnit = 'INR_CR' | 'INR_LAKH' | 'USD_M';

export interface VerdictBands {
  /** Maximum required revenue growth multiple considered "Reachable" (default: 3.0x — our assumption) */
  reachableMax: number;
  /** Maximum required revenue growth multiple considered "Stretch" before becoming "Stiff" (default: 5.0x — our assumption) */
  stretchMax: number;
}

export interface CheckInput {
  /** Intended fundraise ask in the selected currency unit */
  ask: number;
  /** Expected round dilution percentage (e.g., 20 for 20%) */
  dilutionPct: number;
  /** Current annualised revenue (ARR = 12 × monthly revenue) in the selected currency unit */
  annualRevenue: number;
  /** Capital raised in the immediate previous round (0 if none) */
  priorRaise: number;
  /** Whether the previous raise was a priced round (vs. grant / unpriced convertible note) */
  priorRaiseWasPriced: boolean;
  /** Required step-up from this round's post-money to next round's pre-money (default: 2.0x) */
  stepUpMultiple: number;
  /** Next-round pre-money valuation to annualised revenue multiple (e.g., 6x, 7x, 12x) */
  nextRoundMultiple: number;
  /** Runway horizon in months to reach next round milestone (benchmark: 15–18 months) */
  monthsToNextRound: number;
  /** Total cash needed from burn plan to reach the next round's milestone (0 if not set) */
  cashNeeded: number;
  /** Pre-money ESOP pool expansion required by investor, as % of post-money (0 if none) */
  esopTopUpPct: number;
  /** Configurable growth verdict bands */
  verdictBands: VerdictBands;
}

export type ValidationField = keyof CheckInput | 'esopAndDilution';

export interface ValidationIssue {
  field: ValidationField;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface TracedMetric {
  id: string;
  label: string;
  value: number | null;
  formattedValue: string;
  subtitle: string;
  formula: string;
  calculation: string;
  isAssumption: boolean;
  assumptionOrigin: string;
}

export type VerdictLevel = 'invalid' | 'incomplete' | 'reachable' | 'stretch' | 'stiff';

export interface VerdictReason {
  id: string;
  text: string;
  tone: 'neutral' | 'good' | 'warn' | 'bad';
  isAssumption: boolean;
  origin: string;
}

export interface SensitivityRow {
  dilutionPct: number;
  isUserSelected: boolean;
  note: string;
  postMoney: number;
  preMoney: number;
  impliedPostMultiple: number | null;
  impliedPreMultiple: number | null;
  nextPreMoney: number;
  requiredAnnualRevenue: number;
  requiredMonthlyRevenue: number;
  requiredGrowthMultiple: number | null;
}

export interface FeasibleAskBand {
  reachableAsk: number;
  stretchAsk: number;
  priorRaiseBand: [number, number] | null;
}

export interface CheckMetrics {
  impliedPostMoney: TracedMetric;
  impliedPreMoney: TracedMetric;
  effectivePreMoneyAfterEsop: TracedMetric;
  impliedPostRevenueMultiple: TracedMetric;
  impliedPreRevenueMultiple: TracedMetric;
  nextRoundPreMoney: TracedMetric;
  requiredNextAnnualRevenue: TracedMetric;
  requiredNextMonthlyRevenue: TracedMetric;
  requiredGrowthMultiple: TracedMetric;
  impliedCagrPct: TracedMetric;
  impliedCmgrPct: TracedMetric;
  fundingGap: TracedMetric;
  askToPriorRaiseMultiple: TracedMetric;
}

export interface CheckOutput {
  input: CheckInput;
  unit: CurrencyUnit;
  validation: ValidationResult;
  verdict: {
    level: VerdictLevel;
    headline: string;
    summary: string;
    reasons: VerdictReason[];
  };
  metrics: CheckMetrics;
  sensitivity: SensitivityRow[];
  feasibleAskBand: FeasibleAskBand;
}

export type GoalSeekTarget = 'max_ask' | 'required_revenue' | 'required_dilution';

export interface GoalSeekResult {
  target: GoalSeekTarget;
  targetGrowthMultiple: number;
  solvedValue: number | null;
  formattedSolvedValue: string;
  secondaryFormattedValue?: string;
  summary: string;
  formula: string;
  calculation: string;
  isFeasible: boolean;
  infeasibleReason?: string;
  feasibleAskBand: FeasibleAskBand;
}

export interface PresetScenario {
  id: string;
  name: string;
  shortLabel: string;
  description: string;
  unit: CurrencyUnit;
  input: CheckInput;
}

export interface AssumptionReference {
  id: string;
  parameter: string;
  defaultValue: string;
  origin: 'Source Article' | 'Source Article (Comments)' | 'Our Assumption';
  explanation: string;
}
