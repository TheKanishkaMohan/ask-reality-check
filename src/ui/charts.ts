import {
  DEFAULT_FX_INR_PER_USD,
  computeOwnershipWaterfall,
  formatMoney,
  formatMultiple,
  formatNumber,
  formatPercent,
  fromCr,
  type CheckOutput,
  type CurrencyUnit,
} from '../engine';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function compactMonthlyLabel(
  monthlyCrVal: number,
  unit: CurrencyUnit,
  fxInrPerUsd: number = DEFAULT_FX_INR_PER_USD
): string {
  const disp = fromCr(monthlyCrVal, unit, fxInrPerUsd);
  if (!Number.isFinite(disp) || disp <= 0) {
    return unit === 'USD_M' ? '$0/mo' : '₹0/mo';
  }
  if (unit === 'INR_CR' && disp < 1) {
    const lakhs = disp * 100;
    const rounded = lakhs >= 10 ? lakhs.toFixed(0) : lakhs.toFixed(1).replace(/\.0$/, '');
    return `₹${rounded}L/mo`;
  }
  if (unit === 'USD_M' && disp < 1) {
    return `$${Math.round(disp * 1000)}K/mo`;
  }
  return `${formatMoney(monthlyCrVal, unit, 1, fxInrPerUsd)}/mo`;
}

function compactAxisLabel(
  crVal: number,
  unit: CurrencyUnit,
  fxInrPerUsd: number = DEFAULT_FX_INR_PER_USD
): string {
  const disp = fromCr(crVal, unit, fxInrPerUsd);
  if (!Number.isFinite(disp) || disp <= 0) return '0';
  if (unit === 'INR_CR') {
    const rounded = disp >= 10 ? Math.round(disp) : Number(disp.toFixed(1));
    return `₹${formatNumber(rounded, 1, 'en-IN')}`;
  }
  if (unit === 'INR_LAKH') {
    const rounded = disp >= 10 ? Math.round(disp) : Number(disp.toFixed(1));
    return `₹${formatNumber(rounded, 1, 'en-IN')}L`;
  }
  return `$${formatNumber(disp >= 10 ? Math.round(disp) : Number(disp.toFixed(1)), 1, 'en-US')}M`;
}

