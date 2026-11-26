import {
  DEFAULT_FX_INR_PER_USD,
  LABELS,
  UNIT_METADATA,
  evaluateAsk,
  formatMoney,
  formatMonthlyMoney,
  formatMultiple,
  formatPercent,
  solveGoalSeek,
  type CheckInput,
  type CurrencyUnit,
  type GoalSeekTarget,
} from '../engine';

export function generateMarkdownSummary(
  input: CheckInput,
  unit: CurrencyUnit,
  goalSeekTarget: GoalSeekTarget = 'max_ask',
  goalSeekGrowth?: number,
  fxInrPerUsd: number = DEFAULT_FX_INR_PER_USD
): string {
  const out = evaluateAsk(input, unit, fxInrPerUsd);
  const seek = solveGoalSeek(
    input,
    goalSeekTarget,
    goalSeekGrowth ?? input.verdictBands.reachableMax,
    unit,
    fxInrPerUsd
  );
  const unitLabel =
    unit === 'USD_M'
      ? `${UNIT_METADATA[unit].shortUnit} at ₹${fxInrPerUsd}/USD`
      : UNIT_METADATA[unit].shortUnit;
  const monthlyRev = input.annualRevenue / 12;
  const effectiveMonthlyBurn = input.monthlyBurn ?? 0;
  const effectiveBurnNeed =
    effectiveMonthlyBurn > 0
      ? effectiveMonthlyBurn * input.monthsToNextRound
      : input.cashNeeded;

  const lines: string[] = [
    `# Valuation Check: Summary (${unitLabel})`,
    ``,
    `**${LABELS.pricingCheckTitle}:** ${out.verdict.headline}`,
    ``,
    `## 1. Inputs`,
    `- **R1 Ask (Raise):** ${formatMoney(input.ask, unit, 2, fxInrPerUsd)}`,
    `- **R1 Dilution:** ${formatPercent(input.dilutionPct, 1)}`,
    `- **Current Revenue:** ${formatMoney(input.annualRevenue, unit, 2, fxInrPerUsd)} ARR (${formatMonthlyMoney(monthlyRev, unit, fxInrPerUsd)})`,
    `- **R2 Valuation Step-Up:** ${formatMultiple(input.stepUpMultiple, 1)} in ${input.monthsToNextRound} months`,
    `- **R2 Revenue Multiple:** ${formatMultiple(input.nextRoundMultiple, 1)} _(${LABELS.ruleOfThumbTag})_`,
  ];

  if (effectiveMonthlyBurn > 0) {
    lines.push(
      `- **Monthly Net Burn:** ${formatMonthlyMoney(effectiveMonthlyBurn, unit, fxInrPerUsd)} (${formatMoney(effectiveBurnNeed, unit, 2, fxInrPerUsd)} over ${input.monthsToNextRound} mo)`
    );
  } else if (input.cashNeeded > 0) {
    lines.push(`- **R1 Cash Needed:** ${formatMoney(input.cashNeeded, unit, 2, fxInrPerUsd)}`);
  }
  if (input.priorRaise > 0) {
    lines.push(
      `- **R0 Raise:** ${formatMoney(input.priorRaise, unit, 2, fxInrPerUsd)} (${input.priorRaiseWasPriced ? 'priced round' : 'unpriced'})`
    );
  }
  if (input.esopTopUpPct > 0) {
    lines.push(`- **ESOP Pool Created This Round:** ${formatPercent(input.esopTopUpPct, 1)} of post-money`);
  }

  lines.push(
    ``,
    `## 2. What the Ask Signals`,
    `| Metric | Value | Formula / Note |`,
    `| :--- | :--- | :--- |`,
    `| **R1 Post-Money** | ${out.metrics.impliedPostMoney.formattedValue} | ${out.metrics.impliedPostMoney.subtitle} |`,
    `| **R1 Pre-Money** | ${out.metrics.impliedPreMoney.formattedValue} | ${out.metrics.impliedPreMoney.subtitle} |`,
    `| **Effective R1 Pre-Money (after ESOP)** | ${out.metrics.effectivePreMoneyAfterEsop.formattedValue} | ${out.metrics.effectivePreMoneyAfterEsop.subtitle} |`
  );

  lines.push(
    `| **R1 Revenue Multiple** | ${out.metrics.impliedPostRevenueMultiple.formattedValue} | ${out.metrics.impliedPostRevenueMultiple.subtitle} |`,
    `| **R2 Pre-Money** | ${out.metrics.nextRoundPreMoney.formattedValue} | ${out.metrics.nextRoundPreMoney.subtitle} |`,
    `| **Required R2 ARR** | ${out.metrics.requiredNextAnnualRevenue.formattedValue} | ${out.metrics.requiredNextAnnualRevenue.subtitle} |`,
    `| **Required Revenue Growth** | ${out.metrics.requiredGrowthMultiple.formattedValue} | ${out.metrics.requiredGrowthMultiple.subtitle} |`
  );

  if (effectiveBurnNeed > 0) {
    lines.push(
      `| **Burn Shortfall** | ${out.metrics.fundingGap.formattedValue} | ${out.metrics.fundingGap.subtitle} |`
    );
  }

  lines.push(``, `## 3. Diagnostic Notes`);
  out.verdict.reasons.forEach((r) => {
    lines.push(`- ${r.text} _(${r.origin})_`);
  });

  if (out.validation.valid && input.annualRevenue > 0) {
    lines.push(
      ``,
      `## 4. Goal-Seek & Feasible Ask Band`,
      `- **Conservative Ask Ceiling (≤${formatMultiple(out.effectiveVerdictBands.reachableMax, 1)} growth):** ${formatMoney(out.feasibleAskBand.reachableAsk, unit, 2, fxInrPerUsd)}`,
      `- **Stretch Ask Ceiling (≤${formatMultiple(out.effectiveVerdictBands.stretchMax, 1)} growth):** ${formatMoney(out.feasibleAskBand.stretchAsk, unit, 2, fxInrPerUsd)}`
    );
    if (out.feasibleAskBand.priorRaiseBand) {
      lines.push(
        `- **3x to 4x Priced R0 Band:** ${formatMoney(out.feasibleAskBand.priorRaiseBand[0], unit, 2, fxInrPerUsd)} to ${formatMoney(out.feasibleAskBand.priorRaiseBand[1], unit, 2, fxInrPerUsd)}`
      );
    }
    lines.push(`- **Goal-Seek (${seek.target.replace('_', ' ')}):** ${seek.summary}`);
  }

  if (out.sensitivity.length > 0) {
    lines.push(
      ``,
      `## 5. Dilution Sensitivity`,
      `| Dilution | Post-Money | Pre-Money | Pre / Post Multiple | R2 Pre-Money | Growth Needed |`,
      `| :--- | ---: | ---: | ---: | ---: | ---: |`
    );
    out.sensitivity.forEach((row) => {
      const multStr =
        row.impliedPreMultiple !== null && row.impliedPostMultiple !== null
          ? `${formatMultiple(row.impliedPreMultiple, 1)} / ${formatMultiple(row.impliedPostMultiple, 1)}`
          : '-';
      const gxStr =
        row.requiredGrowthMultiple !== null
          ? formatMultiple(row.requiredGrowthMultiple, 1)
          : '-';
      lines.push(
        `| ${formatPercent(row.dilutionPct, 1)}${row.isUserSelected ? ' *(yours)*' : ''} | ${formatMoney(row.postMoney, unit, 2, fxInrPerUsd)} | ${formatMoney(row.preMoney, unit, 2, fxInrPerUsd)} | ${multStr} | ${formatMoney(row.nextPreMoney, unit, 2, fxInrPerUsd)} | ${gxStr} |`
      );
    });
  }

  lines.push(
    ``,
    `---`,
    `_Generated by Valuation Check (100% client-side thinking aid; not financial or investment advice)._`
  );

  return lines.join('\n');
}
