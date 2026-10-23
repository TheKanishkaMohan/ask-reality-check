import type {
  CheckInput,
  CheckMetrics,
  CheckOutput,
  CurrencyUnit,
  FeasibleAskBand,
  GoalSeekResult,
  GoalSeekTarget,
  SensitivityRow,
  ValidationIssue,
  ValidationResult,
  VerdictLevel,
  VerdictReason,
} from './types';
import {
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
      message: 'Enter a positive fundraise ask greater than 0.',
    });
  }

  if (!Number.isFinite(input.dilutionPct) || input.dilutionPct <= 0) {
    errors.push({
      field: 'dilutionPct',
      message: 'Dilution must be greater than 0% to imply a valuation.',
    });
  } else if (input.dilutionPct >= 100) {
    errors.push({
      field: 'dilutionPct',
      message: 'Dilution must be below 100% (existing shareholders cannot be diluted 100%+).',
    });
  } else if (input.dilutionPct > 40) {
    warnings.push({
      field: 'dilutionPct',
      message: `Dilution of ${formatPercent(input.dilutionPct, 1)} is unusually high for an early-stage round (typical band is 20%–25%, with 33% already considered very high).`,
    });
  } else if (input.dilutionPct < 10) {
    warnings.push({
      field: 'dilutionPct',
      message: `Dilution of ${formatPercent(input.dilutionPct, 1)} is well below the typical 20%–25% early-stage institutional band.`,
    });
  }

  if (!Number.isFinite(input.annualRevenue) || input.annualRevenue < 0) {
    errors.push({
      field: 'annualRevenue',
      message: 'Annualised revenue cannot be negative.',
    });
  }

  if (!Number.isFinite(input.priorRaise) || input.priorRaise < 0) {
    errors.push({
      field: 'priorRaise',
      message: 'Previous raise cannot be negative (use 0 if none).',
    });
  }

  if (!Number.isFinite(input.stepUpMultiple) || input.stepUpMultiple < 1) {
    errors.push({
      field: 'stepUpMultiple',
      message: 'Required step-up multiple must be at least 1.0x (benchmark is 2.0x).',
    });
  }

  if (!Number.isFinite(input.nextRoundMultiple) || input.nextRoundMultiple <= 0) {
    errors.push({
      field: 'nextRoundMultiple',
      message: 'Next-round revenue multiple must be greater than 0x.',
    });
  }

  if (!Number.isFinite(input.monthsToNextRound) || input.monthsToNextRound < 1) {
    errors.push({
      field: 'monthsToNextRound',
      message: 'Months to next round must be at least 1 month.',
    });
  } else if (input.monthsToNextRound > 60) {
    warnings.push({
      field: 'monthsToNextRound',
      message: 'A horizon beyond 60 months is outside normal venture round staging.',
    });
  }

  if (!Number.isFinite(input.cashNeeded) || input.cashNeeded < 0) {
    errors.push({
      field: 'cashNeeded',
      message: 'Cash needed from burn plan cannot be negative.',
    });
  }

  if (!Number.isFinite(input.esopTopUpPct) || input.esopTopUpPct < 0) {
    errors.push({
      field: 'esopTopUpPct',
      message: 'ESOP pool top-up cannot be negative.',
    });
  } else if (input.esopTopUpPct > 50) {
    errors.push({
      field: 'esopTopUpPct',
      message: 'ESOP pool top-up cannot exceed 50% of post-money.',
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
      message: `Round dilution (${formatPercent(input.dilutionPct, 1)}) plus pre-money ESOP top-up (${formatPercent(input.esopTopUpPct, 1)}) reaches ${formatPercent(input.dilutionPct + input.esopTopUpPct, 1)}, leaving 0% or negative effective pre-money for existing shareholders.`,
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
      message: 'Verdict bands must have 0 < Reachable ceiling < Stretch ceiling.',
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

export function computeFeasibleAskBand(input: CheckInput): FeasibleAskBand {
  const { annualRevenue, dilutionPct, stepUpMultiple, nextRoundMultiple, priorRaise, priorRaiseWasPriced, verdictBands } = input;
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

  const reachableNextPre = annualRevenue * verdictBands.reachableMax * nextRoundMultiple;
  const reachablePost = reachableNextPre / stepUpMultiple;
  const reachableAsk = reachablePost * dilutionFraction;

  const stretchNextPre = annualRevenue * verdictBands.stretchMax * nextRoundMultiple;
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
  unit: CurrencyUnit = 'INR_CR'
): CheckOutput {
  const validation = validateInput(input);
  const feasibleAskBand = computeFeasibleAskBand(input);

  if (!validation.valid) {
    const emptyMetric = (
      id: string,
      label: string,
      formula: string,
      isAssumption = false,
      assumptionOrigin = 'Source Article'
    ) => ({
      id,
      label,
      value: null,
      formattedValue: '—',
      subtitle: 'Fix input errors to calculate',
      formula,
      calculation: 'Waiting for valid inputs',
      isAssumption,
      assumptionOrigin,
    });

    const metrics: CheckMetrics = {
      impliedPostMoney: emptyMetric('impliedPostMoney', 'Implied post-money', 'Ask ÷ (Dilution % ÷ 100)'),
      impliedPreMoney: emptyMetric('impliedPreMoney', 'Implied pre-money', 'Implied Post-Money − Ask'),
      effectivePreMoneyAfterEsop: emptyMetric(
        'effectivePreMoneyAfterEsop',
        'Effective pre-money (after ESOP)',
        'Implied Pre-Money − (Implied Post-Money × ESOP % ÷ 100)',
        false,
        'Source Article (Comments)'
      ),
      impliedPostRevenueMultiple: emptyMetric(
        'impliedPostRevenueMultiple',
        'Implied revenue multiple (post)',
        'Implied Post-Money ÷ Annualised Revenue'
      ),
      impliedPreRevenueMultiple: emptyMetric(
        'impliedPreRevenueMultiple',
        'Implied revenue multiple (pre)',
        'Implied Pre-Money ÷ Annualised Revenue'
      ),
      nextRoundPreMoney: emptyMetric(
        'nextRoundPreMoney',
        'Next-round pre-money',
        'Implied Post-Money × Required Step-Up'
      ),
      requiredNextAnnualRevenue: emptyMetric(
        'requiredNextAnnualRevenue',
        'Revenue to earn it (annual)',
        'Next-Round Pre-Money ÷ Next-Round Multiple'
      ),
      requiredNextMonthlyRevenue: emptyMetric(
        'requiredNextMonthlyRevenue',
        'Revenue to earn it (monthly)',
        'Required Annualised Revenue ÷ 12'
      ),
      requiredGrowthMultiple: emptyMetric(
        'requiredGrowthMultiple',
        'Growth needed',
        'Required Next Annualised Revenue ÷ Current Annualised Revenue'
      ),
      impliedCagrPct: emptyMetric(
        'impliedCagrPct',
        'Implied annual CAGR',
        '(Growth Needed ^ (12 ÷ Months)) − 1',
        true,
        'Our Assumption'
      ),
      impliedCmgrPct: emptyMetric(
        'impliedCmgrPct',
        'Implied monthly CMGR',
        '(Growth Needed ^ (1 ÷ Months)) − 1',
        true,
        'Our Assumption'
      ),
      fundingGap: emptyMetric(
        'fundingGap',
        'Milestone funding gap',
        'max(0, Cash Needed − Ask)'
      ),
      askToPriorRaiseMultiple: emptyMetric(
        'askToPriorRaiseMultiple',
        'Ask vs. previous raise',
        'Ask ÷ Previous Raise'
      ),
    };

    return {
      input,
      unit,
      validation,
      verdict: {
        level: 'invalid',
        headline: 'Check input values to run the calculation',
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
    verdictBands,
  } = input;

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

  const rawGap = cashNeeded > 0 ? cashNeeded - ask : null;
  const fundingGapVal = rawGap !== null ? Math.max(0, rawGap) : null;
  const askToPrior = priorRaise > 0 ? ask / priorRaise : null;

  const metrics: CheckMetrics = {
    impliedPostMoney: {
      id: 'impliedPostMoney',
      label: 'Implied post-money',
      value: core.postMoney,
      formattedValue: formatMoney(core.postMoney, unit),
      subtitle: `ask ÷ ${formatPercent(dilutionPct, 1)} dilution`,
      formula: 'Implied Post-Money = Ask ÷ (Dilution % ÷ 100)',
      calculation: `${formatMoney(ask, unit)} ÷ ${(dilutionPct / 100).toFixed(4).replace(/\.?0+$/, '')} = ${formatMoney(core.postMoney, unit)}`,
      isAssumption: false,
      assumptionOrigin: 'Source Article',
    },
    impliedPreMoney: {
      id: 'impliedPreMoney',
      label: 'Implied pre-money',
      value: core.preMoney,
      formattedValue: formatMoney(core.preMoney, unit),
      subtitle: 'post-money − ask',
      formula: 'Implied Pre-Money = Implied Post-Money − Ask',
      calculation: `${formatMoney(core.postMoney, unit)} − ${formatMoney(ask, unit)} = ${formatMoney(core.preMoney, unit)}`,
      isAssumption: false,
      assumptionOrigin: 'Source Article',
    },
    effectivePreMoneyAfterEsop: {
      id: 'effectivePreMoneyAfterEsop',
      label: 'Effective pre-money (after ESOP)',
      value: effectivePreMoney,
      formattedValue: formatMoney(effectivePreMoney, unit),
      subtitle:
        esopTopUpPct > 0
          ? `after ${formatPercent(esopTopUpPct, 1)} post-money ESOP pool (${formatMoney(esopPoolValue, unit)})`
          : 'no pre-money ESOP top-up set',
      formula: 'Effective Pre-Money = Implied Pre-Money − (Implied Post-Money × ESOP % ÷ 100)',
      calculation: `${formatMoney(core.preMoney, unit)} − (${formatMoney(core.postMoney, unit)} × ${(esopTopUpPct / 100).toFixed(4).replace(/\.?0+$/, '')}) = ${formatMoney(effectivePreMoney, unit)}`,
      isAssumption: false,
      assumptionOrigin: 'Source Article (Comments)',
    },
    impliedPostRevenueMultiple: {
      id: 'impliedPostRevenueMultiple',
      label: 'Implied revenue multiple',
      value: core.impliedPostMultiple,
      formattedValue:
        core.impliedPostMultiple !== null
          ? `${formatMultiple(core.impliedPostMultiple, 1)} post`
          : 'Enter revenue',
      subtitle:
        core.impliedPreMultiple !== null
          ? `${formatMultiple(core.impliedPreMultiple, 1)} pre-money ÷ ARR`
          : 'post-money ÷ annualised revenue',
      formula:
        'Post Multiple = Implied Post-Money ÷ ARR | Pre Multiple = Implied Pre-Money ÷ ARR',
      calculation:
        core.impliedPostMultiple !== null && core.impliedPreMultiple !== null
          ? `Post: ${formatMoney(core.postMoney, unit)} ÷ ${formatMoney(annualRevenue, unit)} = ${formatMultiple(core.impliedPostMultiple, 2)} | Pre: ${formatMoney(core.preMoney, unit)} ÷ ${formatMoney(annualRevenue, unit)} = ${formatMultiple(core.impliedPreMultiple, 2)}`
          : 'Requires current annualised revenue > 0',
      isAssumption: false,
      assumptionOrigin: 'Source Article',
    },
    impliedPreRevenueMultiple: {
      id: 'impliedPreRevenueMultiple',
      label: 'Implied pre-money multiple',
      value: core.impliedPreMultiple,
      formattedValue:
        core.impliedPreMultiple !== null
          ? formatMultiple(core.impliedPreMultiple, 1)
          : 'Enter revenue',
      subtitle: 'pre-money ÷ annualised revenue',
      formula: 'Implied Pre-Money Multiple = Implied Pre-Money ÷ Annualised Revenue',
      calculation:
        core.impliedPreMultiple !== null
          ? `${formatMoney(core.preMoney, unit)} ÷ ${formatMoney(annualRevenue, unit)} = ${formatMultiple(core.impliedPreMultiple, 2)}`
          : 'Requires current annualised revenue > 0',
      isAssumption: false,
      assumptionOrigin: 'Source Article',
    },
    nextRoundPreMoney: {
      id: 'nextRoundPreMoney',
      label: 'Next-round pre-money',
      value: core.nextPreMoney,
      formattedValue: formatMoney(core.nextPreMoney, unit),
      subtitle: `${formatMultiple(stepUpMultiple, 1)} this post-money`,
      formula: 'Next-Round Pre-Money = Implied Post-Money × Required Step-Up',
      calculation: `${formatMoney(core.postMoney, unit)} × ${formatMultiple(stepUpMultiple, 2)} = ${formatMoney(core.nextPreMoney, unit)}`,
      isAssumption: stepUpMultiple !== 2,
      assumptionOrigin:
        stepUpMultiple === 2
          ? 'Source Article (2x minimum benchmark)'
          : 'Custom user override (Article benchmark is 2x)',
    },
    requiredNextAnnualRevenue: {
      id: 'requiredNextAnnualRevenue',
      label: 'Revenue to earn it',
      value: core.requiredAnnualRevenue,
      formattedValue: formatMoney(core.requiredAnnualRevenue, unit),
      subtitle: `${formatMonthlyMoney(core.requiredMonthlyRevenue, unit)} at ${formatMultiple(nextRoundMultiple, 1)}`,
      formula: 'Required Next ARR = Next-Round Pre-Money ÷ Next-Round Multiple',
      calculation: `${formatMoney(core.nextPreMoney, unit)} ÷ ${formatMultiple(nextRoundMultiple, 2)} = ${formatMoney(core.requiredAnnualRevenue, unit)} (${formatMonthlyMoney(core.requiredMonthlyRevenue, unit)})`,
      isAssumption: true,
      assumptionOrigin: 'Our Assumption / Sector Comparable Multiple',
    },
    requiredNextMonthlyRevenue: {
      id: 'requiredNextMonthlyRevenue',
      label: 'Monthly revenue to earn it',
      value: core.requiredMonthlyRevenue,
      formattedValue: formatMonthlyMoney(core.requiredMonthlyRevenue, unit),
      subtitle: 'required annualised revenue ÷ 12',
      formula: 'Required Next Monthly Revenue = Required Next ARR ÷ 12',
      calculation: `${formatMoney(core.requiredAnnualRevenue, unit)} ÷ 12 = ${formatMonthlyMoney(core.requiredMonthlyRevenue, unit)}`,
      isAssumption: false,
      assumptionOrigin: 'Source Article',
    },
    requiredGrowthMultiple: {
      id: 'requiredGrowthMultiple',
      label: 'Growth needed',
      value: core.requiredGrowthMultiple,
      formattedValue:
        core.requiredGrowthMultiple !== null
          ? formatMultiple(core.requiredGrowthMultiple, 1)
          : 'Enter revenue',
      subtitle:
        cagr !== null
          ? `${formatPercent(cagr * 100, 0)}/yr (${formatPercent((cmgr ?? 0) * 100, 1)}/mo) over ${formatNumber(monthsToNextRound, 0)} mo`
          : 'enter current revenue to compute growth',
      formula: 'Growth Multiple = Required Next ARR ÷ Current ARR',
      calculation:
        core.requiredGrowthMultiple !== null
          ? `${formatMoney(core.requiredAnnualRevenue, unit)} ÷ ${formatMoney(annualRevenue, unit)} = ${formatMultiple(core.requiredGrowthMultiple, 2)}`
          : 'Requires current annualised revenue > 0',
      isAssumption: false,
      assumptionOrigin: 'Source Article',
    },
    impliedCagrPct: {
      id: 'impliedCagrPct',
      label: 'Implied annual CAGR',
      value: cagr !== null ? cagr * 100 : null,
      formattedValue: cagr !== null ? `${formatPercent(cagr * 100, 0)}/yr` : '—',
      subtitle: `over ${formatNumber(monthsToNextRound, 0)} months`,
      formula: 'Annual CAGR = (Growth Multiple ^ (12 ÷ Months)) − 1',
      calculation:
        cagr !== null && core.requiredGrowthMultiple !== null
          ? `(${core.requiredGrowthMultiple.toFixed(2)} ^ (12 ÷ ${monthsToNextRound})) − 1 = ${formatPercent(cagr * 100, 1)}`
          : 'Requires current annualised revenue > 0',
      isAssumption: true,
      assumptionOrigin: 'Our Assumption (compound annualisation)',
    },
    impliedCmgrPct: {
      id: 'impliedCmgrPct',
      label: 'Implied monthly CMGR',
      value: cmgr !== null ? cmgr * 100 : null,
      formattedValue: cmgr !== null ? `${formatPercent(cmgr * 100, 1)}/mo` : '—',
      subtitle: `compounded monthly for ${formatNumber(monthsToNextRound, 0)} mo`,
      formula: 'Monthly CMGR = (Growth Multiple ^ (1 ÷ Months)) − 1',
      calculation:
        cmgr !== null && core.requiredGrowthMultiple !== null
          ? `(${core.requiredGrowthMultiple.toFixed(2)} ^ (1 ÷ ${monthsToNextRound})) − 1 = ${formatPercent(cmgr * 100, 2)}`
          : 'Requires current annualised revenue > 0',
      isAssumption: true,
      assumptionOrigin: 'Our Assumption (compound monthly rate)',
    },
    fundingGap: {
      id: 'fundingGap',
      label: 'Funding gap',
      value: fundingGapVal,
      formattedValue:
        cashNeeded > 0
          ? fundingGapVal && fundingGapVal > 0
            ? formatMoney(fundingGapVal, unit)
            : 'None'
          : 'Not set',
      subtitle:
        cashNeeded > 0
          ? rawGap !== null && rawGap < 0
            ? `${formatMoney(Math.abs(rawGap), unit)} buffer above ${formatMoney(cashNeeded, unit)} burn`
            : `burn plan needs ${formatMoney(cashNeeded, unit)}`
          : 'enter cash needed from burn plan',
      formula: 'Funding Shortfall = max(0, Cash Needed − Ask)',
      calculation:
        cashNeeded > 0
          ? `Cash Needed (${formatMoney(cashNeeded, unit)}) − Ask (${formatMoney(ask, unit)}) = ${formatMoney(rawGap ?? 0, unit)}`
          : 'Cash needed is 0 (optional field)',
      isAssumption: false,
      assumptionOrigin: 'Source Article (Example B burn check)',
    },
    askToPriorRaiseMultiple: {
      id: 'askToPriorRaiseMultiple',
      label: 'Ask vs. previous raise',
      value: askToPrior,
      formattedValue:
        askToPrior !== null
          ? `${formatMultiple(askToPrior, 1)} (${priorRaiseWasPriced ? 'usual band 3–4x' : 'unpriced prior money'})`
          : 'No prior raise',
      subtitle:
        priorRaise > 0
          ? `prior raise: ${formatMoney(priorRaise, unit)}`
          : 'enter previous raise if applicable',
      formula: 'Ask vs. Previous Raise = Ask ÷ Previous Raise',
      calculation:
        askToPrior !== null
          ? `${formatMoney(ask, unit)} ÷ ${formatMoney(priorRaise, unit)} = ${formatMultiple(askToPrior, 2)}`
          : 'Previous raise is 0',
      isAssumption: false,
      assumptionOrigin: 'Source Article (3–4x priced round rule)',
    },
  };

  // Build Verdict & Diagnostic Reasons
  let level: VerdictLevel;
  let headline: string;
  const reasons: VerdictReason[] = [];

  if (annualRevenue <= 0 || core.requiredGrowthMultiple === null) {
    level = 'incomplete';
    headline = 'Add current revenue to test whether growth can clear the next round';
    reasons.push({
      id: 'valuation_signal',
      text: `Your ${formatMoney(ask, unit)} ask at ${formatPercent(dilutionPct, 1)} dilution immediately signals a ${formatMoney(core.postMoney, unit)} post-money valuation (${formatMoney(core.preMoney, unit)} pre-money), requiring ${formatMoney(core.nextPreMoney, unit)} pre-money in the next round.`,
      tone: 'neutral',
      isAssumption: false,
      origin: 'Source Article',
    });
    reasons.push({
      id: 'missing_revenue',
      text: `To earn ${formatMoney(core.nextPreMoney, unit)} at ${formatMultiple(nextRoundMultiple, 1)}, you must reach ${formatMoney(core.requiredAnnualRevenue, unit)} ARR (${formatMonthlyMoney(core.requiredMonthlyRevenue, unit)}). Enter your current revenue to see the required growth multiple.`,
      tone: 'neutral',
      isAssumption: false,
      origin: 'Source Article',
    });
  } else {
    const gx = core.requiredGrowthMultiple;
    if (gx <= verdictBands.reachableMax) {
      level = 'reachable';
      headline = `Reachable: ${formatMultiple(gx, 1)} revenue growth needed in ${formatNumber(monthsToNextRound, 0)} months`;
    } else if (gx <= verdictBands.stretchMax) {
      level = 'stretch';
      headline = `Stretch: ${formatMultiple(gx, 1)} revenue growth needed in ${formatNumber(monthsToNextRound, 0)} months`;
    } else {
      level = 'stiff';
      headline = `Stiff: ${formatMultiple(gx, 1)} revenue growth needed in ${formatNumber(monthsToNextRound, 0)} months`;
    }

    reasons.push({
      id: 'valuation_signal',
      text: `Your ${formatMoney(ask, unit)} ask at ${formatPercent(dilutionPct, 1)} dilution signals a ${formatMoney(core.postMoney, unit)} post-money (${formatMoney(core.preMoney, unit)} pre-money), which is ${formatMultiple(core.impliedPostMultiple, 1)} post-money (${formatMultiple(core.impliedPreMultiple, 1)} pre-money) on current ${formatMoney(annualRevenue, unit)} ARR.`,
      tone: level === 'reachable' ? 'good' : level === 'stretch' ? 'warn' : 'bad',
      isAssumption: false,
      origin: 'Source Article',
    });

    // Fixed Multiple Compression Check: compare current multiple directly against nextRoundMultiple
    if (core.impliedPostMultiple !== null && core.impliedPostMultiple > nextRoundMultiple) {
      const preCompressionNote =
        core.impliedPreMultiple !== null && core.impliedPreMultiple > nextRoundMultiple
          ? `Both your implied pre-money multiple (${formatMultiple(core.impliedPreMultiple, 1)}) and post-money multiple (${formatMultiple(core.impliedPostMultiple, 1)}) sit above the ${formatMultiple(nextRoundMultiple, 1)} next-round multiple.`
          : `Your implied post-money multiple (${formatMultiple(core.impliedPostMultiple, 1)}) sits above the ${formatMultiple(nextRoundMultiple, 1)} next-round multiple (pre-money is ${formatMultiple(core.impliedPreMultiple, 1)}).`;

      reasons.push({
        id: 'multiple_compression',
        text: `${preCompressionNote} Because multiples compress from this round to the next, revenue has to grow ${formatMultiple(gx, 1)} just to deliver a ${formatMultiple(stepUpMultiple, 1)} valuation step-up.`,
        tone: gx > verdictBands.reachableMax ? 'warn' : 'neutral',
        isAssumption: false,
        origin: 'Source Article (Multiple compression)',
      });
    } else if (
      core.impliedPostMultiple !== null &&
      core.impliedPostMultiple <= nextRoundMultiple
    ) {
      reasons.push({
        id: 'no_compression',
        text: `Your implied post-money multiple (${formatMultiple(core.impliedPostMultiple, 1)}) is at or below the ${formatMultiple(nextRoundMultiple, 1)} next-round multiple, so no multiple compression headwind is baked in.`,
        tone: 'good',
        isAssumption: false,
        origin: 'Source Article',
      });
    }
  }

  // Burn / Cash Needed Check
  if (cashNeeded > 0) {
    if (cashNeeded > ask) {
      const gap = cashNeeded - ask;
      reasons.push({
        id: 'funding_shortfall',
        text: `Undercapitalised milestone: your ask (${formatMoney(ask, unit)}) is short of the ${formatMoney(cashNeeded, unit)} burn needed to hit the milestone by ${formatMoney(gap, unit)}. You either dilute more, raise more, or reset revenue expectations.`,
        tone: 'bad',
        isAssumption: false,
        origin: 'Source Article (Example B burn check)',
      });
    } else if (cashNeeded < ask) {
      const buffer = ask - cashNeeded;
      reasons.push({
        id: 'funding_buffer',
        text: `Your ask includes a ${formatMoney(buffer, unit)} runway cushion above the ${formatMoney(cashNeeded, unit)} milestone burn plan—useful buffer for execution uncertainty, though it raises the valuation bar you must clear.`,
        tone: 'good',
        isAssumption: true,
        origin: 'Our Assumption / Article Comments',
      });
    } else {
      reasons.push({
        id: 'funding_exact',
        text: `Your ask (${formatMoney(ask, unit)}) exactly matches your ${formatMoney(cashNeeded, unit)} milestone burn plan with zero buffer for delays.`,
        tone: 'neutral',
        isAssumption: false,
        origin: 'Source Article',
      });
    }
  }

  // Previous Raise Check (respecting priorRaiseWasPriced switch)
  if (priorRaise > 0 && askToPrior !== null) {
    if (priorRaiseWasPriced) {
      if (askToPrior > 4) {
        reasons.push({
          id: 'prior_raise_high',
          text: `The ask is ${formatMultiple(askToPrior, 1)} your previous priced raise (${formatMoney(priorRaise, unit)}), above the typical 3–4x band (${formatMoney(priorRaise * 3, unit)}–${formatMoney(priorRaise * 4, unit)}). Unless revenue is growing like a rocket, this jump is hard to justify.`,
          tone: 'warn',
          isAssumption: false,
          origin: 'Source Article (3–4x previous raise rule)',
        });
      } else if (askToPrior < 3) {
        reasons.push({
          id: 'prior_raise_low',
          text: `The ask is ${formatMultiple(askToPrior, 1)} your previous priced raise (${formatMoney(priorRaise, unit)}), below the usual 3–4x step-up band.`,
          tone: 'neutral',
          isAssumption: false,
          origin: 'Source Article (3–4x previous raise rule)',
        });
      } else {
        reasons.push({
          id: 'prior_raise_ok',
          text: `The ask is ${formatMultiple(askToPrior, 1)} your previous priced raise (${formatMoney(priorRaise, unit)}), squarely inside the typical 3–4x band.`,
          tone: 'good',
          isAssumption: false,
          origin: 'Source Article (3–4x previous raise rule)',
        });
      }
    } else {
      reasons.push({
        id: 'prior_raise_unpriced',
        text: `Previous capital (${formatMoney(priorRaise, unit)}, ${formatMultiple(askToPrior, 1)} ratio) is marked as unpriced (grants, angel notes, or founder capital), so the 3–4x priced-round heuristic is not enforced.`,
        tone: 'neutral',
        isAssumption: true,
        origin: 'Our Assumption (Priced vs. unpriced distinction)',
      });
    }
  }

  // ESOP Pool Note
  if (esopTopUpPct > 0) {
    reasons.push({
      id: 'esop_impact',
      text: `A ${formatPercent(esopTopUpPct, 1)} pre-money ESOP pool top-up reduces existing shareholders' effective pre-money from ${formatMoney(core.preMoney, unit)} to ${formatMoney(effectivePreMoney, unit)}.`,
      tone: 'warn',
      isAssumption: false,
      origin: 'Source Article (Comments)',
    });
  }

  // Horizon Convention Note
  if (monthsToNextRound < 15 || monthsToNextRound > 18) {
    reasons.push({
      id: 'horizon_outside_benchmark',
      text: `Horizon of ${formatNumber(monthsToNextRound, 0)} months is outside the standard 15–18 month seed convention (${monthsToNextRound > 18 ? 'longer runway / staged capital' : 'accelerated bridge/sprint'}).`,
      tone: 'neutral',
      isAssumption: false,
      origin: 'Source Article (15–18 month convention)',
    });
  }

  // Dilution Sensitivity Table: 20%, 25%, 33%, plus user's custom dilution if not already in the list
  const baseDilutions = [20, 25, 33];
  const hasCustom = !baseDilutions.some((d) => Math.abs(d - dilutionPct) < 0.05);
  const allDilutions = hasCustom
    ? [...baseDilutions, dilutionPct].sort((a, b) => a - b)
    : baseDilutions;

  const sensitivity: SensitivityRow[] = allDilutions.map((d) => {
    const isUserSelected = Math.abs(d - dilutionPct) < 0.05;
    const row = computeRowForDilution(
      ask,
      d,
      annualRevenue,
      stepUpMultiple,
      nextRoundMultiple
    );
    let note = '';
    if (Math.abs(d - 20) < 0.05) note = '5x ask (standard low dilution)';
    else if (Math.abs(d - 25) < 0.05) note = '4x ask (standard high dilution)';
    else if (Math.abs(d - 33) < 0.05) note = '~3x ask (very high for early stage)';
    else note = `${formatMultiple(100 / d, 1)} ask (your input)`;

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
  };
}

export function solveGoalSeek(
  input: CheckInput,
  target: GoalSeekTarget,
  targetGrowthMultiple?: number,
  unit: CurrencyUnit = 'INR_CR'
): GoalSeekResult {
  const gMax =
    targetGrowthMultiple !== undefined && targetGrowthMultiple > 0
      ? targetGrowthMultiple
      : input.verdictBands.reachableMax;

  const feasibleAskBand = computeFeasibleAskBand(input);
  const { ask, dilutionPct, annualRevenue, stepUpMultiple, nextRoundMultiple } = input;
  const dFrac = dilutionPct / 100;

  if (stepUpMultiple < 1 || nextRoundMultiple <= 0 || gMax <= 0) {
    return {
      target,
      targetGrowthMultiple: gMax,
      solvedValue: null,
      formattedSolvedValue: '—',
      summary: 'Enter valid step-up and next-round multiple to run Goal-Seek.',
      formula: '',
      calculation: '',
      isFeasible: false,
      infeasibleReason: 'Invalid step-up or next-round multiple.',
      feasibleAskBand,
    };
  }

  if (target === 'max_ask') {
    if (annualRevenue <= 0 || dFrac <= 0 || dFrac >= 1) {
      return {
        target,
        targetGrowthMultiple: gMax,
        solvedValue: null,
        formattedSolvedValue: '—',
        summary: 'Enter current revenue and valid dilution to solve for Maximum Ask.',
        formula: 'Max Ask = Current ARR × Target Growth × Next Multiple × (Dilution ÷ Step-Up)',
        calculation: 'Waiting for revenue > 0 and dilution in (0%, 100%)',
        isFeasible: false,
        infeasibleReason: 'Requires current annualised revenue > 0.',
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
      formattedSolvedValue: formatMoney(maxAsk, unit),
      secondaryFormattedValue: `${formatMoney(maxPost, unit)} post-money`,
      summary: `To keep required revenue growth at or below ${formatMultiple(gMax, 1)} (at ${formatPercent(dilutionPct, 1)} dilution and ${formatMultiple(nextRoundMultiple, 1)} next-round multiple), your ask cannot exceed ${formatMoney(maxAsk, unit)} (implying ${formatMoney(maxPost, unit)} post-money).`,
      formula: 'Max Ask = Current ARR × Target Growth × Next Multiple × (Dilution % ÷ 100) ÷ Step-Up',
      calculation: `${formatMoney(annualRevenue, unit)} × ${formatMultiple(gMax, 2)} × ${formatMultiple(nextRoundMultiple, 2)} × ${(dFrac).toFixed(4).replace(/\.?0+$/, '')} ÷ ${formatMultiple(stepUpMultiple, 2)} = ${formatMoney(maxAsk, unit)}`,
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
        formattedSolvedValue: '—',
        summary: 'Enter a positive ask and valid dilution to solve for Required Current Revenue.',
        formula: 'Required Current ARR = (Ask × Step-Up) ÷ ((Dilution % ÷ 100) × Next Multiple × Target Growth)',
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
      formattedSolvedValue: formatMoney(reqCurrentArr, unit),
      secondaryFormattedValue: formatMonthlyMoney(reqCurrentMrr, unit),
      summary: `To justify a ${formatMoney(ask, unit)} ask at ${formatPercent(dilutionPct, 1)} dilution with no more than ${formatMultiple(gMax, 1)} growth, you need ${formatMoney(reqCurrentArr, unit)} annualised revenue today (${formatMonthlyMoney(reqCurrentMrr, unit)}).`,
      formula: 'Required Current ARR = (Ask ÷ (Dilution % ÷ 100)) × Step-Up ÷ (Next Multiple × Target Growth)',
      calculation: `${formatMoney(reqNextArr, unit)} target ARR ÷ ${formatMultiple(gMax, 2)} = ${formatMoney(reqCurrentArr, unit)} (${formatMonthlyMoney(reqCurrentMrr, unit)})`,
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
      formattedSolvedValue: '—',
      summary: 'Enter a positive ask and current revenue to solve for Required Dilution.',
      formula: 'Required Dilution % = (Ask × Step-Up) ÷ (Current ARR × Target Growth × Next Multiple) × 100',
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
    secondaryFormattedValue: `${formatMoney(maxPost, unit)} post-money`,
    summary: isFeasible
      ? `To raise ${formatMoney(ask, unit)} on ${formatMoney(annualRevenue, unit)} ARR while capping required growth at ${formatMultiple(gMax, 1)}, you would need to accept ${formatPercent(reqDilutionPct, 1)} dilution (pricing the round at ${formatMoney(maxPost, unit)} post-money).`
      : `Even at 100% dilution, a ${formatMoney(ask, unit)} raise exceeds the ${formatMoney(maxPost, unit)} post-money valuation supported by ${formatMultiple(gMax, 1)} growth (` +
        `requires ${formatPercent(reqDilutionPct, 1)} dilution). Lower the ask or raise revenue first.`,
    formula: 'Required Dilution % = (Ask ÷ ((Current ARR × Target Growth × Next Multiple) ÷ Step-Up)) × 100',
    calculation: `(${formatMoney(ask, unit)} ÷ ${formatMoney(maxPost, unit)} max post-money) × 100 = ${formatPercent(reqDilutionPct, 2)}`,
    isFeasible,
    infeasibleReason: !isFeasible
      ? `Required dilution (${formatPercent(reqDilutionPct, 1)}) exceeds available equity.`
      : undefined,
    feasibleAskBand,
  };
}