export function renderValuationLadderSvg(
  output: CheckOutput,
  fxInrPerUsd: number = DEFAULT_FX_INR_PER_USD
): string {
  if (!output.validation.valid) {
    return `
      <svg class="vc-chart-svg" viewBox="0 0 540 270" role="img" aria-label="Valuation ladder chart awaiting valid inputs">
        <title>Valuation ladder</title>
        <rect x="1" y="1" width="538" height="268" rx="8" fill="#f3f3f3" stroke="#d2d2d7" />
        <text x="270" y="138" text-anchor="middle" class="vc-svg-sub">Fix input errors above to render the valuation ladder.</text>
      </svg>
    `.trim();
  }

  const { input, metrics, unit } = output;
  const hasEsop = input.esopTopUpPct > 0 && metrics.effectivePreMoneyAfterEsop.value !== null;
  const hasRev = input.annualRevenue > 0;
  const preMult = metrics.impliedPreRevenueMultiple.value;
  const postMult = metrics.impliedPostRevenueMultiple.value;
  const effPreVal = metrics.effectivePreMoneyAfterEsop.value ?? 0;

  const bars: Array<{
    key: string;
    label: string;
    sub1: string;
    sub2: string;
    value: number;
    fill: string;
    stroke: string;
    valFill: string;
  }> = [
    {
      key: 'pre',
      label: 'R1 Pre',
      sub1: 'post − ask',
      sub2: hasRev && preMult !== null ? `${formatMultiple(preMult, 1)} ARR` : '-',
      value: metrics.impliedPreMoney.value ?? 0,
      fill: '#e8e8ed',
      stroke: '#6e6e73',
      valFill: '#1c1c1c',
    },
  ];

  if (hasEsop) {
    const effMult = hasRev ? effPreVal / input.annualRevenue : null;
    bars.push({
      key: 'eff_pre',
      label: 'R1 Eff. pre',
      sub1: `−${formatPercent(input.esopTopUpPct, 1)} ESOP`,
      sub2: effMult !== null ? `${formatMultiple(effMult, 1)} ARR` : '-',
      value: effPreVal,
      fill: '#fff4e0',
      stroke: '#9a5800',
      valFill: '#9a5800',
    });
  }

  bars.push(
    {
      key: 'ask',
      label: 'R1 Ask',
      sub1: `${formatPercent(input.dilutionPct, 1)} dil.`,
      sub2:
        input.priorRaise > 0 && metrics.askToPriorRaiseMultiple.value !== null
          ? `${formatMultiple(metrics.askToPriorRaiseMultiple.value, 1)} R0`
          : 'new cash',
      value: input.ask,
      fill: '#eaf3ff',
      stroke: '#007aff',
      valFill: '#0058c4',
    },
    {
      key: 'post',
      label: 'R1 Post',
      sub1: `${formatMultiple(100 / input.dilutionPct, 1)} ask`,
      sub2: hasRev && postMult !== null ? `${formatMultiple(postMult, 1)} ARR` : '-',
      value: metrics.impliedPostMoney.value ?? 0,
      fill: '#007aff',
      stroke: '#0066d6',
      valFill: '#0058c4',
    },
    {
      key: 'next',
      label: 'R2 Pre',
      sub1: `in ${formatNumber(input.monthsToNextRound, 0)} mo`,
      sub2: `at ${formatMultiple(input.nextRoundMultiple, 1)} R2 ARR`,
      value: metrics.nextRoundPreMoney.value ?? 0,
      fill: '#ff9500',
      stroke: '#9a5800',
      valFill: '#9a5800',
    }
  );

  const count = bars.length;
  const barW = count === 5 ? 64 : 74;
  const gap = count === 5 ? 22 : 34;
  const plotLeft = 58;
  const plotW = 462;
  const startX = Math.round(plotLeft + (plotW - (count * barW + (count - 1) * gap)) / 2);
  const baselineY = 198;
  const topY = 66;
  const maxBarH = baselineY - topY;
  const midY = Math.round((baselineY + topY) / 2);
  const maxVal = Math.max(...bars.map((b) => Math.max(0, b.value)), 1);

  const postIdx = bars.findIndex((b) => b.key === 'post');
  const nextIdx = bars.findIndex((b) => b.key === 'next');
  const postCx = startX + postIdx * (barW + gap) + barW / 2;
  const nextCx = startX + nextIdx * (barW + gap) + barW / 2;
  const midCx = Math.round((postCx + nextCx) / 2);
  const postRight = startX + postIdx * (barW + gap) + barW;
  const nextLeft = startX + nextIdx * (barW + gap);
  const divX = Math.round((postRight + nextLeft) / 2);

  const postVal = metrics.impliedPostMoney.value ?? 0;
  const nextVal = metrics.nextRoundPreMoney.value ?? 0;
  const deltaVal = Math.max(0, nextVal - postVal);
  const stepLabel = `R1→R2: ${formatMultiple(input.stepUpMultiple, 1)} (+${formatMoney(deltaVal, unit, undefined, fxInrPerUsd)})`;
  const pillW = Math.min(210, Math.max(132, stepLabel.length * 7 + 18));
  const pillX = Math.min(532 - pillW, Math.max(60, Math.round(midCx - pillW / 2)));

  const barsMarkup = bars
    .map((b, idx) => {
      const x = startX + idx * (barW + gap);
      const cx = x + barW / 2;
      const h = b.value <= 0 ? 4 : Math.max(12, Math.round((b.value / maxVal) * maxBarH));
      const y = baselineY - h;
      const formattedVal = formatMoney(b.value, unit, undefined, fxInrPerUsd);

      return `
        <g>
          <rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="6" fill="${b.fill}" stroke="${b.stroke}" stroke-width="1.25" />
          <text x="${cx}" y="${y - 8}" text-anchor="middle" fill="${b.valFill}" class="vc-svg-val">${escapeXml(formattedVal)}</text>
          <text x="${cx}" y="216" text-anchor="middle" class="vc-svg-label">${escapeXml(b.label)}</text>
          <text x="${cx}" y="233" text-anchor="middle" class="vc-svg-sub">${escapeXml(b.sub1)}</text>
          <text x="${cx}" y="249" text-anchor="middle" class="vc-svg-sub-strong">${escapeXml(b.sub2)}</text>
        </g>
      `;
    })
    .join('');

  const ariaSummary = bars
    .map((b) => `${b.label} ${formatMoney(b.value, unit, undefined, fxInrPerUsd)}`)
    .join(', ');

  return `
    <svg class="vc-chart-svg" viewBox="0 0 540 270" role="img" aria-label="Valuation ladder: ${escapeXml(ariaSummary)}">
      <title>Valuation ladder from R1 Pre and R1 Ask to R1 Post and R2 Pre</title>
      <line x1="54" y1="${topY}" x2="522" y2="${topY}" stroke="#ececef" stroke-dasharray="3 3" />
      <line x1="54" y1="${midY}" x2="522" y2="${midY}" stroke="#e5e5ea" stroke-dasharray="3 3" />
      <line x1="54" y1="${baselineY}" x2="522" y2="${baselineY}" stroke="#c7c7cc" />

      <text x="48" y="${topY + 4}" text-anchor="end" class="vc-svg-axis">${escapeXml(compactAxisLabel(maxVal, unit, fxInrPerUsd))}</text>
      <text x="48" y="${midY + 4}" text-anchor="end" class="vc-svg-axis">${escapeXml(compactAxisLabel(maxVal / 2, unit, fxInrPerUsd))}</text>
      <text x="48" y="${baselineY + 4}" text-anchor="end" class="vc-svg-axis">0</text>

      <text x="58" y="20" text-anchor="start" class="vc-svg-group">THIS ROUND (R1)</text>
      <line x1="${divX}" y1="44" x2="${divX}" y2="254" stroke="#c7c7cc" stroke-dasharray="4 3" />

      <path d="M ${postCx} 32 L ${postCx} 18 L ${nextCx} 18 L ${nextCx} 28" fill="none" stroke="#9a5800" stroke-width="1.25" />
      <polygon points="${nextCx},33 ${nextCx - 4},26 ${nextCx + 4},26" fill="#9a5800" />
      <rect x="${pillX}" y="7" width="${pillW}" height="21" rx="10" fill="#fff4e0" stroke="#9a5800" stroke-width="1" />
      <text x="${pillX + pillW / 2}" y="21" text-anchor="middle" fill="#9a5800" class="vc-svg-pill">${escapeXml(stepLabel)}</text>
      ${barsMarkup}
    </svg>
  `.trim();
}

