import { LABELS } from './labels';
import type {
  AskDilutionHeatmap,
  AskDilutionHeatmapCell,
  AskDilutionHeatmapRow,
  CheckInput,
  CheckMetrics,
  CheckOutput,
  CurrencyUnit,
  EffectiveVerdictBands,
  FeasibleAskBand,
  GoalSeekResult,
  GoalSeekTarget,
  OwnershipWaterfall,
  OwnershipWaterfallStep,
  SensitivityRow,
  ValidationIssue,
  ValidationResult,
  VerdictLevel,
  VerdictReason,
} from './types';
import {
  DEFAULT_FX_INR_PER_USD,
  formatMoney,
  formatMonthlyMoney,
  formatMultiple,
  formatNumber,
  formatPercent,
} from './units';

export function validateInput(input: CheckInput): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (!Number.isFinite(input.ask) || input.ask <= 0) {
    errors.push({
      field: 'ask',
      message: 'Enter an R1 ask greater than 0.',
    });
  }

  if (!Number.isFinite(input.dilutionPct) || input.dilutionPct <= 0) {
    errors.push({
      field: 'dilutionPct',
      message: 'R1 dilution must be above 0%.',
    });
  } else if (input.dilutionPct >= 100) {
    errors.push({
      field: 'dilutionPct',
      message: 'R1 dilution must be below 100%.',
    });
  } else if (input.dilutionPct > 40) {
    warnings.push({
      field: 'dilutionPct',
      message: `R1 dilution of ${formatPercent(input.dilutionPct, 1)} is high for an early round (usually 20% to 25%).`,
    });
  } else if (input.dilutionPct < 10) {
    warnings.push({
      field: 'dilutionPct',
      message: `R1 dilution of ${formatPercent(input.dilutionPct, 1)} is below the usual 20% to 25% institutional range.`,
    });
  }

  if (!Number.isFinite(input.annualRevenue) || input.annualRevenue < 0) {
    errors.push({
      field: 'annualRevenue',
      message: 'Annual revenue cannot be negative.',
    });
  }

  if (!Number.isFinite(input.priorRaise) || input.priorRaise < 0) {
    errors.push({
      field: 'priorRaise',
      message: 'R0 raise cannot be negative (use 0 if none).',
    });
  }

  if (!Number.isFinite(input.stepUpMultiple) || input.stepUpMultiple < 1) {
    errors.push({
      field: 'stepUpMultiple',
      message: 'R2 step-up must be at least 1.0x (benchmark is 2.0x).',
    });
  }

  if (!Number.isFinite(input.nextRoundMultiple) || input.nextRoundMultiple <= 0) {
    errors.push({
      field: 'nextRoundMultiple',
      message: 'R2 revenue multiple must be greater than 0x.',
    });
  }

  if (!Number.isFinite(input.monthsToNextRound) || input.monthsToNextRound < 1) {
    errors.push({
      field: 'monthsToNextRound',
      message: 'Months to R2 must be at least 1.',
    });
  } else if (input.monthsToNextRound > 60) {
    warnings.push({
      field: 'monthsToNextRound',
      message: 'A runway over 60 months sits outside normal venture round staging.',
    });
  }

  if (!Number.isFinite(input.cashNeeded) || input.cashNeeded < 0) {
    errors.push({
      field: 'cashNeeded',
      message: 'Cash needed cannot be negative.',
    });
  }

  if (
    input.monthlyBurn !== undefined &&
    (!Number.isFinite(input.monthlyBurn) || input.monthlyBurn < 0)
  ) {
    errors.push({
      field: 'monthlyBurn',
      message: 'Monthly net burn cannot be negative.',
    });
  }

  if (!Number.isFinite(input.esopTopUpPct) || input.esopTopUpPct < 0) {
    errors.push({
      field: 'esopTopUpPct',
      message: 'ESOP top-up cannot be negative.',
    });
  } else if (input.esopTopUpPct > 50) {
    errors.push({
      field: 'esopTopUpPct',
      message: 'ESOP top-up cannot exceed 50% of R1 post-money.',
    });
  }

  if (
    Number.isFinite(input.dilutionPct) &&
    Number.isFinite(input.esopTopUpPct) &&
    input.dilutionPct > 0 &&
    input.dilutionPct < 100 &&
    input.esopTopUpPct >= 0 &&
    input.dilutionPct + input.esopTopUpPct >= 100
  ) {
    errors.push({
      field: 'esopAndDilution',
      message: `R1 dilution (${formatPercent(input.dilutionPct, 1)}) plus ESOP top-up (${formatPercent(input.esopTopUpPct, 1)}) totals ${formatPercent(input.dilutionPct + input.esopTopUpPct, 1)}, leaving nothing for existing shareholders.`,
    });
  }

  if (
    !Number.isFinite(input.verdictBands.reachableMax) ||
    !Number.isFinite(input.verdictBands.stretchMax) ||
    input.verdictBands.reachableMax <= 0 ||
    input.verdictBands.stretchMax <= input.verdictBands.reachableMax
  ) {
    errors.push({
      field: 'verdictBands',
      message: 'Pricing band thresholds must have 0 < lower growth threshold < upper growth threshold.',
    });
  }

  if (
    input.priorDilutionPct !== undefined &&
    (!Number.isFinite(input.priorDilutionPct) ||
      input.priorDilutionPct < 0 ||
      input.priorDilutionPct >= 90)
  ) {
    errors.push({
      field: 'priorDilutionPct',
      message: 'R0 dilution must be between 0% and 89.9%.',
    });
  }

  if (
    input.nextRoundDilutionPct !== undefined &&
    (!Number.isFinite(input.nextRoundDilutionPct) ||
      input.nextRoundDilutionPct <= 0 ||
      input.nextRoundDilutionPct >= 90)
  ) {
    errors.push({
      field: 'nextRoundDilutionPct',
      message: 'Illustrative R2 dilution must be between 0.1% and 89.9%.',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function computeRowForDilution(
  ask: number,
  dilutionPct: number,
  annualRevenue: number,
  stepUpMultiple: number,
  nextRoundMultiple: number
) {
  const dilutionFraction = dilutionPct / 100;
  const postMoney = ask / dilutionFraction;
  const preMoney = postMoney - ask;
  const impliedPostMultiple = annualRevenue > 0 ? postMoney / annualRevenue : null;
  const impliedPreMultiple = annualRevenue > 0 ? preMoney / annualRevenue : null;
  const nextPreMoney = postMoney * stepUpMultiple;
  const requiredAnnualRevenue = nextPreMoney / nextRoundMultiple;
  const requiredMonthlyRevenue = requiredAnnualRevenue / 12;
  const requiredGrowthMultiple =
    annualRevenue > 0 ? requiredAnnualRevenue / annualRevenue : null;

  return {
    postMoney,
    preMoney,
    impliedPostMultiple,
    impliedPreMultiple,
    nextPreMoney,
    requiredAnnualRevenue,
    requiredMonthlyRevenue,
    requiredGrowthMultiple,
  };
}

export function computeEffectiveVerdictBands(input: CheckInput): EffectiveVerdictBands {
  const months =
    Number.isFinite(input.monthsToNextRound) && input.monthsToNextRound >= 1
      ? input.monthsToNextRound
      : 18;
  const reachBase =
    Number.isFinite(input.verdictBands.reachableMax) && input.verdictBands.reachableMax > 0
      ? input.verdictBands.reachableMax
      : 3.0;
  const stretchBase =
    Number.isFinite(input.verdictBands.stretchMax) && input.verdictBands.stretchMax > reachBase
      ? input.verdictBands.stretchMax
      : 5.0;

  return {
    reachableMax: Math.pow(reachBase, months / 18),
    stretchMax: Math.pow(stretchBase, months / 18),
    reachableCagrPct: (Math.pow(reachBase, 12 / 18) - 1) * 100,
    stretchCagrPct: (Math.pow(stretchBase, 12 / 18) - 1) * 100,
    monthsToNextRound: months,
  };
}

export function computeFeasibleAskBand(input: CheckInput): FeasibleAskBand {
  const { annualRevenue, dilutionPct, stepUpMultiple, nextRoundMultiple, priorRaise, priorRaiseWasPriced } = input;
  const effBands = computeEffectiveVerdictBands(input);
  const dilutionFraction = dilutionPct > 0 && dilutionPct < 100 ? dilutionPct / 100 : 0;

  if (
    annualRevenue <= 0 ||
    dilutionFraction <= 0 ||
    stepUpMultiple < 1 ||
    nextRoundMultiple <= 0
  ) {
    return {
      reachableAsk: 0,
      stretchAsk: 0,
      priorRaiseBand:
        priorRaise > 0 && priorRaiseWasPriced ? [priorRaise * 3, priorRaise * 4] : null,
    };
  }

  const reachableNextPre = annualRevenue * effBands.reachableMax * nextRoundMultiple;
  const reachablePost = reachableNextPre / stepUpMultiple;
  const reachableAsk = reachablePost * dilutionFraction;

  const stretchNextPre = annualRevenue * effBands.stretchMax * nextRoundMultiple;
  const stretchPost = stretchNextPre / stepUpMultiple;
  const stretchAsk = stretchPost * dilutionFraction;

  const priorRaiseBand: [number, number] | null =
    priorRaise > 0 && priorRaiseWasPriced ? [priorRaise * 3, priorRaise * 4] : null;

  return {
    reachableAsk,
    stretchAsk,
    priorRaiseBand,
  };
}

export function evaluateAsk(
  input: CheckInput,
  unit: CurrencyUnit = 'INR_CR',
  fxInrPerUsd = DEFAULT_FX_INR_PER_USD
): CheckOutput {
  const fmtM = (v: number | null | undefined, maxDecimals?: number) =>
    formatMoney(v, unit, maxDecimals, fxInrPerUsd);
  const fmtMM = (v: number | null | undefined) =>
    formatMonthlyMoney(v, unit, fxInrPerUsd);

  const validation = validateInput(input);
  const effBands = computeEffectiveVerdictBands(input);
  const feasibleAskBand = computeFeasibleAskBand(input);

  if (!validation.valid) {
    const emptyMetric = (
      id: string,
      label: string,
      formula: string,
      isAssumption = false,
      assumptionOrigin: string = LABELS.ruleOfThumbTag
    ) => ({
      id,
      label,
      value: null,
      formattedValue: '-',
      subtitle: 'Fix input errors to calculate',
      formula,
      calculation: 'Waiting for valid inputs',
      isAssumption,
      assumptionOrigin,
    });

    const metrics: CheckMetrics = {
      impliedPostMoney: emptyMetric('impliedPostMoney', 'R1 post-money', 'R1 Ask ÷ (R1 Dilution % ÷ 100)'),
      impliedPreMoney: emptyMetric('impliedPreMoney', 'R1 pre-money', 'R1 Post-Money − R1 Ask'),
      effectivePreMoneyAfterEsop: emptyMetric(
        'effectivePreMoneyAfterEsop',
        'Effective R1 pre-money (after ESOP)',
        'R1 Pre-Money − (R1 Post-Money × ESOP % ÷ 100)'
      ),
      impliedPostRevenueMultiple: emptyMetric(
        'impliedPostRevenueMultiple',
        'R1 revenue multiple (post)',
        'R1 Post-Money ÷ Current ARR'
      ),
      impliedPreRevenueMultiple: emptyMetric(
        'impliedPreRevenueMultiple',
        'R1 revenue multiple (pre)',
        'R1 Pre-Money ÷ Current ARR'
      ),
      nextRoundPreMoney: emptyMetric(
        'nextRoundPreMoney',
        'R2 pre-money',
        'R1 Post-Money × R2 Step-Up'
      ),
      requiredNextAnnualRevenue: emptyMetric(
        'requiredNextAnnualRevenue',
        'Required R2 ARR',
        'R2 Pre-Money ÷ R2 Multiple',
        true
      ),
      requiredNextMonthlyRevenue: emptyMetric(
        'requiredNextMonthlyRevenue',
        'Required R2 monthly revenue',
        'Required R2 ARR ÷ 12'
      ),
      requiredGrowthMultiple: emptyMetric(
        'requiredGrowthMultiple',
        'Growth needed',
        'Required R2 ARR ÷ Current ARR'
      ),
      impliedCagrPct: emptyMetric(
        'impliedCagrPct',
        'Implied annual CAGR',
        '(Growth Needed ^ (12 ÷ Months)) − 1',
        true
      ),
      impliedCmgrPct: emptyMetric(
        'impliedCmgrPct',
        'Implied monthly CMGR',
        '(Growth Needed ^ (1 ÷ Months)) − 1',
        true
      ),
      fundingGap: emptyMetric(
        'fundingGap',
        'Burn shortfall',
        'max(0, (Monthly Burn × Months) − R1 Ask)'
      ),
      askToPriorRaiseMultiple: emptyMetric(
        'askToPriorRaiseMultiple',
        'R1 ask vs. R0 raise',
        'R1 Ask ÷ R0 Raise'
      ),
    };

    return {
      input,
      unit,
      validation,
      verdict: {
        level: 'invalid',
        headline: 'Check input values to run the pricing check',
        summary: validation.errors.map((e) => e.message).join(' '),
        reasons: validation.errors.map((e, idx) => ({
          id: `err_${idx}`,
          text: e.message,
          tone: 'bad',
          isAssumption: false,
          origin: 'Input validation',
        })),
      },
      metrics,
      sensitivity: [],
      feasibleAskBand,
      effectiveVerdictBands: effBands,
    };
  }

  const {
    ask,
    dilutionPct,
    annualRevenue,
    priorRaise,
    priorRaiseWasPriced,
    stepUpMultiple,
    nextRoundMultiple,
    monthsToNextRound,
    cashNeeded,
    esopTopUpPct,
  } = input;

  const monthlyBurn = input.monthlyBurn ?? 0;
  const effectiveCashNeeded = monthlyBurn > 0 ? monthlyBurn * monthsToNextRound : cashNeeded;

  const core = computeRowForDilution(
    ask,
    dilutionPct,
    annualRevenue,
    stepUpMultiple,
    nextRoundMultiple
  );

  const esopPoolValue = core.postMoney * (esopTopUpPct / 100);
  const effectivePreMoney = core.preMoney - esopPoolValue;

  const cagr =
    core.requiredGrowthMultiple !== null && core.requiredGrowthMultiple > 0
      ? Math.pow(core.requiredGrowthMultiple, 12 / monthsToNextRound) - 1
      : null;

  const cmgr =
    core.requiredGrowthMultiple !== null && core.requiredGrowthMultiple > 0
      ? Math.pow(core.requiredGrowthMultiple, 1 / monthsToNextRound) - 1
      : null;

  const rawGap = effectiveCashNeeded > 0 ? effectiveCashNeeded - ask : null;
  const fundingGapVal = rawGap !== null ? Math.max(0, rawGap) : null;
  const askToPrior = priorRaise > 0 ? ask / priorRaise : null;

  const metrics: CheckMetrics = {
    impliedPostMoney: {
      id: 'impliedPostMoney',
      label: 'R1 post-money',
      value: core.postMoney,
      formattedValue: fmtM(core.postMoney),
      subtitle: `R1 ask ÷ ${formatPercent(dilutionPct, 1)} dilution`,
      formula: 'R1 Post-Money = R1 Ask ÷ (R1 Dilution % ÷ 100)',
      calculation: `${fmtM(ask)} ÷ ${(dilutionPct / 100).toFixed(4).replace(/\.?0+$/, '')} = ${fmtM(core.postMoney)}`,
      isAssumption: false,
      assumptionOrigin: LABELS.ruleOfThumbTag,
    },
    impliedPreMoney: {
      id: 'impliedPreMoney',
      label: 'R1 pre-money',
      value: core.preMoney,
      formattedValue: fmtM(core.preMoney),
      subtitle: 'R1 post-money − R1 ask',
      formula: 'R1 Pre-Money = R1 Post-Money − R1 Ask',
      calculation: `${fmtM(core.postMoney)} − ${fmtM(ask)} = ${fmtM(core.preMoney)}`,
      isAssumption: false,
      assumptionOrigin: LABELS.ruleOfThumbTag,
    },
    effectivePreMoneyAfterEsop: {
      id: 'effectivePreMoneyAfterEsop',
      label: 'Effective R1 pre-money (after ESOP)',
      value: effectivePreMoney,
      formattedValue: fmtM(effectivePreMoney),
      subtitle:
        esopTopUpPct > 0
          ? `after ${formatPercent(esopTopUpPct, 1)} ESOP pool (${fmtM(esopPoolValue)})`
          : 'no ESOP pool created this round',
      formula: 'Effective R1 Pre-Money = R1 Pre-Money − (R1 Post-Money × ESOP % ÷ 100)',
      calculation: `${fmtM(core.preMoney)} − (${fmtM(core.postMoney)} × ${(esopTopUpPct / 100).toFixed(4).replace(/\.?0+$/, '')}) = ${fmtM(effectivePreMoney)}`,
      isAssumption: false,
      assumptionOrigin: LABELS.ruleOfThumbTag,
    },
    impliedPostRevenueMultiple: {
      id: 'impliedPostRevenueMultiple',
      label: 'R1 revenue multiple',
      value: core.impliedPostMultiple,
      formattedValue:
        core.impliedPostMultiple !== null
          ? `${formatMultiple(core.impliedPostMultiple, 1)} post`
          : 'Pre-revenue',
      subtitle:
        core.impliedPreMultiple !== null
          ? `${formatMultiple(core.impliedPreMultiple, 1)} pre-money ÷ ARR`
          : 'R1 post-money ÷ current ARR',
      formula:
        'R1 Post Multiple = R1 Post-Money ÷ ARR | R1 Pre Multiple = R1 Pre-Money ÷ ARR',
      calculation:
        core.impliedPostMultiple !== null && core.impliedPreMultiple !== null
          ? `Post: ${fmtM(core.postMoney)} ÷ ${fmtM(annualRevenue)} = ${formatMultiple(core.impliedPostMultiple, 2)} | Pre: ${fmtM(core.preMoney)} ÷ ${fmtM(annualRevenue)} = ${formatMultiple(core.impliedPreMultiple, 2)}`
          : 'Pre-revenue (ARR = 0)',
      isAssumption: false,
      assumptionOrigin: LABELS.ruleOfThumbTag,
    },
    impliedPreRevenueMultiple: {
      id: 'impliedPreRevenueMultiple',
      label: 'R1 pre-money multiple',
      value: core.impliedPreMultiple,
      formattedValue:
        core.impliedPreMultiple !== null
          ? formatMultiple(core.impliedPreMultiple, 1)
          : 'Pre-revenue',
      subtitle: 'R1 pre-money ÷ current ARR',
      formula: 'R1 Pre-Money Multiple = R1 Pre-Money ÷ Current ARR',
      calculation:
        core.impliedPreMultiple !== null
          ? `${fmtM(core.preMoney)} ÷ ${fmtM(annualRevenue)} = ${formatMultiple(core.impliedPreMultiple, 2)}`
          : 'Pre-revenue (ARR = 0)',
      isAssumption: false,
      assumptionOrigin: LABELS.ruleOfThumbTag,
    },
    nextRoundPreMoney: {
      id: 'nextRoundPreMoney',
      label: 'R2 pre-money',
      value: core.nextPreMoney,
      formattedValue: fmtM(core.nextPreMoney),
      subtitle: `${formatMultiple(stepUpMultiple, 1)} R1 post-money`,
      formula: 'R2 Pre-Money = R1 Post-Money × R2 Step-Up',
      calculation: `${fmtM(core.postMoney)} × ${formatMultiple(stepUpMultiple, 2)} = ${fmtM(core.nextPreMoney)}`,
      isAssumption: stepUpMultiple !== 2,
      assumptionOrigin: LABELS.ruleOfThumbTag,
    },
    requiredNextAnnualRevenue: {
      id: 'requiredNextAnnualRevenue',
      label: 'Required R2 ARR',
      value: core.requiredAnnualRevenue,
      formattedValue: fmtM(core.requiredAnnualRevenue),
      subtitle: `${fmtMM(core.requiredMonthlyRevenue)} at ${formatMultiple(nextRoundMultiple, 1)} R2`,
      formula: 'Required R2 ARR = R2 Pre-Money ÷ R2 Multiple',
      calculation: `${fmtM(core.nextPreMoney)} ÷ ${formatMultiple(nextRoundMultiple, 2)} = ${fmtM(core.requiredAnnualRevenue)} (${fmtMM(core.requiredMonthlyRevenue)})`,
      isAssumption: true,
      assumptionOrigin: LABELS.ruleOfThumbTag,
    },
    requiredNextMonthlyRevenue: {
      id: 'requiredNextMonthlyRevenue',
      label: 'Required R2 monthly revenue',
      value: core.requiredMonthlyRevenue,
      formattedValue: fmtMM(core.requiredMonthlyRevenue),
      subtitle: 'required R2 ARR ÷ 12',
      formula: 'Required R2 Monthly Revenue = Required R2 ARR ÷ 12',
      calculation: `${fmtM(core.requiredAnnualRevenue)} ÷ 12 = ${fmtMM(core.requiredMonthlyRevenue)}`,
      isAssumption: false,
      assumptionOrigin: LABELS.ruleOfThumbTag,
    },
    requiredGrowthMultiple: {
      id: 'requiredGrowthMultiple',
      label: 'Growth needed',
      value: core.requiredGrowthMultiple,
      formattedValue:
        core.requiredGrowthMultiple !== null
          ? formatMultiple(core.requiredGrowthMultiple, 1)
          : 'Pre-revenue',
      subtitle:
        cagr !== null
          ? `${formatPercent(cagr * 100, 0)}/yr (${formatPercent((cmgr ?? 0) * 100, 1)}/mo) over ${formatNumber(monthsToNextRound, 0)} mo`
          : 'requires positive ARR',
      formula: 'Growth Multiple = Required R2 ARR ÷ Current ARR',
      calculation:
        core.requiredGrowthMultiple !== null
          ? `${fmtM(core.requiredAnnualRevenue)} ÷ ${fmtM(annualRevenue)} = ${formatMultiple(core.requiredGrowthMultiple, 2)}`
          : 'Pre-revenue (ARR = 0)',
      isAssumption: false,
      assumptionOrigin: LABELS.ruleOfThumbTag,
    },
    impliedCagrPct: {
      id: 'impliedCagrPct',
      label: 'Implied annual CAGR',
      value: cagr !== null ? cagr * 100 : null,
      formattedValue: cagr !== null ? `${formatPercent(cagr * 100, 0)}/yr` : '-',
      subtitle: `over ${formatNumber(monthsToNextRound, 0)} months`,
      formula: 'Annual CAGR = (Growth Multiple ^ (12 ÷ Months)) − 1',
      calculation:
        cagr !== null && core.requiredGrowthMultiple !== null
          ? `(${core.requiredGrowthMultiple.toFixed(2)} ^ (12 ÷ ${monthsToNextRound})) − 1 = ${formatPercent(cagr * 100, 1)}`
          : 'Pre-revenue (ARR = 0)',
      isAssumption: true,
      assumptionOrigin: LABELS.ruleOfThumbTag,
    },
    impliedCmgrPct: {
      id: 'impliedCmgrPct',
      label: 'Implied monthly CMGR',
      value: cmgr !== null ? cmgr * 100 : null,
      formattedValue: cmgr !== null ? `${formatPercent(cmgr * 100, 1)}/mo` : '-',
      subtitle: `compounded monthly for ${formatNumber(monthsToNextRound, 0)} mo`,
      formula: 'Monthly CMGR = (Growth Multiple ^ (1 ÷ Months)) − 1',
      calculation:
        cmgr !== null && core.requiredGrowthMultiple !== null
          ? `(${core.requiredGrowthMultiple.toFixed(2)} ^ (1 ÷ ${monthsToNextRound})) − 1 = ${formatPercent(cmgr * 100, 2)}`
          : 'Pre-revenue (ARR = 0)',
      isAssumption: true,
      assumptionOrigin: LABELS.ruleOfThumbTag,
    },
    fundingGap: {
      id: 'fundingGap',
      label: 'Burn shortfall',
      value: fundingGapVal,
      formattedValue:
        effectiveCashNeeded > 0
          ? fundingGapVal && fundingGapVal > 0
            ? fmtM(fundingGapVal)
            : 'None'
          : 'Not set',
      subtitle:
        effectiveCashNeeded > 0
          ? rawGap !== null && rawGap < 0
            ? `${fmtM(Math.abs(rawGap))} buffer above ${fmtM(effectiveCashNeeded)} cash need`
            : `burn plan needs ${fmtM(effectiveCashNeeded)}`
          : 'optional monthly burn unset',
      formula:
        monthlyBurn > 0
          ? 'Burn Shortfall = max(0, (Monthly Burn × Months) − R1 Ask)'
          : 'Burn Shortfall = max(0, Cash Needed − R1 Ask)',
      calculation:
        monthlyBurn > 0
          ? `${fmtM(monthlyBurn)}/mo × ${monthsToNextRound} mo = ${fmtM(effectiveCashNeeded)}; ${fmtM(effectiveCashNeeded)} − ${fmtM(ask)} = ${fmtM(rawGap ?? 0)}`
          : effectiveCashNeeded > 0
            ? `${fmtM(effectiveCashNeeded)} − ${fmtM(ask)} = ${fmtM(rawGap ?? 0)}`
            : 'Monthly burn is unset (optional field)',
      isAssumption: false,
      assumptionOrigin: LABELS.ruleOfThumbTag,
    },
    askToPriorRaiseMultiple: {
      id: 'askToPriorRaiseMultiple',
      label: 'R1 ask vs. R0 raise',
      value: askToPrior,
      formattedValue:
        askToPrior !== null
          ? `${formatMultiple(askToPrior, 1)} (${priorRaiseWasPriced ? 'usual 3x to 4x' : 'unpriced R0'})`
          : 'No R0 raise',
      subtitle:
        priorRaise > 0
          ? `R0 raise: ${fmtM(priorRaise)}`
          : 'enter R0 raise if applicable',
      formula: 'R1 Ask vs. R0 Raise = R1 Ask ÷ R0 Raise',
      calculation:
        askToPrior !== null
          ? `${fmtM(ask)} ÷ ${fmtM(priorRaise)} = ${formatMultiple(askToPrior, 2)}`
          : 'R0 raise is 0',
      isAssumption: false,
      assumptionOrigin: LABELS.ruleOfThumbTag,
    },
  };

  // Build Pricing Check Headline & Diagnostic Reasons
  let level: VerdictLevel;
  let headline: string;
  const reasons: VerdictReason[] = [];

  if (annualRevenue <= 0 || core.requiredGrowthMultiple === null) {
    level = 'incomplete';
    headline = LABELS.preRevenueHeadline;
    reasons.push({
      id: 'valuation_signal',
      text: `Your ${fmtM(ask)} R1 ask at ${formatPercent(dilutionPct, 1)} dilution implies ${fmtM(core.postMoney)} post-money (${fmtM(core.preMoney)} pre-money). R2 pre-money must reach ${fmtM(core.nextPreMoney)}, or ${fmtM(core.requiredAnnualRevenue)} ARR at a ${formatMultiple(nextRoundMultiple, 1)} R2 multiple.`,
      tone: 'neutral',
      isAssumption: false,
      origin: LABELS.ruleOfThumbTag,
    });
    reasons.push({
      id: 'missing_revenue',
      text: LABELS.preRevenueMessage,
      tone: 'neutral',
      isAssumption: false,
      origin: LABELS.ruleOfThumbTag,
    });
  } else {
    const gx = core.requiredGrowthMultiple;
    if (gx <= effBands.reachableMax) {
      level = 'reachable';
    } else if (gx <= effBands.stretchMax) {
      level = 'stretch';
    } else {
      level = 'stiff';
    }
    headline = LABELS.headline(formatMultiple(gx, 1), formatNumber(monthsToNextRound, 0));

    reasons.push({
      id: 'valuation_signal',
      text: `Your ${fmtM(ask)} R1 ask at ${formatPercent(dilutionPct, 1)} dilution sets a ${fmtM(core.postMoney)} post-money (${fmtM(core.preMoney)} pre-money). That is ${formatMultiple(core.impliedPostMultiple, 1)} post-money (${formatMultiple(core.impliedPreMultiple, 1)} pre-money) on your ${fmtM(annualRevenue)} ARR.`,
      tone: level === 'reachable' ? 'good' : level === 'stretch' ? 'warn' : 'bad',
      isAssumption: false,
      origin: LABELS.ruleOfThumbTag,
    });

    // Fixed Multiple Compression Check: compare R1 multiple against R2 multiple
    if (core.impliedPostMultiple !== null && core.impliedPostMultiple > nextRoundMultiple) {
      const preCompressionNote =
        core.impliedPreMultiple !== null && core.impliedPreMultiple > nextRoundMultiple
          ? `Your R1 multiple (${formatMultiple(core.impliedPostMultiple, 1)} post, ${formatMultiple(core.impliedPreMultiple, 1)} pre) sits above your ${formatMultiple(nextRoundMultiple, 1)} R2 multiple.`
          : `Your R1 post-money multiple (${formatMultiple(core.impliedPostMultiple, 1)}) sits above your ${formatMultiple(nextRoundMultiple, 1)} R2 multiple.`;

      reasons.push({
        id: 'multiple_compression',
        text: `${preCompressionNote} Because multiples drop as you scale, revenue must grow ${formatMultiple(gx, 1)} to earn a ${formatMultiple(stepUpMultiple, 1)} step-up.`,
        tone: gx > effBands.reachableMax ? 'warn' : 'neutral',
        isAssumption: false,
        origin: LABELS.ruleOfThumbTag,
      });
    } else if (
      core.impliedPostMultiple !== null &&
      core.impliedPostMultiple <= nextRoundMultiple
    ) {
      reasons.push({
        id: 'no_compression',
        text: `Your R1 post-money multiple (${formatMultiple(core.impliedPostMultiple, 1)}) is at or below your ${formatMultiple(nextRoundMultiple, 1)} R2 multiple. You have no multiple compression headwind.`,
        tone: 'good',
        isAssumption: false,
        origin: LABELS.ruleOfThumbTag,
      });
    }
  }

  // Burn / Cash Needed Check
  if (effectiveCashNeeded > 0) {
    const burnPrefix =
      monthlyBurn > 0
        ? `At ${fmtM(monthlyBurn)}/mo burn over ${formatNumber(monthsToNextRound, 0)} mo (${fmtM(effectiveCashNeeded)} total), your ${fmtM(ask)} ask`
        : `Your ${fmtM(ask)} R1 ask`;

    if (effectiveCashNeeded > ask) {
      const gap = effectiveCashNeeded - ask;
      reasons.push({
        id: 'funding_shortfall',
        text: `${burnPrefix} leaves a ${fmtM(gap)} shortfall. Raise more, accept higher dilution, or trim monthly burn.`,
        tone: 'bad',
        isAssumption: false,
        origin: LABELS.ruleOfThumbTag,
      });
    } else if (effectiveCashNeeded < ask) {
      const buffer = ask - effectiveCashNeeded;
      reasons.push({
        id: 'funding_buffer',
        text: `${burnPrefix} adds a ${fmtM(buffer)} cushion above planned cash need. Extra cash reduces execution risk, though it raises your R2 valuation bar.`,
        tone: 'good',
        isAssumption: false,
        origin: LABELS.ruleOfThumbTag,
      });
    } else {
      reasons.push({
        id: 'funding_exact',
        text: `${burnPrefix} matches your planned cash need exactly, leaving no buffer for delays.`,
        tone: 'neutral',
        isAssumption: false,
        origin: LABELS.ruleOfThumbTag,
      });
    }
  }

  // Previous Raise (R0) Check (respecting priorRaiseWasPriced switch)
  if (priorRaise > 0 && askToPrior !== null) {
    if (priorRaiseWasPriced) {
      if (askToPrior > 4) {
        reasons.push({
          id: 'prior_raise_high',
          text: `Your R1 ask is ${formatMultiple(askToPrior, 1)} your R0 priced raise (${fmtM(priorRaise)}). Early raises usually jump 3x to 4x (${fmtM(priorRaise * 3)} to ${fmtM(priorRaise * 4)}), so this needs standout traction.`,
          tone: 'warn',
          isAssumption: false,
          origin: LABELS.ruleOfThumbTag,
        });
      } else if (askToPrior < 3) {
        reasons.push({
          id: 'prior_raise_low',
          text: `Your R1 ask is ${formatMultiple(askToPrior, 1)} your R0 priced raise (${fmtM(priorRaise)}), below the usual 3x to 4x jump.`,
          tone: 'neutral',
          isAssumption: false,
          origin: LABELS.ruleOfThumbTag,
        });
      } else {
        reasons.push({
          id: 'prior_raise_ok',
          text: `Your R1 ask is ${formatMultiple(askToPrior, 1)} your R0 priced raise (${fmtM(priorRaise)}), inside the typical 3x to 4x range.`,
          tone: 'good',
          isAssumption: false,
          origin: LABELS.ruleOfThumbTag,
        });
      }
    } else {
      reasons.push({
        id: 'prior_raise_unpriced',
        text: `Your R0 capital (${fmtM(priorRaise)}) is marked as unpriced, so the 3x to 4x priced-round check does not apply.`,
        tone: 'neutral',
        isAssumption: false,
        origin: LABELS.ruleOfThumbTag,
      });
    }
  }

  // ESOP Pool Note
  if (esopTopUpPct > 0) {
    reasons.push({
      id: 'esop_impact',
      text: `A ${formatPercent(esopTopUpPct, 1)} ESOP pool (${fmtM(esopPoolValue)}) comes out of pre-money, lowering existing holders' effective R1 pre-money from ${fmtM(core.preMoney)} to ${fmtM(effectivePreMoney)}. Your R2 hurdle stays ${fmtM(core.nextPreMoney)}.`,
      tone: 'warn',
      isAssumption: false,
      origin: LABELS.ruleOfThumbTag,
    });
  }

  // Horizon Convention Note
  if (monthsToNextRound < 15 || monthsToNextRound > 18) {
    reasons.push({
      id: 'horizon_outside_benchmark',
      text: `A ${formatNumber(monthsToNextRound, 0)} month runway to R2 sits outside the usual 15 to 18 month seed cycle. Your annual growth target adjusts for the ${monthsToNextRound > 18 ? 'longer' : 'shorter'} timeline.`,
      tone: 'neutral',
      isAssumption: false,
      origin: LABELS.ruleOfThumbTag,
    });
  }

  // Dilution Sensitivity Table: 20%, 25%, 33%, plus user's custom dilution and a step-down if user's dilution is lowest
  const baseDilutions = [20, 25, 33];
  const dilutionSet = [...baseDilutions];
  if (!dilutionSet.some((d) => Math.abs(d - dilutionPct) < 0.05)) {
    dilutionSet.push(dilutionPct);
  }
  const hasLowerRow = dilutionSet.some((d) => d < dilutionPct - 0.05);
  let stepDownDilution: number | null = null;
  if (!hasLowerRow && dilutionPct > 1) {
    let stepDown: number;
    if (dilutionPct >= 10) {
      stepDown = Math.floor((dilutionPct - 5) / 5) * 5;
    } else if (dilutionPct > 5) {
      stepDown = 5;
    } else {
      stepDown = Math.max(1, Math.floor(dilutionPct / 2));
    }
    if (stepDown >= 1 && !dilutionSet.some((d) => Math.abs(d - stepDown) < 0.05)) {
      stepDownDilution = stepDown;
      dilutionSet.push(stepDown);
    }
  }
  const allDilutions = dilutionSet.sort((a, b) => a - b);

  const sensitivity: SensitivityRow[] = allDilutions.map((d) => {
    const isUserSelected = Math.abs(d - dilutionPct) < 0.05;
    const isStepDown = stepDownDilution !== null && Math.abs(d - stepDownDilution) < 0.05;
    const row = computeRowForDilution(
      ask,
      d,
      annualRevenue,
      stepUpMultiple,
      nextRoundMultiple
    );
    let note = '';
    if (isUserSelected) note = `${formatMultiple(100 / d, 1)} ask (your input)`;
    else if (isStepDown) note = `${formatMultiple(100 / d, 1)} ask (step-down from your input)`;
    else if (Math.abs(d - 20) < 0.05) note = '5x ask (standard low dilution)';
    else if (Math.abs(d - 25) < 0.05) note = '4x ask (standard high dilution)';
    else if (Math.abs(d - 33) < 0.05) note = '~3x ask (very high for early stage)';
    else note = `${formatMultiple(100 / d, 1)} ask`;

    return {
      dilutionPct: d,
      isUserSelected,
      note,
      ...row,
    };
  });

  return {
    input,
    unit,
    validation,
    verdict: {
      level,
      headline,
      summary: reasons.map((r) => r.text).join(' '),
      reasons,
    },
    metrics,
    sensitivity,
    feasibleAskBand,
    effectiveVerdictBands: effBands,
  };
}

export function solveGoalSeek(
  input: CheckInput,
  target: GoalSeekTarget,
  targetGrowthMultiple?: number,
  unit: CurrencyUnit = 'INR_CR',
  fxInrPerUsd = DEFAULT_FX_INR_PER_USD
): GoalSeekResult {
  const fmtM = (v: number | null | undefined, maxDecimals?: number) =>
    formatMoney(v, unit, maxDecimals, fxInrPerUsd);
  const fmtMM = (v: number | null | undefined) =>
    formatMonthlyMoney(v, unit, fxInrPerUsd);

  const effBands = computeEffectiveVerdictBands(input);
  const gMax =
    targetGrowthMultiple !== undefined && targetGrowthMultiple > 0
      ? targetGrowthMultiple
      : effBands.reachableMax;

  const feasibleAskBand = computeFeasibleAskBand(input);
  const { ask, dilutionPct, annualRevenue, stepUpMultiple, nextRoundMultiple } = input;
  const dFrac = dilutionPct / 100;

  if (stepUpMultiple < 1 || nextRoundMultiple <= 0 || gMax <= 0) {
    return {
      target,
      targetGrowthMultiple: gMax,
      solvedValue: null,
      formattedSolvedValue: '-',
      summary: 'Enter a valid R2 step-up and multiple to run Goal-Seek.',
      formula: '',
      calculation: '',
      isFeasible: false,
      infeasibleReason: 'Invalid R2 step-up or multiple.',
      feasibleAskBand,
    };
  }

  if (target === 'max_ask') {
    if (annualRevenue <= 0 || dFrac <= 0 || dFrac >= 1) {
      return {
        target,
        targetGrowthMultiple: gMax,
        solvedValue: null,
        formattedSolvedValue: '-',
        summary: 'Pre-revenue (ARR = 0): revenue goal-seek applies once annual revenue is positive.',
        formula: 'Max R1 Ask = Current ARR × Target Growth × R2 Multiple × (R1 Dilution ÷ R2 Step-Up)',
        calculation: 'Pre-revenue (ARR = 0) and dilution in (0%, 100%)',
        isFeasible: false,
        infeasibleReason: 'Requires current annual revenue > 0.',
        feasibleAskBand,
      };
    }
    const maxNextPre = annualRevenue * gMax * nextRoundMultiple;
    const maxPost = maxNextPre / stepUpMultiple;
    const maxAsk = maxPost * dFrac;

    return {
      target,
      targetGrowthMultiple: gMax,
      solvedValue: maxAsk,
      formattedSolvedValue: fmtM(maxAsk),
      secondaryFormattedValue: `${fmtM(maxPost)} R1 post-money`,
      summary: `To cap required growth at ${formatMultiple(gMax, 1)} (with ${formatPercent(dilutionPct, 1)} R1 dilution and a ${formatMultiple(nextRoundMultiple, 1)} R2 multiple), keep your R1 ask at or below ${fmtM(maxAsk)}. That sets ${fmtM(maxPost)} post-money.`,
      formula: 'Max R1 Ask = Current ARR × Target Growth × R2 Multiple × (R1 Dilution % ÷ 100) ÷ R2 Step-Up',
      calculation: `${fmtM(annualRevenue)} × ${formatMultiple(gMax, 2)} × ${formatMultiple(nextRoundMultiple, 2)} × ${(dFrac).toFixed(4).replace(/\.?0+$/, '')} ÷ ${formatMultiple(stepUpMultiple, 2)} = ${fmtM(maxAsk)}`,
      isFeasible: maxAsk > 0,
      feasibleAskBand,
    };
  }

  if (target === 'required_revenue') {
    if (ask <= 0 || dFrac <= 0 || dFrac >= 1) {
      return {
        target,
        targetGrowthMultiple: gMax,
        solvedValue: null,
        formattedSolvedValue: '-',
        summary: 'Enter an R1 ask and dilution to solve for required current revenue.',
        formula: 'Required Current ARR = (R1 Ask × R2 Step-Up) ÷ ((R1 Dilution % ÷ 100) × R2 Multiple × Target Growth)',
        calculation: 'Waiting for ask > 0 and dilution in (0%, 100%)',
        isFeasible: false,
        infeasibleReason: 'Requires positive ask and valid dilution.',
        feasibleAskBand,
      };
    }
    const postMoney = ask / dFrac;
    const nextPre = postMoney * stepUpMultiple;
    const reqNextArr = nextPre / nextRoundMultiple;
    const reqCurrentArr = reqNextArr / gMax;
    const reqCurrentMrr = reqCurrentArr / 12;

    return {
      target,
      targetGrowthMultiple: gMax,
      solvedValue: reqCurrentArr,
      formattedSolvedValue: fmtM(reqCurrentArr),
      secondaryFormattedValue: fmtMM(reqCurrentMrr),
      summary: `To support a ${fmtM(ask)} R1 ask at ${formatPercent(dilutionPct, 1)} dilution without exceeding ${formatMultiple(gMax, 1)} growth, you need ${fmtM(reqCurrentArr)} ARR today (${fmtMM(reqCurrentMrr)}).`,
      formula: 'Required Current ARR = (R1 Ask ÷ (R1 Dilution % ÷ 100)) × R2 Step-Up ÷ (R2 Multiple × Target Growth)',
      calculation: `${fmtM(reqNextArr)} R2 ARR ÷ ${formatMultiple(gMax, 2)} = ${fmtM(reqCurrentArr)} (${fmtMM(reqCurrentMrr)})`,
      isFeasible: reqCurrentArr > 0,
      feasibleAskBand,
    };
  }

  // target === 'required_dilution'
  if (ask <= 0 || annualRevenue <= 0) {
    return {
      target,
      targetGrowthMultiple: gMax,
      solvedValue: null,
      formattedSolvedValue: '-',
      summary: 'Enter a positive R1 ask and current ARR to solve for R1 dilution.',
      formula: 'Required R1 Dilution % = (R1 Ask × R2 Step-Up) ÷ (Current ARR × Target Growth × R2 Multiple) × 100',
      calculation: 'Waiting for ask > 0 and current revenue > 0',
      isFeasible: false,
      infeasibleReason: 'Requires positive ask and current revenue > 0.',
      feasibleAskBand,
    };
  }

  const maxNextPre = annualRevenue * gMax * nextRoundMultiple;
  const maxPost = maxNextPre / stepUpMultiple;
  const reqDilutionPct = (ask / maxPost) * 100;
  const isFeasible = reqDilutionPct > 0 && reqDilutionPct < 100 - input.esopTopUpPct;

  return {
    target,
    targetGrowthMultiple: gMax,
    solvedValue: reqDilutionPct,
    formattedSolvedValue: formatPercent(reqDilutionPct, 1),
    secondaryFormattedValue: `${fmtM(maxPost)} R1 post-money`,
    summary: isFeasible
      ? `To raise ${fmtM(ask)} on ${fmtM(annualRevenue)} ARR within ${formatMultiple(gMax, 1)} growth, R1 dilution must be ${formatPercent(reqDilutionPct, 1)}. That prices R1 at ${fmtM(maxPost)} post-money.`
      : `Even at 100% dilution, a ${fmtM(ask)} raise exceeds the ${fmtM(maxPost)} post-money backed by ${formatMultiple(gMax, 1)} growth (requires ${formatPercent(reqDilutionPct, 1)}). Lower the ask or grow revenue first.`,
    formula: 'Required R1 Dilution % = (R1 Ask ÷ ((Current ARR × Target Growth × R2 Multiple) ÷ R2 Step-Up)) × 100',
    calculation: `(${fmtM(ask)} ÷ ${fmtM(maxPost)} max R1 post-money) × 100 = ${formatPercent(reqDilutionPct, 2)}`,
    isFeasible,
    infeasibleReason: !isFeasible
      ? `Required dilution (${formatPercent(reqDilutionPct, 1)}) exceeds available equity.`
      : undefined,
    feasibleAskBand,
  };
}

const CLEAN_MANTISSAS = [1, 1.5, 2, 3, 4, 5, 6, 7.5, 10];

function snapToCleanStep(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 0;
  const exp = Math.floor(Math.log10(v));
  const pow10 = Math.pow(10, exp);
  const norm = v / pow10;
  let best = CLEAN_MANTISSAS[0]!;
  let bestDiff = Infinity;
  for (const m of CLEAN_MANTISSAS) {
    const diff = Math.abs(m - norm);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = m;
    }
  }
  return Number((best * pow10).toPrecision(4));
}

export function computeAskDilutionHeatmap(input: CheckInput): AskDilutionHeatmap {
  const validation = validateInput(input);
  if (!validation.valid || input.annualRevenue <= 0) {
    return {
      available: false,
      dilutions: [],
      currentDilutionPct: input.dilutionPct,
      rows: [],
    };
  }

  const d = Number(input.dilutionPct.toFixed(1));
  const baseCols = [15, 20, 25, 30];
  let candidates: number[];
  if (baseCols.some((c) => Math.abs(c - d) < 0.05)) {
    candidates = baseCols;
  } else if (d < 15) {
    const stepDown =
      d >= 10
        ? Math.floor((d - 5) / 5) * 5
        : d > 5
          ? 5
          : Math.max(1, Math.floor(d / 2));
    candidates = [stepDown, d, 20, 25, 15, 30];
  } else if (d > 30) {
    candidates = [20, 25, 30, d];
  } else {
    candidates = [20, 25, d, d < 22.5 ? 15 : 30];
  }

  const colSet: number[] = [];
  for (const c of candidates) {
    if (
      c > 0 &&
      c + input.esopTopUpPct < 100 &&
      !colSet.some((existing) => Math.abs(existing - c) < 0.05)
    ) {
      colSet.push(c);
      if (colSet.length >= 4) break;
    }
  }
  const dilutions = colSet.sort((a, b) => a - b);

  const band = computeFeasibleAskBand(input);
  const effBands = computeEffectiveVerdictBands(input);
  const r = band.reachableAsk;
  const s = band.stretchAsk;
  const a = input.ask;

  const chosen: number[] = [a];
  const tryAddAsk = (cand: number): void => {
    const clean = snapToCleanStep(cand);
    if (!Number.isFinite(clean) || clean <= 0 || chosen.length >= 5) return;
    if (chosen.every((x) => Math.abs(x - clean) / Math.max(x, clean) >= 0.18)) {
      chosen.push(clean);
    }
  };

  let priorityCandidates: number[];
  if (a > s * 1.15) {
    priorityCandidates = [r * 0.8, r, s, a * 1.4];
  } else if (a < r * 0.85) {
    priorityCandidates = [a * 0.75, r, s, s * 1.2];
  } else {
    priorityCandidates = [a * 0.75, r * 0.8, r, s, s * 1.2];
  }

  for (const cand of priorityCandidates) {
    tryAddAsk(cand);
  }
  for (const mult of [0.75, 0.5, 1.5, 2.0, 0.35, 3.0]) {
    if (chosen.length >= 5) break;
    tryAddAsk(a * mult);
  }
  for (const mult of [0.6, 1.25, 2.5, 0.25, 4.0]) {
    if (chosen.length >= 5) break;
    if (chosen.every((x) => Math.abs(x - snapToCleanStep(a * mult)) > 1e-6)) {
      tryAddAsk(a * mult);
    }
  }

  const rowAsks = chosen.slice(0, 5).sort((x, y) => x - y);
  const rows: AskDilutionHeatmapRow[] = rowAsks.map((rowAsk) => {
    const isCurrentAsk = Math.abs(rowAsk - a) < 1e-6;
    const cells: AskDilutionHeatmapCell[] = dilutions.map((colDil) => {
      const core = computeRowForDilution(
        rowAsk,
        colDil,
        input.annualRevenue,
        input.stepUpMultiple,
        input.nextRoundMultiple
      );
      const growth = core.requiredGrowthMultiple ?? 0;
      const impliedCagrPct =
        growth > 0 ? (Math.pow(growth, 12 / input.monthsToNextRound) - 1) * 100 : 0;
      const level: 'reachable' | 'stretch' | 'stiff' =
        growth <= effBands.reachableMax
          ? 'reachable'
          : growth <= effBands.stretchMax
            ? 'stretch'
            : 'stiff';
      const isCurrent = isCurrentAsk && Math.abs(colDil - input.dilutionPct) < 0.05;

      return {
        ask: rowAsk,
        dilutionPct: colDil,
        postMoney: core.postMoney,
        requiredGrowthMultiple: growth,
        impliedCagrPct,
        level,
        isCurrent,
      };
    });

    return {
      ask: rowAsk,
      isCurrentAsk,
      cells,
    };
  });

  return {
    available: true,
    dilutions,
    currentDilutionPct: input.dilutionPct,
    rows,
  };
}

export function computeOwnershipWaterfall(input: CheckInput): OwnershipWaterfall {
  const r0DilutionIsAssumed =
    input.priorDilutionPct === undefined && input.priorRaise > 0 && input.priorRaiseWasPriced;
  const r0DilutionPct =
    input.priorDilutionPct !== undefined ? input.priorDilutionPct : r0DilutionIsAssumed ? 15 : 0;
  const esopTopUpPct = input.esopTopUpPct;
  const r1DilutionPct = input.dilutionPct;
  const r2DilutionPct =
    input.nextRoundDilutionPct !== undefined ? input.nextRoundDilutionPct : 20;

  const valid =
    Number.isFinite(r0DilutionPct) &&
    r0DilutionPct >= 0 &&
    r0DilutionPct < 90 &&
    Number.isFinite(esopTopUpPct) &&
    esopTopUpPct >= 0 &&
    Number.isFinite(r1DilutionPct) &&
    r1DilutionPct > 0 &&
    r1DilutionPct < 100 &&
    esopTopUpPct + r1DilutionPct < 100 &&
    Number.isFinite(r2DilutionPct) &&
    r2DilutionPct > 0 &&
    r2DilutionPct < 90;

  if (!valid) {
    return {
      valid: false,
      r0DilutionPct: 0,
      r0DilutionIsAssumed: false,
      esopTopUpPct: 0,
      r1DilutionPct: 0,
      r2DilutionPct: 20,
      founderPreR1Pct: 0,
      founderPostR1Pct: 0,
      founderPostR2Pct: 0,
      r0InvestorPostR1Pct: 0,
      steps: [],
    };
  }

  const founderPreR1Pct = 100 - r0DilutionPct;
  const esopDrop = founderPreR1Pct * (esopTopUpPct / 100);
  const afterEsopPct = founderPreR1Pct - esopDrop;
  const r1Drop = founderPreR1Pct * (r1DilutionPct / 100);
  const founderPostR1Pct = afterEsopPct - r1Drop;
  const r0InvestorPostR1Pct = r0DilutionPct * (1 - (esopTopUpPct + r1DilutionPct) / 100);
  const r2Drop = founderPostR1Pct * (r2DilutionPct / 100);
  const founderPostR2Pct = founderPostR1Pct - r2Drop;

  const steps: OwnershipWaterfallStep[] = [
    {
      id: 'start',
      label: 'Start',
      sublabel: 'Founding',
      kind: 'total',
      startPct: 0,
      endPct: 100,
      deltaPct: 100,
      tone: 'neutral',
    },
  ];

  if (r0DilutionPct > 0) {
    steps.push({
      id: 'r0',
      label: 'R0 round',
      sublabel: r0DilutionIsAssumed ? '15% est.' : `${formatPercent(r0DilutionPct, 1)} R0`,
      kind: 'drop',
      startPct: founderPreR1Pct,
      endPct: 100,
      deltaPct: -r0DilutionPct,
      tone: 'bad',
    });
  }

  if (esopTopUpPct > 0) {
    steps.push({
      id: 'esop',
      label: 'R1 ESOP',
      sublabel: `${formatPercent(esopTopUpPct, 1)} pool`,
      kind: 'drop',
      startPct: afterEsopPct,
      endPct: founderPreR1Pct,
      deltaPct: -esopDrop,
      tone: 'warn',
    });
  }

  steps.push(
    {
      id: 'r1',
      label: 'R1 dilution',
      sublabel: `${formatPercent(r1DilutionPct, 1)} round`,
      kind: 'drop',
      startPct: founderPostR1Pct,
      endPct: afterEsopPct,
      deltaPct: -r1Drop,
      tone: 'bad',
    },
    {
      id: 'post_r1',
      label: 'Post R1',
      sublabel: 'Founder stake',
      kind: 'total',
      startPct: 0,
      endPct: founderPostR1Pct,
      deltaPct: founderPostR1Pct,
      tone: 'primary',
    },
    {
      id: 'r2',
      label: 'R2 (est.)',
      sublabel: `${formatPercent(r2DilutionPct, 1)} round`,
      kind: 'drop',
      startPct: founderPostR2Pct,
      endPct: founderPostR1Pct,
      deltaPct: -r2Drop,
      tone: 'warn',
    },
    {
      id: 'post_r2',
      label: 'Post R2',
      sublabel: 'Founder stake',
      kind: 'total',
      startPct: 0,
      endPct: founderPostR2Pct,
      deltaPct: founderPostR2Pct,
      tone: founderPostR2Pct >= 50 ? 'good' : 'warn',
    }
  );

  return {
    valid: true,
    r0DilutionPct,
    r0DilutionIsAssumed,
    esopTopUpPct,
    r1DilutionPct,
    r2DilutionPct,
    founderPreR1Pct,
    founderPostR1Pct,
    founderPostR2Pct,
    r0InvestorPostR1Pct,
    steps,
  };
}