export function renderRevenueBridgeSvg(
  output: CheckOutput,
  fxInrPerUsd: number = DEFAULT_FX_INR_PER_USD
): string {
  if (!output.validation.valid) {
    return `
      <svg class="vc-chart-svg" viewBox="0 0 540 270" role="img" aria-label="Revenue bridge chart awaiting valid inputs">
        <title>Revenue bridge</title>
        <rect x="1" y="1" width="538" height="268" rx="8" fill="#f3f3f3" stroke="#d2d2d7" />
        <text x="270" y="138" text-anchor="middle" class="vc-svg-sub">Fix input errors above to render the revenue bridge.</text>
      </svg>
    `.trim();
  }

  const { input, metrics, verdict, unit, effectiveVerdictBands } = output;
  const currArr = Math.max(0, input.annualRevenue);
  const reqArr = Math.max(0, metrics.requiredNextAnnualRevenue.value ?? 0);
  const reqMrr = reqArr / 12;
  const reachableTargetArr = currArr > 0 ? currArr * effectiveVerdictBands.reachableMax : 0;

  const baselineY = 198;
  const topY = 66;
  const maxBarH = baselineY - topY;
  const midY = Math.round((baselineY + topY) / 2);

  const barMax = Math.max(currArr, reqArr, 1);
  const maxVal =
    reachableTargetArr > 0 && reachableTargetArr <= barMax * 1.45
      ? Math.max(barMax, reachableTargetArr * 1.05)
      : barMax;

  const currH = currArr <= 0 ? 4 : Math.max(12, Math.round((currArr / maxVal) * maxBarH));
  const reqH = reqArr <= 0 ? 4 : Math.max(12, Math.round((reqArr / maxVal) * maxBarH));

  const currX = 76;
  const barW = 102;
  const currCx = currX + barW / 2;
  const currY = baselineY - currH;

  const reqX = 394;
  const reqCx = reqX + barW / 2;
  const reqY = baselineY - reqH;

  let reqFill = '#6e6e73';
  let reqStroke = '#4a4a4f';
  let reqValColor = '#1c1c1c';
  let pillFill = '#e8e8ed';
  let pillStroke = '#6e6e73';
  let pillTextColor = '#4a4a4f';

  if (verdict.level === 'reachable') {
    reqFill = '#1b7a35';
    reqStroke = '#155d28';
    reqValColor = '#1b7a35';
    pillFill = '#e8f7ec';
    pillStroke = '#1b7a35';
    pillTextColor = '#1b7a35';
  } else if (verdict.level === 'stretch') {
    reqFill = '#ff9500';
    reqStroke = '#9a5800';
    reqValColor = '#9a5800';
    pillFill = '#fff4e0';
    pillStroke = '#9a5800';
    pillTextColor = '#9a5800';
  } else if (verdict.level === 'stiff') {
    reqFill = '#ff3b30';
    reqStroke = '#c4281c';
    reqValColor = '#c4281c';
    pillFill = '#fdeceb';
    pillStroke = '#c4281c';
    pillTextColor = '#c4281c';
  }

  const postMult = metrics.impliedPostRevenueMultiple.value;
  const preMult = metrics.impliedPreRevenueMultiple.value;
  const currTopLabel = currArr > 0 ? formatMoney(currArr, unit, undefined, fxInrPerUsd) : 'Pre-revenue';
  const currSub1 =
    currArr > 0 ? compactMonthlyLabel(currArr / 12, unit, fxInrPerUsd) : 'DeepTech planner';
  const currSub2 =
    currArr > 0 && postMult !== null && preMult !== null
      ? `${formatMultiple(postMult, 1)} post · ${formatMultiple(preMult, 1)} pre`
      : 'coming soon';

  const reqTopLabel = formatMoney(reqArr, unit, undefined, fxInrPerUsd);
  const reqSub1 = compactMonthlyLabel(reqMrr, unit, fxInrPerUsd);
  const reqSub2 = `at ${formatMultiple(input.nextRoundMultiple, 1)} R2 ARR`;

  const gx = metrics.requiredGrowthMultiple.value;
  const cagr = metrics.impliedCagrPct.value;
  const cmgr = metrics.impliedCmgrPct.value;
  const bridgeTitle =
    gx !== null
      ? `${formatMultiple(gx, 1)} in ${formatNumber(input.monthsToNextRound, 0)} mo`
      : 'Pre-revenue';
  const bridgePace =
    cagr !== null && cmgr !== null
      ? `${formatPercent(cagr, 0)}/yr CAGR · ${formatPercent(cmgr, 1)}/mo`
      : `${formatNumber(input.monthsToNextRound, 0)} mo runway`;

  const hasCompression = postMult !== null && postMult > input.nextRoundMultiple;
  const compPill =
    postMult !== null
      ? `Multiple: ${formatMultiple(postMult, 1)} → ${formatMultiple(input.nextRoundMultiple, 1)}`
      : `${formatNumber(input.monthsToNextRound, 0)} mo horizon`;
  const compFill = hasCompression ? '#fff4e0' : '#f3f3f3';
  const compStroke = hasCompression ? '#9a5800' : '#d2d2d7';
  const compColor = hasCompression ? '#9a5800' : '#4a4a4f';

  let reachableMarkup = '';
  if (currArr > 0 && reachableTargetArr > 0 && reachableTargetArr <= maxVal) {
    const reachY = Math.max(
      topY + 4,
      Math.min(baselineY - 8, baselineY - Math.round((reachableTargetArr / maxVal) * maxBarH))
    );
    const paceLabel = `Conservative ceiling: ${formatMoney(reachableTargetArr, unit, undefined, fxInrPerUsd)} (≤${formatPercent(effectiveVerdictBands.reachableCagrPct, 0)}/yr)`;
    reachableMarkup = `
      <line x1="58" y1="20" x2="78" y2="20" stroke="#1b7a35" stroke-width="1.5" stroke-dasharray="4 3" />
      <text x="84" y="24" text-anchor="start" fill="#1b7a35" class="vc-svg-sub-pill">${escapeXml(paceLabel)}</text>
      <line x1="54" y1="${reachY}" x2="522" y2="${reachY}" stroke="#1b7a35" stroke-width="1.25" stroke-dasharray="5 4" />
    `;
  }

  const ariaSummary = `Current ARR (R1) ${currTopLabel} to Required ARR (R2) ${reqTopLabel} (${bridgeTitle}, ${bridgePace})`;

  return `
    <svg class="vc-chart-svg" viewBox="0 0 540 270" role="img" aria-label="Revenue bridge: ${escapeXml(ariaSummary)}">
      <title>Revenue bridge from Current ARR (R1) to Required ARR (R2)</title>
      <line x1="54" y1="${topY}" x2="522" y2="${topY}" stroke="#ececef" stroke-dasharray="3 3" />
      <line x1="54" y1="${midY}" x2="522" y2="${midY}" stroke="#e5e5ea" stroke-dasharray="3 3" />
      <line x1="54" y1="${baselineY}" x2="522" y2="${baselineY}" stroke="#c7c7cc" />

      <text x="48" y="${topY + 4}" text-anchor="end" class="vc-svg-axis">${escapeXml(compactAxisLabel(maxVal, unit, fxInrPerUsd))}</text>
      <text x="48" y="${midY + 4}" text-anchor="end" class="vc-svg-axis">${escapeXml(compactAxisLabel(maxVal / 2, unit, fxInrPerUsd))}</text>
      <text x="48" y="${baselineY + 4}" text-anchor="end" class="vc-svg-axis">0</text>

      ${reachableMarkup}

      <rect x="${currX}" y="${currY}" width="${barW}" height="${currH}" rx="6" fill="${currArr > 0 ? '#007aff' : '#e8e8ed'}" stroke="${currArr > 0 ? '#0066d6' : '#8e8e93'}" stroke-width="1.25" />
      <text x="${currCx}" y="${currY - 8}" text-anchor="middle" fill="${currArr > 0 ? '#0058c4' : '#6e6e73'}" class="vc-svg-val">${escapeXml(currTopLabel)}</text>
      <text x="${currCx}" y="216" text-anchor="middle" class="vc-svg-label">Current ARR (R1)</text>
      <text x="${currCx}" y="233" text-anchor="middle" class="vc-svg-sub">${escapeXml(currSub1)}</text>
      <text x="${currCx}" y="249" text-anchor="middle" class="vc-svg-sub-strong">${escapeXml(currSub2)}</text>

      <rect x="${reqX}" y="${reqY}" width="${barW}" height="${reqH}" rx="6" fill="${reqFill}" stroke="${reqStroke}" stroke-width="1.25" />
      <text x="${reqCx}" y="${reqY - 8}" text-anchor="middle" fill="${reqValColor}" class="vc-svg-val">${escapeXml(reqTopLabel)}</text>
      <text x="${reqCx}" y="216" text-anchor="middle" class="vc-svg-label">Required ARR (R2)</text>
      <text x="${reqCx}" y="233" text-anchor="middle" class="vc-svg-sub">${escapeXml(reqSub1)}</text>
      <text x="${reqCx}" y="249" text-anchor="middle" class="vc-svg-sub-strong">${escapeXml(reqSub2)}</text>

      <line x1="192" y1="110" x2="378" y2="110" stroke="#6e6e73" stroke-width="1.5" />
      <polygon points="384,110 375,105 375,115" fill="#6e6e73" />

      <rect x="200" y="52" width="172" height="44" rx="10" fill="${pillFill}" stroke="${pillStroke}" stroke-width="1" />
      <text x="286" y="71" text-anchor="middle" fill="${pillTextColor}" class="vc-svg-val-sm">${escapeXml(bridgeTitle)}</text>
      <text x="286" y="88" text-anchor="middle" fill="${pillTextColor}" class="vc-svg-sub-pill">${escapeXml(bridgePace)}</text>

      <rect x="196" y="122" width="180" height="24" rx="12" fill="${compFill}" stroke="${compStroke}" stroke-width="1" />
      <text x="286" y="138" text-anchor="middle" fill="${compColor}" class="vc-svg-sub-pill">${escapeXml(compPill)}</text>
    </svg>
  `.trim();
}

export function renderFeasibleAskBarSvg(
  output: CheckOutput,
  fxInrPerUsd: number = DEFAULT_FX_INR_PER_USD
): string {
  const { input, feasibleAskBand, unit } = output;
  if (!output.validation.valid || input.annualRevenue <= 0 || feasibleAskBand.stretchAsk <= 0) {
    return `
      <svg class="vc-chart-svg vc-chart-svg--bar" viewBox="0 0 480 60" role="img" aria-label="Feasible ask band for revenue-stage rounds">
        <title>Feasible ask band</title>
        <rect x="1" y="1" width="478" height="58" rx="8" fill="#f3f3f3" stroke="#d2d2d7" />
        <text x="240" y="34" text-anchor="middle" class="vc-svg-sub">Pre-revenue: DeepTech Round Planner (coming soon).</text>
      </svg>
    `.trim();
  }

  const { ask } = input;
  const effectiveBurnNeed =
    (input.monthlyBurn ?? 0) > 0
      ? (input.monthlyBurn ?? 0) * input.monthsToNextRound
      : input.cashNeeded;
  const { reachableAsk, stretchAsk } = feasibleAskBand;
  const maxVal = Math.max(ask, stretchAsk * 1.25, effectiveBurnNeed, 1);

  const x0 = 16;
  const trackW = 448;
  const x1 = x0 + trackW;
  const trackY = 36;
  const trackH = 14;

  const toX = (val: number): number => {
    const ratio = Math.min(1, Math.max(0, val / maxVal));
    return Math.round((x0 + ratio * trackW) * 10) / 10;
  };

  const xReach = Math.max(x0 + 4, toX(reachableAsk));
  const xStretch = Math.max(xReach + 4, toX(stretchAsk));
  const xAsk = toX(ask);
  const askLabelX = Math.max(76, Math.min(404, xAsk));

  const askLabel = `Your ask: ${formatMoney(ask, unit, undefined, fxInrPerUsd)}`;

  let burnMarkup = '';
  if (effectiveBurnNeed > 0) {
    const xBurn = toX(effectiveBurnNeed);
    const burnLabelX = Math.max(66, Math.min(414, xBurn));
    const burnText = `Burn floor: ${formatMoney(effectiveBurnNeed, unit, undefined, fxInrPerUsd)}`;
    burnMarkup = `
      <line x1="${xBurn}" y1="${trackY - 2}" x2="${xBurn}" y2="${trackY + trackH + 10}" stroke="#0066d6" stroke-width="2" />
      <text x="${burnLabelX}" y="74" text-anchor="middle" fill="#0066d6" class="vc-svg-sub-pill">${escapeXml(burnText)}</text>
    `;
  }

  return `
    <svg class="vc-chart-svg vc-chart-svg--bar" viewBox="0 0 480 86" role="img" aria-label="Feasible ask scale: ${escapeXml(askLabel)}, Conservative up to ${escapeXml(formatMoney(reachableAsk, unit, undefined, fxInrPerUsd))}, Stretch up to ${escapeXml(formatMoney(stretchAsk, unit, undefined, fxInrPerUsd))}">
      <title>Feasible ask scale vs. your ask</title>
      <rect x="${x0}" y="${trackY}" width="${Math.max(0, xReach - x0)}" height="${trackH}" rx="4" fill="#e8f7ec" stroke="#1b7a35" stroke-width="1" />
      <rect x="${xReach}" y="${trackY}" width="${Math.max(0, xStretch - xReach)}" height="${trackH}" fill="#fff4e0" stroke="#9a5800" stroke-width="1" />
      <rect x="${xStretch}" y="${trackY}" width="${Math.max(0, x1 - xStretch)}" height="${trackH}" rx="4" fill="#fdeceb" stroke="#c4281c" stroke-width="1" />

      <text x="${askLabelX}" y="18" text-anchor="middle" fill="#1c1c1c" class="vc-svg-label">${escapeXml(askLabel)}</text>
      <line x1="${xAsk}" y1="23" x2="${xAsk}" y2="${trackY + trackH + 4}" stroke="#1c1c1c" stroke-width="2" />
      <circle cx="${xAsk}" cy="${trackY + trackH / 2}" r="5" fill="#1c1c1c" stroke="#ffffff" stroke-width="1.5" />
      ${burnMarkup}
    </svg>
  `.trim();
}

export function renderMultipleShiftSvg(output: CheckOutput): string {
  const { input, metrics } = output;
  const preMult = metrics.impliedPreRevenueMultiple.value;
  const postMult = metrics.impliedPostRevenueMultiple.value;
  const nextMult = input.nextRoundMultiple;

  if (
    !output.validation.valid ||
    input.annualRevenue <= 0 ||
    preMult === null ||
    postMult === null
  ) {
    return `
      <svg class="vc-chart-svg vc-chart-svg--mini-shift" viewBox="0 0 320 112" role="img" aria-label="Multiple shift chart awaiting current revenue">
        <title>Valuation multiple shift</title>
        <rect x="1" y="1" width="318" height="110" rx="8" fill="#f3f3f3" stroke="#d2d2d7" />
        <text x="160" y="60" text-anchor="middle" class="vc-svg-sub">Pre-revenue: multiple shift needs ARR.</text>
      </svg>
    `.trim();
  }

  const maxVal = Math.max(preMult, postMult, nextMult, 1);
  const x0 = 66;
  const trackW = 196;
  const barW = (val: number): number =>
    val <= 0 ? 2 : Math.max(4, Math.round((val / maxVal) * trackW));

  const preW = barW(preMult);
  const postW = barW(postMult);
  const r2W = barW(nextMult);
  const xR2 = x0 + r2W;

  const isCompressed = postMult > nextMult;
  const r2Fill = isCompressed ? '#ff9500' : '#1b7a35';
  const r2Stroke = isCompressed ? '#9a5800' : '#155d28';
  const r2ValColor = isCompressed ? '#9a5800' : '#1b7a35';
  const captionText = isCompressed
    ? `R1 post is ${formatMultiple(postMult / nextMult, 1)} above R2 target`
    : 'R1 post sits at or below R2 target';

  const ariaLabel = `Multiple shift: R1 Pre ${formatMultiple(preMult, 1)}, R1 Post ${formatMultiple(postMult, 1)}, R2 Target ${formatMultiple(nextMult, 1)}`;

  return `
    <svg class="vc-chart-svg vc-chart-svg--mini-shift" viewBox="0 0 320 112" role="img" aria-label="${escapeXml(ariaLabel)}">
      <title>Valuation multiple shift from R1 to R2</title>
      <text x="0" y="27" text-anchor="start" class="vc-svg-sub-strong">R1 Pre</text>
      <rect x="${x0}" y="14" width="${preW}" height="18" rx="4" fill="#e8e8ed" stroke="#6e6e73" stroke-width="1" />
      <text x="318" y="27" text-anchor="end" fill="#1c1c1c" class="vc-svg-sub-strong">${escapeXml(formatMultiple(preMult, 1))}</text>

      <text x="0" y="55" text-anchor="start" class="vc-svg-sub-strong">R1 Post</text>
      <rect x="${x0}" y="42" width="${postW}" height="18" rx="4" fill="#007aff" stroke="#0066d6" stroke-width="1" />
      <text x="318" y="55" text-anchor="end" fill="#0058c4" class="vc-svg-sub-strong">${escapeXml(formatMultiple(postMult, 1))}</text>

      <text x="0" y="83" text-anchor="start" class="vc-svg-sub-strong">R2 Target</text>
      <rect x="${x0}" y="70" width="${r2W}" height="18" rx="4" fill="${r2Fill}" stroke="${r2Stroke}" stroke-width="1" />
      <text x="318" y="83" text-anchor="end" fill="${r2ValColor}" class="vc-svg-sub-strong">${escapeXml(formatMultiple(nextMult, 1))}</text>

      <line x1="${xR2}" y1="10" x2="${xR2}" y2="92" stroke="${r2Stroke}" stroke-width="1.25" stroke-dasharray="3 3" />
      <text x="0" y="107" text-anchor="start" fill="${r2ValColor}" class="vc-svg-sub-pill">${escapeXml(captionText)}</text>
    </svg>
  `.trim();
}

export function renderCagrGaugeSvg(output: CheckOutput): string {
  const { input, metrics, verdict, effectiveVerdictBands } = output;
  const cagrRaw = metrics.impliedCagrPct.value;

  if (!output.validation.valid || input.annualRevenue <= 0 || cagrRaw === null) {
    return `
      <svg class="vc-chart-svg vc-chart-svg--mini-cagr" viewBox="0 0 320 112" role="img" aria-label="Required CAGR benchmark gauge awaiting current revenue">
        <title>Required CAGR benchmark gauge</title>
        <rect x="1" y="1" width="318" height="110" rx="8" fill="#f3f3f3" stroke="#d2d2d7" />
        <text x="160" y="60" text-anchor="middle" class="vc-svg-sub">Pre-revenue: CAGR check needs ARR.</text>
      </svg>
    `.trim();
  }

  const reachCagr = effectiveVerdictBands.reachableCagrPct;
  const stretchCagr = effectiveVerdictBands.stretchCagrPct;
  const cagr = Math.max(0, cagrRaw);
  const maxScale = Math.max(stretchCagr * 1.45, cagr * 1.12, 280);

  const x0 = 12;
  const trackW = 296;
  const x1 = x0 + trackW;
  const trackY = 42;
  const trackH = 16;

  const toX = (val: number): number => {
    const ratio = Math.min(1, Math.max(0, val / maxScale));
    return Math.round((x0 + ratio * trackW) * 10) / 10;
  };

  const xReach = Math.max(x0 + 4, toX(reachCagr));
  const xStretch = Math.max(xReach + 4, toX(stretchCagr));
  const xPin = toX(cagr);
  const labelX = Math.max(58, Math.min(262, xPin));

  let pinColor = '#1b7a35';
  let captionText = `Within ${formatPercent(reachCagr, 0)}/yr conservative CAGR`;
  if (verdict.level === 'stretch' || (cagr > reachCagr && cagr <= stretchCagr)) {
    pinColor = '#9a5800';
    captionText = `Inside ${formatPercent(reachCagr, 0)} to ${formatPercent(stretchCagr, 0)}/yr stretch CAGR`;
  } else if (verdict.level === 'stiff' || cagr > stretchCagr) {
    pinColor = '#c4281c';
    captionText = `${formatMultiple(cagr / reachCagr, 1)} above ${formatPercent(reachCagr, 0)}/yr conservative CAGR`;
  }

  const pinLabel = `Your CAGR: ${formatPercent(cagr, 0)}/yr`;

  return `
    <svg class="vc-chart-svg vc-chart-svg--mini-cagr" viewBox="0 0 320 112" role="img" aria-label="${escapeXml(pinLabel)}, ${escapeXml(captionText)}">
      <title>Required CAGR vs. conservative and stretch benchmarks</title>
      <text x="${labelX}" y="22" text-anchor="middle" fill="${pinColor}" class="vc-svg-sub-strong">${escapeXml(pinLabel)}</text>

      <rect x="${x0}" y="${trackY}" width="${Math.max(0, xReach - x0)}" height="${trackH}" rx="4" fill="#e8f7ec" stroke="#1b7a35" stroke-width="1" />
      <rect x="${xReach}" y="${trackY}" width="${Math.max(0, xStretch - xReach)}" height="${trackH}" fill="#fff4e0" stroke="#9a5800" stroke-width="1" />
      <rect x="${xStretch}" y="${trackY}" width="${Math.max(0, x1 - xStretch)}" height="${trackH}" rx="4" fill="#fdeceb" stroke="#c4281c" stroke-width="1" />

      <text x="${x0}" y="75" text-anchor="start" class="vc-svg-axis">0%</text>
      <text x="${xReach}" y="75" text-anchor="middle" fill="#1b7a35" class="vc-svg-axis">${escapeXml(formatPercent(reachCagr, 0))}</text>
      <text x="${xStretch}" y="75" text-anchor="middle" fill="#9a5800" class="vc-svg-axis">${escapeXml(formatPercent(stretchCagr, 0))}</text>

      <line x1="${xPin}" y1="28" x2="${xPin}" y2="62" stroke="${pinColor}" stroke-width="2" />
      <circle cx="${xPin}" cy="${trackY + trackH / 2}" r="4.5" fill="${pinColor}" stroke="#ffffff" stroke-width="1.5" />

      <text x="${x0}" y="104" text-anchor="start" fill="${pinColor}" class="vc-svg-sub-pill">${escapeXml(captionText)}</text>
    </svg>
  `.trim();
}

export function renderOwnershipWaterfallSvg(output: CheckOutput): string {
  const waterfall = computeOwnershipWaterfall(output.input);
  if (!waterfall.valid || waterfall.steps.length === 0) {
    return `
      <svg class="vc-chart-svg vc-chart-svg--waterfall" viewBox="0 0 680 236" role="img" aria-label="Founder ownership waterfall awaiting valid dilution inputs">
        <title>Founder ownership waterfall</title>
        <rect x="1" y="1" width="678" height="234" rx="8" fill="#f3f3f3" stroke="#d2d2d7" />
        <text x="340" y="122" text-anchor="middle" class="vc-svg-sub">Enter valid dilution and ESOP values to render the ownership waterfall.</text>
      </svg>
    `.trim();
  }

  const steps = waterfall.steps;
  const count = steps.length;
  const plotLeft = 48;
  const plotRight = 664;
  const plotW = plotRight - plotLeft;
  const gap = count >= 7 ? 20 : count === 6 ? 28 : 38;
  const barW = Math.min(72, Math.floor((plotW - (count - 1) * gap) / count));
  const totalW = count * barW + (count - 1) * gap;
  const startX = Math.round(plotLeft + (plotW - totalW) / 2);

  const topY = 34;
  const baselineY = 176;
  const maxBarH = baselineY - topY;
  const midY = Math.round((topY + baselineY) / 2);

  const toY = (pct: number): number => {
    const clamped = Math.min(100, Math.max(0, pct));
    return Math.round((baselineY - (clamped / 100) * maxBarH) * 10) / 10;
  };

  const palette = (step: (typeof steps)[number]) => {
    if (step.kind === 'total') {
      if (step.tone === 'primary') {
        return { fill: '#007aff', stroke: '#0066d6', valFill: '#0058c4' };
      }
      if (step.tone === 'good') {
        return { fill: '#1b7a35', stroke: '#155d28', valFill: '#1b7a35' };
      }
      if (step.tone === 'warn') {
        return { fill: '#ff9500', stroke: '#9a5800', valFill: '#9a5800' };
      }
      return { fill: '#e8e8ed', stroke: '#6e6e73', valFill: '#1c1c1c' };
    }
    if (step.tone === 'bad') {
      return { fill: '#fdeceb', stroke: '#c4281c', valFill: '#c4281c' };
    }
    return { fill: '#fff4e0', stroke: '#9a5800', valFill: '#9a5800' };
  };

  const connectorsMarkup = steps
    .slice(0, -1)
    .map((step, idx) => {
      const levelPct = step.kind === 'total' ? step.endPct : step.startPct;
      const connY = toY(levelPct);
      const xStart = startX + idx * (barW + gap) + barW;
      const xEnd = startX + (idx + 1) * (barW + gap);
      return `<line x1="${xStart}" y1="${connY}" x2="${xEnd}" y2="${connY}" stroke="#c7c7cc" stroke-width="1" stroke-dasharray="3 3" />`;
    })
    .join('');

  const barsMarkup = steps
    .map((step, idx) => {
      const x = startX + idx * (barW + gap);
      const cx = x + barW / 2;
      const yTop = toY(step.endPct);
      const yBottom = toY(step.startPct);
      const rectH = Math.max(4, Math.round((yBottom - yTop) * 10) / 10);
      const colors = palette(step);
      const topValText =
        step.kind === 'drop'
          ? `−${formatPercent(Math.abs(step.deltaPct), 1)}`
          : formatPercent(step.endPct, 1);

      return `
        <g>
          <rect x="${x}" y="${yTop}" width="${barW}" height="${rectH}" rx="5" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="1.25" />
          <text x="${cx}" y="${Math.max(15, yTop - 7)}" text-anchor="middle" fill="${colors.valFill}" class="vc-svg-val-sm">${escapeXml(topValText)}</text>
          <text x="${cx}" y="196" text-anchor="middle" class="vc-svg-label">${escapeXml(step.label)}</text>
          <text x="${cx}" y="213" text-anchor="middle" class="vc-svg-sub">${escapeXml(step.sublabel)}</text>
        </g>
      `;
    })
    .join('');

  const ariaLabel = `Founder ownership waterfall: ${formatPercent(waterfall.founderPreR1Pct, 1)} pre-R1 to ${formatPercent(waterfall.founderPostR1Pct, 1)} post-R1 and ${formatPercent(waterfall.founderPostR2Pct, 1)} post-R2`;

  return `
    <svg class="vc-chart-svg vc-chart-svg--waterfall" viewBox="0 0 680 236" role="img" aria-label="${escapeXml(ariaLabel)}">
      <title>Founder ownership waterfall across R0, R1, and illustrative R2</title>
      <line x1="${plotLeft}" y1="${topY}" x2="${plotRight}" y2="${topY}" stroke="#ececef" stroke-dasharray="3 3" />
      <line x1="${plotLeft}" y1="${midY}" x2="${plotRight}" y2="${midY}" stroke="#e5e5ea" stroke-dasharray="3 3" />
      <line x1="${plotLeft}" y1="${baselineY}" x2="${plotRight}" y2="${baselineY}" stroke="#c7c7cc" />

      <text x="${plotLeft - 6}" y="${topY + 4}" text-anchor="end" class="vc-svg-axis">100%</text>
      <text x="${plotLeft - 6}" y="${midY + 4}" text-anchor="end" class="vc-svg-axis">50%</text>
      <text x="${plotLeft - 6}" y="${baselineY + 4}" text-anchor="end" class="vc-svg-axis">0%</text>

      ${connectorsMarkup}
      ${barsMarkup}
    </svg>
  `.trim();
}
