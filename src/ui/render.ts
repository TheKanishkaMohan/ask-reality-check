import {
  ASSUMPTION_REFERENCES,
  DEFAULT_FX_INR_PER_USD,
  LABELS,
  PRESET_SCENARIOS,
  SECTOR_MULTIPLE_BENCHMARKS,
  UNIT_METADATA,
  computeAskDilutionHeatmap,
  computeOwnershipWaterfall,
  evaluateAsk,
  formatInputValue,
  formatMoney,
  formatMonthlyMoney,
  formatMultiple,
  formatNumber,
  formatPercent,
  fromCr,
  solveGoalSeek,
  toCr,
  type CheckOutput,
  type CurrencyUnit,
  type GoalSeekTarget,
  type ValidationField,
  type VerdictLevel,
} from '../engine';
import {
  renderCagrGaugeSvg,
  renderFeasibleAskBarSvg,
  renderMultipleShiftSvg,
  renderOwnershipWaterfallSvg,
  renderRevenueBridgeSvg,
  renderValuationLadderSvg,
} from './charts';
import { syncStateToUrl, type AppState } from './state';
import { downloadXlsxReport } from './xlsx';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderTraceDetails(
  traceId: string,
  formula: string,
  calculation: string,
  _isAssumption: boolean,
  origin: string,
  openTraces: Set<string>
): string {
  const isOpen = openTraces.has(traceId) ? ' open' : '';
  const chipLabel = LABELS.ruleOfThumbTag;
  const trimmedOrigin = origin.trim();
  const showDetailOrigin =
    trimmedOrigin.length > 0 &&
    trimmedOrigin.toLowerCase() !== chipLabel.toLowerCase();
  return `
    <details class="trace" data-trace-id="${escapeHtml(traceId)}"${isOpen}>
      <summary>How this is calculated</summary>
      <div class="trace-body">
        <div class="trace-formula">${escapeHtml(formula)}</div>
        <div class="trace-calc">${escapeHtml(calculation)}</div>
        <div class="trace-origin">
          <span class="chip chip--rolling">${escapeHtml(chipLabel)}</span>
          ${showDetailOrigin ? `<span>${escapeHtml(trimmedOrigin)}</span>` : ''}
        </div>
      </div>
    </details>
  `;
}

function renderInfoTip(id: string, label: string, text: string, alignRight = false): string {
  const cls = alignRight ? 'tkm-tip tkm-tip--right' : 'tkm-tip';
  return `
    <span class="${cls}">
      <button type="button" class="tkm-tip__btn" aria-label="About ${escapeHtml(label)}" aria-expanded="false" aria-describedby="${escapeHtml(id)}">i</button>
      <span id="${escapeHtml(id)}" role="tooltip" class="tkm-tip__panel">${escapeHtml(text)}</span>
    </span>
  `;
}

function renderSignalCard(
  metricId: string,
  label: string,
  valueText: string,
  subtitleText: string,
  extraText: string | null,
  badgeText: string | null,
  traceHtml: string,
  visualHtml: string | null = null
): string {
  const badgeHtml = badgeText
    ? `<span class="chip chip--primary">${escapeHtml(badgeText)}</span>`
    : '';
  const extraHtml = extraText
    ? `<span class="vc-tile__extra">${escapeHtml(extraText)}</span>`
    : '';
  const visualWrap = visualHtml
    ? `<div class="vc-tile__visual">${visualHtml}</div>`
    : '';
  return `
    <div class="vc-tile" data-metric-id="${escapeHtml(metricId)}">
      <div class="vc-tile__main">
        <span class="l">
          <span>${escapeHtml(label)}</span>
          ${badgeHtml}
        </span>
        <span class="v">${escapeHtml(valueText)}</span>
        <span class="n">${escapeHtml(subtitleText)}</span>
        ${extraHtml}
        ${visualWrap}
      </div>
      ${traceHtml}
    </div>
  `;
}

function renderBurnComparisonBar(
  output: CheckOutput,
  fxInrPerUsd: number = DEFAULT_FX_INR_PER_USD
): string {
  const { input, unit } = output;
  const monthlyBurn = input.monthlyBurn ?? 0;
  const effectiveBurnNeed =
    monthlyBurn > 0 ? monthlyBurn * input.monthsToNextRound : input.cashNeeded;
  if (!output.validation.valid || effectiveBurnNeed <= 0) return '';

  const ask = Math.max(0, input.ask);
  const cash = Math.max(0, effectiveBurnNeed);
  const diff = cash - ask;
  const maxVal = Math.max(ask, cash, 1);
  const askW = Math.max(8, Math.round((ask / maxVal) * 420));
  const cashW = Math.max(8, Math.round((cash / maxVal) * 420));

  let chipCls = 'chip chip--rolling';
  let statusText = `Exact match: Ask equals ${formatMoney(cash, unit, undefined, fxInrPerUsd)} burn plan`;
  let askFill = '#007aff';

  if (diff > 0) {
    chipCls = 'chip chip--closed';
    statusText = `Shortfall: ${formatMoney(diff, unit, undefined, fxInrPerUsd)} below ${formatMoney(cash, unit, undefined, fxInrPerUsd)} burn need`;
    askFill = '#ff3b30';
  } else if (diff < 0) {
    chipCls = 'chip chip--open';
    statusText = `Buffer: ${formatMoney(Math.abs(diff), unit, undefined, fxInrPerUsd)} above ${formatMoney(cash, unit, undefined, fxInrPerUsd)} burn need`;
    askFill = '#1b7a35';
  }

  return `
    <div class="vc-burn-bar__head">
      <span><strong>Burn plan check</strong> (${formatMoney(ask, unit, undefined, fxInrPerUsd)} ask vs. ${formatMoney(cash, unit, undefined, fxInrPerUsd)} needed)</span>
      <span class="${chipCls}">${escapeHtml(statusText)}</span>
    </div>
    <svg class="vc-chart-svg vc-chart-svg--mini" viewBox="0 0 440 28" role="img" aria-label="${escapeXml(statusText)}">
      <rect x="0" y="2" width="440" height="10" rx="4" fill="#e8e8ed" />
      <rect x="0" y="2" width="${cashW}" height="10" rx="4" fill="#8e8e93" />
      <rect x="0" y="16" width="440" height="10" rx="4" fill="#e8e8ed" />
      <rect x="0" y="16" width="${askW}" height="10" rx="4" fill="${askFill}" />
    </svg>
  `;
}

const VERDICT_BADGE_MAP: Record<VerdictLevel, { cls: string; label: string }> = {
  reachable: { cls: 'chip chip--open', label: LABELS.bands.reachable },
  stretch: { cls: 'chip chip--soon', label: LABELS.bands.stretch },
  stiff: { cls: 'chip chip--closed', label: LABELS.bands.stiff },
  invalid: { cls: 'chip chip--closed', label: LABELS.bands.invalid },
  incomplete: { cls: 'chip chip--rolling', label: LABELS.bands.incomplete },
};

export function mountCheckerApp(root: HTMLElement, initialState: AppState): void {
  const state: AppState = {
    unit: initialState.unit,
    fxInrPerUsd: initialState.fxInrPerUsd,
    activePresetId: initialState.activePresetId,
    input: {
      ...initialState.input,
      verdictBands: { ...initialState.input.verdictBands },
    },
    goalSeekTarget: initialState.goalSeekTarget,
    goalSeekGrowth: initialState.goalSeekGrowth,
  };

  const openTraces = new Set<string>();

  const rulesHtml = ASSUMPTION_REFERENCES.map(
    (item) => `
      <li class="vc-rule-item">
        <div class="vc-rule-item__head">
          <span class="vc-rule-item__title">${escapeHtml(item.parameter)}</span>
          <span class="vc-rule-item__chips">
            <span class="chip chip--primary">${escapeHtml(item.defaultValue)}</span>
            <span class="chip chip--rolling">${escapeHtml(item.origin)}</span>
          </span>
        </div>
        <p class="vc-rule-item__body">${escapeHtml(item.explanation)}</p>
      </li>
    `
  ).join('');

  const indiaNotesHtml = LABELS.indiaNotes
    .map(
      (note) =>
        `<li><strong>${escapeHtml(note.title)}:</strong> ${escapeHtml(note.body)}</li>`
    )
    .join('');

  const sectorRowsHtml = SECTOR_MULTIPLE_BENCHMARKS.map(
    (b) => `
      <tr>
        <td><strong>${escapeHtml(b.sector)}</strong></td>
        <td><button type="button" class="vc-mult-pick" data-mult="${b.p25}" aria-pressed="false" aria-label="Apply ${escapeHtml(b.sector)} P25 multiple ${formatMultiple(b.p25, 1)}">${escapeHtml(formatMultiple(b.p25, 1))}</button></td>
        <td><button type="button" class="vc-mult-pick" data-mult="${b.p50}" aria-pressed="false" aria-label="Apply ${escapeHtml(b.sector)} Median multiple ${formatMultiple(b.p50, 1)}">${escapeHtml(formatMultiple(b.p50, 1))}</button></td>
        <td><button type="button" class="vc-mult-pick" data-mult="${b.p75}" aria-pressed="false" aria-label="Apply ${escapeHtml(b.sector)} P75 multiple ${formatMultiple(b.p75, 1)}">${escapeHtml(formatMultiple(b.p75, 1))}</button></td>
        <td>${escapeHtml(b.note)}</td>
      </tr>
    `
  ).join('');

  root.innerHTML = `
    <a class="tkm-skip" href="#main-content">Skip to content</a>

    <header class="topbar" role="banner">
      <div class="wrap">
        <a class="brand" href="https://kanishkamohan.com">
          <img class="brand-logo" src="./logo-dark.png" width="32" height="32" alt="">
          <span class="brand-text">
            <b class="brand-wordmark">TheKanishkaMohan</b>
            <small class="brand-sub">Funding · DeepTech India</small>
          </span>
        </a>
        <nav class="nav" aria-label="Primary">
          <a href="https://funding.kanishkamohan.com/">Overview</a>
          <a href="https://funding.kanishkamohan.com/grants/">Grants</a>
          <a href="https://funding.kanishkamohan.com/equity/">Equity</a>
          <a href="https://funding.kanishkamohan.com/debt/">Debt</a>
          <a href="https://funding.kanishkamohan.com/subsidies/">Subsidies</a>
          <details class="nav-dropdown" id="nav-tools">
            <summary class="nav-dropdown__trigger is-current">
              <span>Tools</span>
              <svg class="nav-dropdown__caret" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2.5 4.25L6 7.75L9.5 4.25" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </summary>
            <div class="nav-dropdown__menu" role="group" aria-label="Tools">
              <a href="./" aria-current="page"><span>Valuation Check</span><span class="nav-dropdown__dot" aria-hidden="true"></span></a>
              <span class="nav-dropdown__soon" aria-disabled="true" title="Coming soon"><span>AIF Radar</span><span class="nav-soon__tag">Soon</span></span>
              <span class="nav-dropdown__soon" aria-disabled="true" title="Coming soon"><span>DeepTech Round Planner</span><span class="nav-soon__tag">Soon</span></span>
            </div>
          </details>
          <a href="https://funding.kanishkamohan.com/about/">About</a>
        </nav>
      </div>
    </header>

    <main id="main-content">
      <section class="section section--hero-compact">
        <div class="wrap">
          <h1>Valuation Check</h1>
          <p class="vc-hero-lead">${escapeHtml(LABELS.introFraming)}</p>
        </div>
      </section>

      <div class="vc-sticky-strip" id="sticky-result-strip" role="region" aria-label="Pinned pricing summary" hidden>
        <div class="wrap vc-sticky-strip__inner">
          <a href="#verdict-box" class="vc-sticky-strip__link" id="sticky-result-link">
            <span class="chip chip--open vc-sticky-strip__badge" id="sticky-badge">${escapeHtml(LABELS.bands.reachable)}</span>
            <span class="vc-sticky-strip__summary" id="sticky-summary"></span>
            <span class="vc-sticky-strip__cta" aria-hidden="true"><span class="vc-hide-xs">Jump to result </span>↓</span>
          </a>
        </div>
      </div>

      <section class="section band section--tight" aria-label="Valuation calculator">
        <div class="wrap">
          <h2 class="tkm-sr">Valuation Check calculator</h2>

          <div class="tkm-toolbar">
            <div class="vc-toolbar-left">
              <div class="tkm-segmented" id="unit-switcher" role="group" aria-label="Currency and unit selection">
                <button type="button" class="tkm-seg-btn" data-unit="INR_CR" aria-pressed="true">₹ Cr</button>
                <button type="button" class="tkm-seg-btn" data-unit="INR_LAKH" aria-pressed="false">₹ Lakh</button>
                <button type="button" class="tkm-seg-btn" data-unit="USD_M" aria-pressed="false">USD ($M)</button>
              </div>
              <div class="vc-fx-wrap" id="fx-wrap" hidden>
                <label for="fx-rate">FX ₹/USD</label>
                <input id="fx-rate" class="tkm-input vc-fx-input" type="number" step="0.1" min="1" max="500" inputmode="decimal" aria-label="USD to INR exchange rate" />
              </div>
            </div>
            <div class="vc-toolbar-actions">
              <button type="button" id="download-xlsx-btn" class="btn btn--primary btn--sm" aria-label="Download scenario workbook as XLSX">
                Download XLSX
              </button>
            </div>
          </div>

          <nav class="vc-jump-nav" aria-label="On this page">
            <span class="vc-jump-nav__label">On this page</span>
            <div class="vc-jump-nav__links">
              <a href="#verdict-box" class="vc-jump-link">Result</a>
              <a href="#valuation-card" class="vc-jump-link">Ladder</a>
              <a href="#solver-card" class="vc-jump-link">Solver</a>
              <a href="#heatmap-card" class="vc-jump-link">Sensitivity</a>
              <a href="#assumptions-drawer" class="vc-jump-link" data-open-target="#assumptions-drawer">Rules</a>
              <a href="#india-notes-drawer" class="vc-jump-link" data-open-target="#india-notes-drawer">India notes</a>
            </div>
          </nav>

          <div class="vc-config-stack">
            <section class="vc-card vc-config-card" id="config-card" aria-label="Inputs">
              <div class="vc-card__head">
                <div>
                  <p class="vc-eyebrow">Configuration: R1 &amp; R2</p>
                  <small class="vc-hint"><span id="unit-hint">Amounts in ₹ Cr</span> · R0 Last · R1 Now · R2 Next</small>
                </div>
                <div class="vc-preset-bar" id="presets" role="group" aria-label="Sample scenarios"></div>
              </div>
              <p id="pnote" class="vc-preset-note" hidden></p>

              <div class="vc-grid-4">
                <div class="vc-field">
                  <div class="vc-field__head">
                    <label for="mrr">Current monthly revenue</label>
                    ${renderInfoTip(
                      'tip-mrr',
                      'Current monthly revenue',
                      'Current monthly run-rate revenue today. Editing this automatically updates annual revenue (x 12).'
                    )}
                  </div>
                  <input id="mrr" class="tkm-input" type="number" step="any" min="0" inputmode="decimal" />
                  <small id="mrr-sub">₹ Cr/mo (synced with ARR ÷ 12)</small>
                </div>
                <div class="vc-field">
                  <div class="vc-field__head">
                    <label for="rev">Current annual revenue (ARR)</label>
                    ${renderInfoTip(
                      'tip-rev',
                      'Current annual revenue (ARR)',
                      'Annualised revenue run-rate today (monthly x 12). Sets your starting revenue base for R1 multiples and R2 growth.'
                    )}
                  </div>
                  <input id="rev" class="tkm-input" type="number" step="any" min="0" inputmode="decimal" />
                  <small id="rev-sub">₹ Cr (monthly x 12)</small>
                  <div class="vc-field-error" id="err-rev" hidden></div>
                </div>
                <div class="vc-field">
                  <div class="vc-field__head">
                    <label for="ask">R1 ask (raise)</label>
                    ${renderInfoTip(
                      'tip-ask',
                      'R1 ask',
                      'Capital you plan to raise in this round (R1). Together with R1 dilution, this sets your R1 valuation.',
                      true
                    )}
                  </div>
                  <input id="ask" class="tkm-input" type="number" step="any" min="0" inputmode="decimal" />
                  <small id="ask-unit-sub">₹ Cr target raise in R1</small>
                  <div class="vc-field-error" id="err-ask" hidden></div>
                </div>
                <div class="vc-field">
                  <div class="vc-field__head">
                    <label for="dil">R1 dilution (%)</label>
                    ${renderInfoTip(
                      'tip-dil',
                      'R1 dilution',
                      'Equity % sold to new investors in R1 (usually 20% to 25%). Lower dilution raises your implied valuation.',
                      true
                    )}
                  </div>
                  <input id="dil" class="tkm-input" type="number" step="any" min="0.1" max="99.9" inputmode="decimal" />
                  <small>% equity sold in R1 (20% to 25% std)</small>
                  <div class="vc-field-error" id="err-dil" hidden></div>
                </div>
              </div>

              <div class="vc-grid-4">
                <div class="vc-field">
                  <div class="vc-field__head">
                    <label for="esop">ESOP pool created this round (% of post-money)</label>
                    ${renderInfoTip(
                      'tip-esop',
                      'ESOP pool created this round',
                      'Option pool carved out at R1 as a % of post-money valuation. It comes out of pre-money, reducing founders effective pre-money while R1 investor dilution stays unchanged.'
                    )}
                  </div>
                  <input id="esop" class="tkm-input" type="number" step="any" min="0" max="50" inputmode="decimal" />
                  <small>0% if none; deducted from pre-money</small>
                  <div class="vc-field-error" id="err-esop" hidden></div>
                </div>
                <div class="vc-field">
                  <div class="vc-field__head">
                    <label for="months">Months to R2</label>
                    ${renderInfoTip(
                      'tip-months',
                      'Months to R2',
                      'Runway months from R1 close to your next priced round (R2). Standard seed staging is 15 to 18 months.'
                    )}
                  </div>
                  <input id="months" class="tkm-input" type="number" step="1" min="1" max="120" inputmode="numeric" />
                  <small>15 to 18 mo standard</small>
                  <div class="vc-field-error" id="err-months" hidden></div>
                </div>
                <div class="vc-field">
                  <div class="vc-field__head">
                    <label for="step">R2 valuation step-up (x)</label>
                    ${renderInfoTip(
                      'tip-step',
                      'R2 valuation step-up',
                      'Minimum valuation jump R1 investors expect between R1 post-money and R2 pre-money (R2 Pre = R1 Post x Step-up). Benchmark is 2x.',
                      true
                    )}
                  </div>
                  <input id="step" class="tkm-input" type="number" step="any" min="1" inputmode="decimal" />
                  <small>R2 pre ÷ R1 post (2x std)</small>
                  <div class="vc-field-error" id="err-step" hidden></div>
                </div>
                <div class="vc-field">
                  <div class="vc-field__head">
                    <label for="mult">R2 revenue multiple (x ARR)</label>
                    ${renderInfoTip(
                      'tip-mult',
                      'R2 revenue multiple',
                      'Expected valuation-to-ARR multiple in R2. Revenue multiples fit software and high-margin brands best. You can also click any cell in Indicative sector multiples below to apply it.',
                      true
                    )}
                  </div>
                  <input id="mult" class="tkm-input" type="number" step="any" min="0.1" inputmode="decimal" />
                  <small>x ARR at next round (R2)</small>
                  <div class="vc-field-error" id="err-mult" hidden></div>
                </div>
              </div>

              <div class="vc-burn-row">
                <div class="vc-field">
                  <div class="vc-field__head">
                    <label for="burn">Monthly net burn (optional)</label>
                    ${renderInfoTip(
                      'tip-burn',
                      'Monthly net burn',
                      'Optional monthly cash burn rate. When entered, total cash needed = Monthly net burn x Months to R2. Leave blank to hide the burn check.'
                    )}
                  </div>
                  <input id="burn" class="tkm-input" type="number" step="any" min="0" placeholder="Optional (leave blank if unsure)" inputmode="decimal" />
                  <small id="burn-sub">₹ Cr/mo (0 or blank hides burn check)</small>
                  <div class="vc-field-error" id="err-burn" hidden></div>
                </div>
                <p class="vc-burn-readout" id="burn-cash-readout">
                  Optional. Leave blank to hide burn check.
                </p>
              </div>

              <div class="vc-config-foot">
                <a href="#verdict-box" id="see-result-btn" class="btn btn--primary btn--sm">See your result ↓</a>
              </div>
            </section>

            <details class="tkm-accordion" id="settings-drawer">
              <summary>
                <span class="tkm-accordion__title">Last round (R0) &amp; ownership waterfall</span>
                <span class="tkm-accordion__right">
                  <span class="chip chip--rolling" id="settings-summary-chip">Optional</span>
                  <span class="tkm-accordion__plus" aria-hidden="true"></span>
                </span>
              </summary>
              <div class="tkm-accordion__body tkm-accordion__body--pad">
                <p class="vc-r0-note">
                  Optional starting point before R1. R0 checks whether your R1 ask jump is realistic and projects founder ownership through R0, R1 ESOP, R1, and an illustrative R2 round.
                </p>
                <div class="vc-grid-3">
                  <div class="vc-field">
                    <div class="vc-field__head">
                      <label for="prior">R0 raise</label>
                      ${renderInfoTip(
                        'tip-prior',
                        'R0 raise',
                        'Total capital raised in your previous round before R1. Early VCs expect your R1 ask to be 3x to 4x a prior priced round.'
                      )}
                    </div>
                    <input id="prior" class="tkm-input" type="number" step="any" min="0" inputmode="decimal" />
                    <small id="prior-sub">₹ Cr (0 if none)</small>
                    <div class="vc-field-error" id="err-prior" hidden></div>
                  </div>
                  <div class="vc-field">
                    <div class="vc-field__head">
                      <label for="r0-dil">R0 dilution</label>
                      ${renderInfoTip(
                        'tip-r0-dil',
                        'R0 dilution',
                        'Equity % sold in R0. Leave blank to assume 15% when a priced R0 raise is entered, or 0% if none.',
                        true
                      )}
                    </div>
                    <input id="r0-dil" class="tkm-input" type="number" step="any" min="0" max="89.9" placeholder="Auto (15% if priced)" inputmode="decimal" />
                    <small id="r0-dil-sub">% equity sold in R0 (optional)</small>
                    <div class="vc-field-error" id="err-r0-dil" hidden></div>
                  </div>
                  <div class="vc-field">
                    <div class="vc-field__head">
                      <label for="r2-dil">Illustrative R2 dilution</label>
                      ${renderInfoTip(
                        'tip-r2-dil',
                        'Illustrative R2 dilution',
                        'Illustrative equity % sold in R2 (20% typical). Used only to project post-R2 founder stake in the ownership waterfall.',
                        true
                      )}
                    </div>
                    <input id="r2-dil" class="tkm-input" type="number" step="any" min="0.1" max="89.9" inputmode="decimal" />
                    <small>% equity sold in R2 (20% std)</small>
                    <div class="vc-field-error" id="err-r2-dil" hidden></div>
                  </div>
                </div>

                <div class="vc-switch-row" id="priced-switch-row">
                  <input id="priced" type="checkbox" checked />
                  <div>
                    <label for="priced">R0 was a priced equity round</label>
                    <small>Checks the 3x to 4x raise jump rule. Uncheck for grants, notes, or founder cash.</small>
                  </div>
                </div>

                <div class="vc-waterfall-box" id="ownership-waterfall-box">
                  <div class="vc-waterfall-head">
                    <div>
                      <p class="vc-eyebrow">Founder ownership waterfall</p>
                      <small class="vc-hint">R0 → R1 ESOP → R1 dilution → illustrative R2</small>
                    </div>
                    <span class="chip chip--rolling" id="ownership-summary">100% → 80% → 64%</span>
                  </div>
                  <div id="ownership-waterfall" class="vc-chart-box"></div>
                  <div id="ownership-captable" class="vc-captable-strip" aria-label="Post-R1 ownership breakdown"></div>
                  <div id="ownership-trace-wrap"></div>
                </div>
              </div>
            </details>

            <details class="tkm-accordion" id="sector-benchmarks-drawer">
              <summary>
                <span class="tkm-accordion__title">Indicative sector revenue multiples (R2)</span>
                <span class="tkm-accordion__right">
                  <span class="chip chip--primary">Click to set R2 multiple</span>
                  <span class="tkm-accordion__plus" aria-hidden="true"></span>
                </span>
              </summary>
              <div class="tkm-accordion__body tkm-accordion__body--pad">
                <div class="vc-scroll">
                  <table class="vc-table vc-table--text vc-table--sector" aria-label="Indicative sector revenue multiples">
                    <thead>
                      <tr>
                        <th>Sector</th>
                        <th>P25</th>
                        <th>Median</th>
                        <th>P75</th>
                        <th>Why it varies</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${sectorRowsHtml}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          </div>

          <section class="vc-results-stack" aria-label="Results" aria-live="polite" id="results-panel">
            <div class="vc-card vc-verdict-card" id="verdict-box">
              <div class="vc-card__head">
                <p class="vc-eyebrow">${escapeHtml(LABELS.pricingCheckTitle)}</p>
                <span class="chip chip--open" id="vbadge">${escapeHtml(LABELS.bands.reachable)}</span>
              </div>
              <h3 class="vc-verdict-title" id="vh"></h3>
              <p class="vc-result-disclaimer" id="vdisclaimer">${escapeHtml(LABELS.resultDisclaimer)}</p>
              <div class="vc-verdict-stats" id="verdict-stats"></div>
              <p class="vc-esop-note" id="verdict-esop-note" hidden></p>
              <p class="vc-pre-rev-callout" id="verdict-prerev-callout" hidden></p>
              <ul class="vc-reasons" id="vreasons"></ul>
              <div class="vc-verdict-foot-row">
                <div class="vc-verdict-foot-meta">
                  <p class="vc-verdict-foot" id="verdict-band-badge"></p>
                  <span class="chip chip--rolling">${escapeHtml(LABELS.ruleOfThumbTag)}</span>
                </div>
                <p class="vc-source-note">${escapeHtml(LABELS.benchmarkSourceLine)}</p>
              </div>
            </div>

            <div class="vc-charts-grid">
              <div class="vc-card" id="valuation-card">
                <div class="vc-card__head">
                  <p class="vc-eyebrow">Valuation ladder</p>
                  <small class="vc-hint">R1 Pre + R1 Ask = R1 Post → R2 Pre</small>
                </div>
                <div id="valuation-chart" class="vc-chart-box"></div>
                <div id="valuation-trace-wrap"></div>
              </div>

              <div class="vc-card">
                <div class="vc-card__head">
                  <p class="vc-eyebrow">Revenue bridge</p>
                  <small class="vc-hint">Current ARR (R1) → Required ARR (R2)</small>
                </div>
                <div id="revenue-chart" class="vc-chart-box"></div>
                <div id="burn-bar" class="vc-burn-bar" hidden></div>
                <div id="revenue-trace-wrap"></div>
              </div>
            </div>

            <div class="vc-signals" id="signals-strip"></div>

            <div class="vc-analysis-grid">
              <div class="vc-card" id="solver-card" aria-label="Goal-seek calculator">
                <div class="vc-card__head">
                  <p class="vc-eyebrow">Goal-seek solver</p>
                </div>

                <div id="feasible-bar" class="vc-feasible-box"></div>
                <div class="vc-band-pills" id="band-pills"></div>

                <div class="vc-solver-controls">
                  <div class="vc-field">
                    <div class="vc-field__head">
                      <label for="gs-target">Solve backwards for</label>
                    </div>
                    <select id="gs-target" class="tkm-select">
                      <option value="max_ask">Max R1 ask for growth threshold</option>
                      <option value="required_revenue">Current ARR for this R1 ask</option>
                      <option value="required_dilution">R1 dilution for this ask &amp; ARR</option>
                    </select>
                  </div>
                  <div class="vc-field">
                    <div class="vc-field__head">
                      <label for="gs-growth">Target max growth (x)</label>
                      ${renderInfoTip(
                        'tip-gs-growth',
                        'Target max growth',
                        'Maximum R1-to-R2 revenue growth multiple threshold you think is realistic. Goal-Seek solves the largest R1 ask that stays within this threshold.',
                        true
                      )}
                    </div>
                    <input id="gs-growth" class="tkm-input" type="number" step="0.1" min="0.5" max="50" inputmode="decimal" />
                    <small id="gs-growth-hint">Required CAGR: 108%/yr over 18 mo</small>
                  </div>
                </div>

                <div class="vc-solver-output" id="gs-output"></div>
              </div>

              <div class="vc-card" id="heatmap-card" aria-label="Ask vs. dilution sensitivity grid">
                <div class="vc-card__head">
                  <div>
                    <p class="vc-eyebrow">Ask vs. dilution sensitivity</p>
                    <small class="vc-hint">Click any cell to apply R1 ask &amp; dilution.</small>
                  </div>
                  <div class="vc-heatmap-legend" aria-label="Pricing band legend">
                    <span class="vc-legend-label">Pricing:</span>
                    <span class="chip chip--open">${escapeHtml(LABELS.bands.reachable)}</span>
                    <span class="chip chip--soon">${escapeHtml(LABELS.bands.stretch)}</span>
                    <span class="chip chip--closed">${escapeHtml(LABELS.bands.stiff)}</span>
                  </div>
                </div>
                <div id="heatmap-wrap" class="vc-heatmap-wrap"></div>
                <details class="trace" id="sens-detail-drawer" data-trace-id="sens_detail_drawer">
                  <summary>Full valuation table at current ask</summary>
                  <div class="vc-scroll vc-detail-table-wrap">
                    <table class="vc-table vc-table--num" id="sens" aria-label="Dilution sensitivity table"></table>
                  </div>
                </details>
                <div id="heatmap-trace-wrap"></div>
              </div>
            </div>

            <details class="tkm-accordion" id="assumptions-drawer">
              <summary>
                <span class="tkm-accordion__title">How VCs do this math: 5 rules of thumb</span>
                <span class="tkm-accordion__right">
                  <span class="chip chip--rolling">${escapeHtml(LABELS.ruleOfThumbTag)}</span>
                  <span class="tkm-accordion__plus" aria-hidden="true"></span>
                </span>
              </summary>
              <div class="tkm-accordion__body tkm-accordion__body--pad">
                <p class="vc-source-banner">${escapeHtml(LABELS.benchmarkSourceLine)}</p>
                <ul class="vc-rules-list" aria-label="VC rules of thumb">
                  ${rulesHtml}
                </ul>
              </div>
            </details>

            <details class="tkm-accordion" id="india-notes-drawer">
              <summary>
                <span class="tkm-accordion__title">${escapeHtml(LABELS.indiaNotesTitle)}</span>
                <span class="tkm-accordion__right">
                  <span class="chip chip--rolling">${escapeHtml(LABELS.indiaNotesTag)} · ${escapeHtml(LABELS.indiaNotesAsOf)}</span>
                  <span class="tkm-accordion__plus" aria-hidden="true"></span>
                </span>
              </summary>
              <div class="tkm-accordion__body tkm-accordion__body--pad">
                <p class="vc-source-banner"><strong>${escapeHtml(LABELS.indiaNotesAsOf)}.</strong> Key Indian regulatory and valuation notes for equity rounds.</p>
                <ul class="vc-india-notes-list" aria-label="India valuation notes">
                  ${indiaNotesHtml}
                </ul>
              </div>
            </details>
          </section>

          <p class="vc-credit-footnote">
            Calculations run inside your browser; nothing leaves your device. Thanks to
            <a href="https://www.linkedin.com/pulse/rookie-fundraising-mistake-even-some-experienced-founders-sajith-pai-nvl2c/" target="_blank" rel="noopener noreferrer">Sajith Pai</a>
            for inspiring this tool.
          </p>
        </div>
      </section>

      <section class="section section--cta-strip">
        <div class="wrap tkm-cta-strip">
          <p class="tkm-cta-strip__copy">Sizing a DeepTech round or stress-testing your pitch numbers?</p>
          <a class="btn btn--primary" href="https://schedule.kanishkamohan.com" target="_blank" rel="noopener noreferrer">Book a free call</a>
        </div>
      </section>
    </main>

    <footer class="site-footer" role="contentinfo">
      <div class="wrap">
        <div class="site-footer__grid">
          <div class="site-footer__col">
            <h2>Work with me</h2>
            <ul>
              <li><a href="https://kanishkamohan.com/advisory" target="_blank" rel="noopener noreferrer">Advisory</a></li>
              <li><a href="https://kanishkamohan.com/about" target="_blank" rel="noopener noreferrer">About</a></li>
              <li><a href="https://schedule.kanishkamohan.com" target="_blank" rel="noopener noreferrer">Book a free call</a></li>
            </ul>
          </div>
          <div class="site-footer__col">
            <h2>Funding</h2>
            <ul>
              <li><a href="https://funding.kanishkamohan.com/grants/">Grants</a></li>
              <li><a href="https://funding.kanishkamohan.com/equity/">Equity</a></li>
              <li><a href="https://funding.kanishkamohan.com/debt/">Debt</a></li>
              <li><a href="https://funding.kanishkamohan.com/subsidies/">Subsidies</a></li>
              <li><a href="https://funding.kanishkamohan.com/about/">About &amp; Disclaimers</a></li>
            </ul>
          </div>
          <div class="site-footer__col is-current">
            <h2>Tools</h2>
            <ul>
              <li><span class="site-footer__soon" aria-disabled="true">AIF Radar <span class="site-footer__soon-tag">Soon</span></span></li>
              <li><a href="./">Valuation Check</a></li>
              <li><span class="site-footer__soon" aria-disabled="true">DeepTech Round Planner <span class="site-footer__soon-tag">Soon</span></span></li>
            </ul>
          </div>
          <div class="site-footer__col">
            <h2>Read</h2>
            <ul>
              <li><a href="https://funding.kanishkamohan.com/">Funding Resources</a></li>
              <li><a href="https://newsletter.kanishkamohan.com" target="_blank" rel="noopener noreferrer">TKM3D</a></li>
              <li><a href="https://kanishkamohan.substack.com/" target="_blank" rel="noopener noreferrer">Incrementally Original</a></li>
            </ul>
          </div>
          <div class="site-footer__col">
            <h2>Connect</h2>
            <ul>
              <li><a href="https://www.linkedin.com/in/kanishkamohan/" target="_blank" rel="noopener noreferrer">LinkedIn</a></li>
              <li><a href="mailto:mail@kanishkamohan.com">Email</a></li>
            </ul>
          </div>
        </div>
        <div class="site-footer__meta">
          <p class="site-footer__copy">
            © 2026 Kanishka Mohan. All rights reserved. Names, trademarks and excerpts belong to their respective owners. Summaries are AI-assisted and may contain errors. Confirm terms on the official page before applying. Not financial or legal advice.
          </p>
        </div>
      </div>
    </footer>
  `;

  // Grab DOM references
  const askEl = root.querySelector<HTMLInputElement>('#ask')!;
  const dilEl = root.querySelector<HTMLInputElement>('#dil')!;
  const mrrEl = root.querySelector<HTMLInputElement>('#mrr')!;
  const revEl = root.querySelector<HTMLInputElement>('#rev')!;
  const priorEl = root.querySelector<HTMLInputElement>('#prior')!;
  const r0DilEl = root.querySelector<HTMLInputElement>('#r0-dil')!;
  const pricedEl = root.querySelector<HTMLInputElement>('#priced')!;
  const stepEl = root.querySelector<HTMLInputElement>('#step')!;
  const multEl = root.querySelector<HTMLInputElement>('#mult')!;
  const monthsEl = root.querySelector<HTMLInputElement>('#months')!;
  const burnEl = root.querySelector<HTMLInputElement>('#burn')!;
  const esopEl = root.querySelector<HTMLInputElement>('#esop')!;
  const r2DilEl = root.querySelector<HTMLInputElement>('#r2-dil')!;
  const gsTargetEl = root.querySelector<HTMLSelectElement>('#gs-target')!;
  const gsGrowthEl = root.querySelector<HTMLInputElement>('#gs-growth')!;
  const fxWrap = root.querySelector<HTMLElement>('#fx-wrap')!;
  const fxEl = root.querySelector<HTMLInputElement>('#fx-rate')!;
  const presetsBox = root.querySelector<HTMLElement>('#presets')!;
  const presetNoteEl = root.querySelector<HTMLElement>('#pnote')!;
  const burnReadoutEl = root.querySelector<HTMLElement>('#burn-cash-readout')!;
  const settingsSummaryChip = root.querySelector<HTMLElement>('#settings-summary-chip')!;
  const configCardEl = root.querySelector<HTMLElement>('#config-card')!;
  const stickyStripEl = root.querySelector<HTMLElement>('#sticky-result-strip')!;
  const stickyBadgeEl = root.querySelector<HTMLElement>('#sticky-badge')!;
  const stickySummaryEl = root.querySelector<HTMLElement>('#sticky-summary')!;
  const unitSwitcher = root.querySelector<HTMLElement>('#unit-switcher')!;
  const downloadXlsxBtn = root.querySelector<HTMLButtonElement>('#download-xlsx-btn')!;
  const sectorDrawer = root.querySelector<HTMLElement>('#sector-benchmarks-drawer')!;
  const heatmapWrap = root.querySelector<HTMLElement>('#heatmap-wrap')!;
  const navTools = root.querySelector<HTMLDetailsElement>('#nav-tools');

  const syncStickyStrip = (): void => {
    const rect = configCardEl.getBoundingClientRect();
    stickyStripEl.hidden = rect.bottom > 0;
  };
  window.addEventListener('scroll', syncStickyStrip, { passive: true });
  if (typeof IntersectionObserver !== 'undefined') {
    const observer = new IntersectionObserver(() => syncStickyStrip(), { threshold: 0 });
    observer.observe(configCardEl);
  }

  root.querySelectorAll<HTMLAnchorElement>('.vc-jump-link[data-open-target]').forEach((link) => {
    link.addEventListener('click', () => {
      const targetSel = link.getAttribute('data-open-target');
      if (!targetSel) return;
      const drawer = root.querySelector<HTMLDetailsElement>(targetSel);
      if (drawer) drawer.open = true;
    });
  });

  if (navTools) {
    document.addEventListener('click', (e) => {
      if (navTools.open && !navTools.contains(e.target as Node)) {
        navTools.open = false;
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navTools.open) {
        const wasInside = navTools.contains(document.activeElement);
        navTools.open = false;
        if (wasInside) {
          navTools.querySelector<HTMLElement>('summary')?.focus();
        }
      }
    });
  }

  // Interactive (i) info tooltips
  const tips = Array.from(root.querySelectorAll<HTMLElement>('.tkm-tip'));
  function setTipParentOpen(tip: HTMLElement, isOpen: boolean): void {
    const field = tip.closest('.vc-field');
    if (field) {
      field.classList.toggle('is-tip-open', isOpen);
    }
  }
  function closeAllTips(except: HTMLElement | null, dismissed: boolean): void {
    tips.forEach((tip) => {
      if (tip === except) return;
      tip.removeAttribute('data-open');
      if (dismissed) tip.setAttribute('data-dismissed', 'true');
      else tip.removeAttribute('data-dismissed');
      const btn = tip.querySelector<HTMLButtonElement>('.tkm-tip__btn');
      if (btn) btn.setAttribute('aria-expanded', 'false');
      setTipParentOpen(tip, false);
    });
  }
  tips.forEach((tip) => {
    const btn = tip.querySelector<HTMLButtonElement>('.tkm-tip__btn');
    if (!btn) return;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const next = tip.getAttribute('data-open') !== 'true';
      closeAllTips(tip, false);
      tip.removeAttribute('data-dismissed');
      if (next) tip.setAttribute('data-open', 'true');
      else tip.removeAttribute('data-open');
      btn.setAttribute('aria-expanded', next ? 'true' : 'false');
      setTipParentOpen(tip, next);
    });
    tip.addEventListener('focusin', () => setTipParentOpen(tip, true));
    tip.addEventListener('focusout', () => {
      tip.removeAttribute('data-dismissed');
      if (tip.getAttribute('data-open') !== 'true') setTipParentOpen(tip, false);
    });
    tip.addEventListener('mouseenter', () => {
      tip.removeAttribute('data-dismissed');
      setTipParentOpen(tip, true);
    });
    tip.addEventListener('mouseleave', () => {
      if (tip.getAttribute('data-open') !== 'true') setTipParentOpen(tip, false);
    });
  });
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target || !target.closest('.tkm-tip')) {
      closeAllTips(null, false);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllTips(null, true);
    }
  });

  // Track open/close of <details class="trace">
  root.addEventListener(
    'toggle',
    (e) => {
      const target = e.target as HTMLElement;
      if (target && target.tagName === 'DETAILS' && target.classList.contains('trace')) {
        const id = target.getAttribute('data-trace-id');
        if (id) {
          if ((target as HTMLDetailsElement).open) openTraces.add(id);
          else openTraces.delete(id);
        }
      }
    },
    true
  );

  // Download XLSX action
  downloadXlsxBtn.addEventListener('click', () => {
    downloadXlsxReport(
      state.input,
      state.unit,
      state.goalSeekTarget,
      state.goalSeekGrowth,
      state.fxInrPerUsd
    );
    downloadXlsxBtn.textContent = 'Downloaded!';
    setTimeout(() => {
      downloadXlsxBtn.textContent = 'Download XLSX';
    }, 1800);
  });

  // Sector benchmark clickable multiples
  sectorDrawer.querySelectorAll<HTMLButtonElement>('button.vc-mult-pick').forEach((btn) => {
    btn.addEventListener('click', () => {
      const m = Number(btn.dataset.mult);
      if (Number.isFinite(m) && m > 0) {
        state.activePresetId = null;
        state.input.nextRoundMultiple = m;
        multEl.value = String(m);
        updateUI();
      }
    });
  });

  // Sensitivity heatmap clickable cells
  heatmapWrap.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement | null)?.closest<HTMLButtonElement>('button.vc-hm-cell');
    if (!btn) return;
    const nextAsk = Number(btn.dataset.ask);
    const nextDil = Number(btn.dataset.dil);
    if (!Number.isFinite(nextAsk) || !Number.isFinite(nextDil) || nextAsk <= 0 || nextDil <= 0) {
      return;
    }
    state.activePresetId = null;
    state.input.ask = Number(nextAsk.toFixed(4));
    state.input.dilutionPct = Number(nextDil.toFixed(1));
    populateInputsFromState();
    updateUI();
  });

  // Unit switcher (canonical internal state in ₹ Cr is never mutated)
  unitSwitcher.querySelectorAll<HTMLButtonElement>('button[data-unit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextUnit = btn.dataset.unit as CurrencyUnit;
      if (nextUnit === state.unit) return;
      state.unit = nextUnit;
      populateInputsFromState();
      updateUI();
    });
  });

  // Render Preset Buttons
  PRESET_SCENARIOS.forEach((p) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tkm-filter-btn';
    btn.textContent = p.shortLabel;
    btn.dataset.id = p.id;
    btn.setAttribute('aria-pressed', state.activePresetId === p.id ? 'true' : 'false');
    btn.addEventListener('click', () => {
      state.activePresetId = p.id;
      state.input = {
        ...p.input,
        verdictBands: { ...state.input.verdictBands },
      };
      populateInputsFromState();
      updateUI();
    });
    presetsBox.appendChild(btn);
  });

  function populateInputsFromState(skipElement?: HTMLElement): void {
    const { input, unit, fxInrPerUsd } = state;
    const toDisp = (crVal: number): string => formatInputValue(fromCr(crVal, unit, fxInrPerUsd));

    if (skipElement !== askEl) askEl.value = toDisp(input.ask);
    if (skipElement !== dilEl) dilEl.value = String(input.dilutionPct);
    if (skipElement !== revEl) revEl.value = toDisp(input.annualRevenue);
    if (skipElement !== mrrEl) mrrEl.value = toDisp(input.annualRevenue / 12);
    if (skipElement !== priorEl) {
      priorEl.value = input.priorRaise > 0 ? toDisp(input.priorRaise) : '0';
    }
    if (skipElement !== r0DilEl) {
      r0DilEl.value = input.priorDilutionPct !== undefined ? String(input.priorDilutionPct) : '';
    }
    pricedEl.checked = input.priorRaiseWasPriced;
    if (skipElement !== stepEl) stepEl.value = String(input.stepUpMultiple);
    if (skipElement !== multEl) multEl.value = String(input.nextRoundMultiple);
    if (skipElement !== monthsEl) monthsEl.value = String(input.monthsToNextRound);
    if (skipElement !== burnEl) {
      const mBurn = input.monthlyBurn ?? 0;
      burnEl.value = mBurn > 0 ? toDisp(mBurn) : '';
    }
    if (skipElement !== esopEl) esopEl.value = String(input.esopTopUpPct);
    if (skipElement !== r2DilEl) {
      r2DilEl.value = String(
        input.nextRoundDilutionPct !== undefined ? input.nextRoundDilutionPct : 20
      );
    }
    if (skipElement !== fxEl) {
      fxEl.value = String(Number(fxInrPerUsd.toFixed(4)));
    }
    if (skipElement !== gsTargetEl) gsTargetEl.value = state.goalSeekTarget;
    if (skipElement !== gsGrowthEl) gsGrowthEl.value = String(state.goalSeekGrowth);
  }

  function readNumericInput(el: HTMLInputElement): number {
    const raw = el.value.trim();
    if (raw === '') return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  function handleInputChange(sourceEl: HTMLElement): void {
    if (sourceEl === fxEl) {
      const fx = readNumericInput(fxEl);
      if (Number.isFinite(fx) && fx > 0) {
        fxEl.removeAttribute('aria-invalid');
        state.fxInrPerUsd = fx;
        populateInputsFromState(fxEl);
        updateUI();
      } else {
        fxEl.setAttribute('aria-invalid', 'true');
      }
      return;
    }

    if (sourceEl !== gsTargetEl && sourceEl !== gsGrowthEl) {
      state.activePresetId = null;
    }

    const toCanonical = (dispVal: number): number =>
      Number.isFinite(dispVal) ? toCr(dispVal, state.unit, state.fxInrPerUsd) : NaN;

    if (sourceEl === mrrEl) {
      const mrrCr = toCanonical(readNumericInput(mrrEl));
      state.input.annualRevenue = Number.isFinite(mrrCr) ? mrrCr * 12 : NaN;
      if (Number.isFinite(state.input.annualRevenue)) {
        revEl.value = formatInputValue(
          fromCr(state.input.annualRevenue, state.unit, state.fxInrPerUsd)
        );
      }
    } else if (sourceEl === revEl) {
      const arrCr = toCanonical(readNumericInput(revEl));
      state.input.annualRevenue = arrCr;
      if (Number.isFinite(arrCr)) {
        mrrEl.value = formatInputValue(fromCr(arrCr / 12, state.unit, state.fxInrPerUsd));
      }
    } else if (sourceEl === gsTargetEl) {
      state.goalSeekTarget = gsTargetEl.value as GoalSeekTarget;
    } else if (sourceEl === gsGrowthEl) {
      const g = readNumericInput(gsGrowthEl);
      if (Number.isFinite(g) && g > 0) {
        state.goalSeekGrowth = g;
      }
    } else {
      state.input.ask = toCanonical(readNumericInput(askEl));
      state.input.dilutionPct = readNumericInput(dilEl);
      state.input.priorRaise = toCanonical(readNumericInput(priorEl));
      const rawR0Dil = r0DilEl.value.trim();
      state.input.priorDilutionPct =
        rawR0Dil === '' ? undefined : readNumericInput(r0DilEl);
      state.input.priorRaiseWasPriced = pricedEl.checked;
      state.input.stepUpMultiple = readNumericInput(stepEl);
      state.input.nextRoundMultiple = readNumericInput(multEl);
      state.input.monthsToNextRound = readNumericInput(monthsEl);
      const rawBurn = burnEl.value.trim();
      state.input.monthlyBurn =
        rawBurn === '' ? 0 : toCanonical(readNumericInput(burnEl));
      if (sourceEl === burnEl) {
        state.input.cashNeeded = 0;
      }
      state.input.esopTopUpPct = readNumericInput(esopEl);
      const rawR2Dil = r2DilEl.value.trim();
      state.input.nextRoundDilutionPct =
        rawR2Dil === '' ? undefined : readNumericInput(r2DilEl);
    }

    updateUI();
  }

  [
    askEl,
    dilEl,
    mrrEl,
    revEl,
    priorEl,
    r0DilEl,
    stepEl,
    multEl,
    monthsEl,
    burnEl,
    esopEl,
    r2DilEl,
    fxEl,
    gsGrowthEl,
  ].forEach((el) => {
    el.addEventListener('input', () => handleInputChange(el));
  });
  pricedEl.addEventListener('change', () => handleInputChange(pricedEl));
  gsTargetEl.addEventListener('change', () => handleInputChange(gsTargetEl));

  function renderValidationErrors(output: CheckOutput): void {
    const fieldErrorMap: Partial<
      Record<ValidationField, { input: HTMLInputElement; errEl: HTMLElement }>
    > = {
      ask: { input: askEl, errEl: root.querySelector('#err-ask')! },
      dilutionPct: { input: dilEl, errEl: root.querySelector('#err-dil')! },
      annualRevenue: { input: revEl, errEl: root.querySelector('#err-rev')! },
      priorRaise: { input: priorEl, errEl: root.querySelector('#err-prior')! },
      priorDilutionPct: { input: r0DilEl, errEl: root.querySelector('#err-r0-dil')! },
      stepUpMultiple: { input: stepEl, errEl: root.querySelector('#err-step')! },
      nextRoundMultiple: { input: multEl, errEl: root.querySelector('#err-mult')! },
      monthsToNextRound: { input: monthsEl, errEl: root.querySelector('#err-months')! },
      monthlyBurn: { input: burnEl, errEl: root.querySelector('#err-burn')! },
      cashNeeded: { input: burnEl, errEl: root.querySelector('#err-burn')! },
      esopTopUpPct: { input: esopEl, errEl: root.querySelector('#err-esop')! },
      nextRoundDilutionPct: { input: r2DilEl, errEl: root.querySelector('#err-r2-dil')! },
      esopAndDilution: { input: esopEl, errEl: root.querySelector('#err-esop')! },
    };

    Object.values(fieldErrorMap).forEach((entry) => {
      if (entry) {
        entry.input.removeAttribute('aria-invalid');
        entry.errEl.hidden = true;
        entry.errEl.textContent = '';
      }
    });

    output.validation.errors.forEach((err) => {
      const target = fieldErrorMap[err.field];
      if (target) {
        target.input.setAttribute('aria-invalid', 'true');
        target.errEl.hidden = false;
        target.errEl.textContent = err.message;
      }
    });
  }

  function updateUI(): void {
    syncStateToUrl(state);

    const { unit, fxInrPerUsd } = state;
    const unitMeta = UNIT_METADATA[unit];
    fxWrap.hidden = unit !== 'USD_M';
    root.querySelector('#unit-hint')!.textContent =
      unit === 'USD_M'
        ? `Amounts in USD ($M at ₹${Number(fxInrPerUsd.toFixed(2))}/USD)`
        : `Amounts in ${unitMeta.shortUnit}`;
    root.querySelector('#ask-unit-sub')!.textContent = `${unitMeta.shortUnit} target raise in R1`;
    root.querySelector('#rev-sub')!.textContent = `${unitMeta.shortUnit} (monthly x 12)`;
    root.querySelector('#prior-sub')!.textContent = `${unitMeta.shortUnit} (0 if none)`;
    root.querySelector('#burn-sub')!.textContent =
      `${unitMeta.shortUnit}/mo (0 or blank hides burn check)`;

    // Update unit switcher active button
    unitSwitcher.querySelectorAll<HTMLButtonElement>('button[data-unit]').forEach((btn) => {
      btn.setAttribute('aria-pressed', btn.dataset.unit === unit ? 'true' : 'false');
    });

    // Update sector benchmark picker pressed states
    sectorDrawer.querySelectorAll<HTMLButtonElement>('button.vc-mult-pick').forEach((btn) => {
      const m = Number(btn.dataset.mult);
      btn.setAttribute(
        'aria-pressed',
        Math.abs(m - state.input.nextRoundMultiple) < 0.01 ? 'true' : 'false'
      );
    });

    // Update settings summary chip & waterfall helpers
    const waterfall = computeOwnershipWaterfall(state.input);
    const summaryParts: string[] = [];
    if (state.input.priorRaise > 0) {
      summaryParts.push(`R0 ${formatMoney(state.input.priorRaise, unit, undefined, fxInrPerUsd)}`);
    } else if (state.input.priorDilutionPct !== undefined && state.input.priorDilutionPct > 0) {
      summaryParts.push(`R0 ${formatPercent(state.input.priorDilutionPct, 1)} dil.`);
    }
    if (summaryParts.length > 0) {
      settingsSummaryChip.className = 'chip chip--primary';
      settingsSummaryChip.textContent = summaryParts.join(' · ');
    } else {
      settingsSummaryChip.className = 'chip chip--rolling';
      settingsSummaryChip.textContent = 'Optional';
    }

    const r0DilSubEl = root.querySelector('#r0-dil-sub')!;
    if (waterfall.valid && waterfall.r0DilutionIsAssumed) {
      r0DilSubEl.textContent = 'Assuming 15% from priced R0 (override if different)';
    } else if (state.input.priorDilutionPct !== undefined) {
      r0DilSubEl.textContent = `% equity sold in R0 (${formatPercent(state.input.priorDilutionPct, 1)} set)`;
    } else {
      r0DilSubEl.textContent = '% equity sold in R0 (0% if unset)';
    }

    // Update dynamic monthly helper caption
    const mrrSub = root.querySelector('#mrr-sub')!;
    if (Number.isFinite(state.input.annualRevenue) && state.input.annualRevenue > 0) {
      mrrSub.textContent = `${formatMonthlyMoney(state.input.annualRevenue / 12, unit, fxInrPerUsd)} (synced)`;
    } else {
      mrrSub.textContent = `${unitMeta.shortUnit}/mo (synced with ARR ÷ 12)`;
    }

    // Update preset buttons active state & note
    presetsBox.querySelectorAll('button').forEach((btn) => {
      const isMatch = btn.dataset.id === state.activePresetId;
      btn.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
    });

    const activePreset = PRESET_SCENARIOS.find((p) => p.id === state.activePresetId);
    if (activePreset) {
      presetNoteEl.hidden = false;
      presetNoteEl.textContent = activePreset.description;
    } else {
      presetNoteEl.hidden = true;
    }

    const output = evaluateAsk(state.input, unit, fxInrPerUsd);
    renderValidationErrors(output);

    const { metrics, effectiveVerdictBands } = output;
    const safeMonths = Math.max(
      1,
      Number.isFinite(state.input.monthsToNextRound) ? state.input.monthsToNextRound : 18
    );

    const monthlyBurnCr = state.input.monthlyBurn ?? 0;
    const effectiveBurnNeedCr =
      monthlyBurnCr > 0 ? monthlyBurnCr * safeMonths : state.input.cashNeeded;

    if (monthlyBurnCr > 0 && Number.isFinite(monthlyBurnCr)) {
      burnReadoutEl.innerHTML = `Cash need = <strong>${escapeHtml(formatMoney(monthlyBurnCr * safeMonths, unit, undefined, fxInrPerUsd))}</strong> (${escapeHtml(formatMonthlyMoney(monthlyBurnCr, unit, fxInrPerUsd))} × ${escapeHtml(formatNumber(safeMonths, 0))} months to R2)`;
    } else if (state.input.cashNeeded > 0) {
      burnReadoutEl.innerHTML = `Legacy burn plan cash need = <strong>${escapeHtml(formatMoney(state.input.cashNeeded, unit, undefined, fxInrPerUsd))}</strong>`;
    } else {
      burnReadoutEl.textContent = 'Optional. Leave blank to hide burn check.';
    }

    // Render Pricing check (Results First)
    const gsCagrPct = (Math.pow(state.goalSeekGrowth, 12 / safeMonths) - 1) * 100;
    root.querySelector('#gs-growth-hint')!.textContent =
      `Required CAGR: ${formatPercent(gsCagrPct, 0)}/yr over ${formatNumber(safeMonths, 0)} mo`;

    const vbadge = root.querySelector<HTMLElement>('#vbadge')!;
    const vh = root.querySelector<HTMLElement>('#vh')!;
    const verdictStatsEl = root.querySelector<HTMLElement>('#verdict-stats')!;
    const verdictEsopNoteEl = root.querySelector<HTMLElement>('#verdict-esop-note')!;
    const verdictPreRevCalloutEl = root.querySelector<HTMLElement>('#verdict-prerev-callout')!;
    const vreasons = root.querySelector<HTMLElement>('#vreasons')!;
    const verdictFootEl = root.querySelector<HTMLElement>('#verdict-band-badge')!;

    const badgeSpec = VERDICT_BADGE_MAP[output.verdict.level];
    vbadge.className = badgeSpec.cls;
    vbadge.textContent = badgeSpec.label;

    stickyBadgeEl.className = `${badgeSpec.cls} vc-sticky-strip__badge`;
    stickyBadgeEl.textContent = badgeSpec.label;
    if (
      output.validation.valid &&
      state.input.annualRevenue > 0 &&
      metrics.requiredGrowthMultiple.value !== null
    ) {
      stickySummaryEl.textContent = `· ${formatMultiple(metrics.requiredGrowthMultiple.value, 1)} growth in ${formatNumber(safeMonths, 0)} mo · ${metrics.impliedPostMoney.formattedValue} post`;
    } else if (output.validation.valid) {
      stickySummaryEl.textContent = `· ${metrics.impliedPostMoney.formattedValue} post · Pre-revenue`;
    } else {
      stickySummaryEl.textContent = '· Check input errors above';
    }

    vh.textContent =
      output.validation.valid &&
      state.input.annualRevenue > 0 &&
      metrics.requiredGrowthMultiple.value !== null
        ? LABELS.headline(
            formatMultiple(metrics.requiredGrowthMultiple.value, 1),
            formatNumber(safeMonths, 0)
          )
        : output.verdict.headline;

    if (output.validation.valid) {
      const cagrPct = metrics.impliedCagrPct.value;
      const cmgrPct = metrics.impliedCmgrPct.value;
      const postMultV = metrics.impliedPostRevenueMultiple.value;
      const effPreVal = metrics.effectivePreMoneyAfterEsop.value ?? 0;
      const effPreMult =
        state.input.annualRevenue > 0 ? effPreVal / state.input.annualRevenue : null;
      const esopPoolVal =
        (metrics.impliedPostMoney.value ?? 0) * (Math.max(0, state.input.esopTopUpPct) / 100);
      const r1PostSub =
        postMultV !== null
          ? `${metrics.impliedPreMoney.formattedValue} pre · ${formatMultiple(postMultV, 1)}`
          : `${metrics.impliedPreMoney.formattedValue} pre`;
      const effPreSub =
        state.input.esopTopUpPct > 0
          ? effPreMult !== null
            ? `${formatMultiple(effPreMult, 1)} ARR (after ${formatPercent(state.input.esopTopUpPct, 1)} ESOP)`
            : `After ${formatPercent(state.input.esopTopUpPct, 1)} ESOP`
          : effPreMult !== null
            ? `${formatMultiple(effPreMult, 1)} ARR (no R1 ESOP)`
            : 'No R1 ESOP set';
      const founderStakeValue = waterfall.valid
        ? formatPercent(waterfall.founderPostR1Pct, 1)
        : formatPercent(Math.max(0, 100 - state.input.dilutionPct), 1);
      const founderStakeSub =
        state.input.esopTopUpPct > 0
          ? `Includes ${formatPercent(state.input.esopTopUpPct, 1)} ESOP carve-out`
          : `${formatPercent(state.input.dilutionPct, 1)} R1 investor share`;

      verdictStatsEl.hidden = false;
      verdictStatsEl.innerHTML = `
        <div class="vc-verdict-stat">
          <span class="sl">Required CAGR</span>
          <span class="sv">${escapeHtml(cagrPct !== null ? `${formatPercent(cagrPct, 0)}/yr` : 'Pre-revenue')}</span>
          <span class="ss">${escapeHtml(cmgrPct !== null ? `${formatPercent(cmgrPct, 1)}/mo · R2 ${metrics.requiredNextAnnualRevenue.formattedValue}` : 'milestone-priced stage')}</span>
        </div>
        <div class="vc-verdict-stat">
          <span class="sl">R1 post-money</span>
          <span class="sv">${escapeHtml(metrics.impliedPostMoney.formattedValue)}</span>
          <span class="ss">${escapeHtml(r1PostSub)}</span>
        </div>
        <div class="vc-verdict-stat">
          <span class="sl">Effective pre-money</span>
          <span class="sv">${escapeHtml(metrics.effectivePreMoneyAfterEsop.formattedValue)}</span>
          <span class="ss">${escapeHtml(effPreSub)}</span>
        </div>
        <div class="vc-verdict-stat">
          <span class="sl">Founder stake (Post R1)</span>
          <span class="sv">${escapeHtml(founderStakeValue)}</span>
          <span class="ss">${escapeHtml(founderStakeSub)}</span>
        </div>
      `;

      verdictEsopNoteEl.hidden = false;
      verdictEsopNoteEl.textContent =
        state.input.esopTopUpPct > 0
          ? LABELS.esopNoteActive(
              formatPercent(state.input.esopTopUpPct, 1),
              formatMoney(esopPoolVal, unit, undefined, fxInrPerUsd),
              metrics.impliedPreMoney.formattedValue,
              metrics.effectivePreMoneyAfterEsop.formattedValue,
              formatPercent(state.input.dilutionPct, 1)
            )
          : LABELS.esopNoteDefault;

      if (state.input.annualRevenue <= 0) {
        verdictPreRevCalloutEl.hidden = false;
        verdictPreRevCalloutEl.textContent = LABELS.preRevenueMessage;
      } else {
        verdictPreRevCalloutEl.hidden = true;
        verdictPreRevCalloutEl.textContent = '';
      }
    } else {
      verdictStatsEl.hidden = true;
      verdictStatsEl.innerHTML = '';
      verdictEsopNoteEl.hidden = true;
      verdictEsopNoteEl.textContent = '';
      verdictPreRevCalloutEl.hidden = true;
      verdictPreRevCalloutEl.textContent = '';
    }

    const reasonTag = (id: string): string => {
      if (id === 'multiple_compression') return 'Multiple drop';
      if (id === 'no_compression') return 'Multiple check';
      if (id === 'funding_shortfall') return 'Burn shortfall';
      if (id === 'funding_buffer') return 'Burn cushion';
      if (id === 'funding_exact') return 'Burn plan';
      if (id.startsWith('prior_raise')) return 'R0 raise';
      if (id === 'esop_impact') return 'ESOP pool';
      if (id === 'horizon_outside_benchmark') return 'Runway';
      if (id === 'missing_revenue') return 'Next step';
      if (id === 'valuation_signal') return 'R1 vs. R2';
      return 'Check';
    };

    const reasonsToShow = output.verdict.reasons.filter(
      (r) =>
        !(r.id === 'valuation_signal' && state.input.annualRevenue > 0) &&
        r.id !== 'missing_revenue' &&
        r.id !== 'esop_impact'
    );

    vreasons.innerHTML = reasonsToShow
      .map((r) => {
        const chipClass = r.isAssumption
          ? 'chip chip--primary'
          : r.tone === 'good'
            ? 'chip chip--open'
            : r.tone === 'warn'
              ? 'chip chip--soon'
              : r.tone === 'bad'
                ? 'chip chip--closed'
                : 'chip chip--rolling';
        return `
          <li class="vc-reason-item" data-tone="${escapeHtml(r.tone)}">
            <span class="${chipClass} vc-reason-tag">${escapeHtml(reasonTag(r.id))}</span>
            <span class="vc-reason-text">${escapeHtml(r.text)}</span>
          </li>
        `;
      })
      .join('');

    verdictFootEl.textContent = LABELS.pricingThresholdsLine(
      `${formatPercent(effectiveVerdictBands.reachableCagrPct, 0)}/yr`,
      `${formatPercent(effectiveVerdictBands.stretchCagrPct, 0)}/yr`
    );

    // Render Visual Charts
    const valChartEl = root.querySelector<HTMLElement>('#valuation-chart')!;
    const valTraceWrap = root.querySelector<HTMLElement>('#valuation-trace-wrap')!;
    valChartEl.innerHTML = renderValuationLadderSvg(output, fxInrPerUsd);

    const chainRows: Array<{ label: string; value: string; calc: string }> = [
      {
        label: 'R1 pre-money',
        value: metrics.impliedPreMoney.formattedValue,
        calc: metrics.impliedPreMoney.calculation,
      },
    ];
    if (state.input.esopTopUpPct > 0) {
      chainRows.push({
        label: `Effective R1 pre-money (${formatPercent(state.input.esopTopUpPct, 1)} ESOP)`,
        value: metrics.effectivePreMoneyAfterEsop.formattedValue,
        calc: metrics.effectivePreMoneyAfterEsop.calculation,
      });
    }
    chainRows.push(
      {
        label: 'R1 ask (raise)',
        value: formatMoney(state.input.ask, unit, undefined, fxInrPerUsd),
        calc: `${formatPercent(state.input.dilutionPct, 1)} R1 dilution`,
      },
      {
        label: 'R1 post-money',
        value: metrics.impliedPostMoney.formattedValue,
        calc: metrics.impliedPostMoney.calculation,
      },
      {
        label: 'R2 pre-money',
        value: metrics.nextRoundPreMoney.formattedValue,
        calc: metrics.nextRoundPreMoney.calculation,
      }
    );
    if (state.input.priorRaise > 0) {
      chainRows.push({
        label: 'R1 ask vs. R0 raise',
        value: metrics.askToPriorRaiseMultiple.formattedValue,
        calc: metrics.askToPriorRaiseMultiple.calculation,
      });
    }

    const valTraceOpen = openTraces.has('chart_valuation_trace') ? ' open' : '';
    valTraceWrap.innerHTML = `
      <details class="trace" data-trace-id="chart_valuation_trace"${valTraceOpen}>
        <summary>How this is calculated</summary>
        <div class="trace-body">
          <ul class="vc-chain">
            ${chainRows
              .map(
                (r) => `
                  <li>
                    <div class="vc-chain-row">
                      <span class="vc-chain-label">${escapeHtml(r.label)}</span>
                      <span class="vc-chain-value">${escapeHtml(r.value)}</span>
                    </div>
                    <div class="trace-calc">${escapeHtml(r.calc)}</div>
                  </li>
                `
              )
              .join('')}
          </ul>
        </div>
      </details>
    `;

    const revChartEl = root.querySelector<HTMLElement>('#revenue-chart')!;
    const burnBarEl = root.querySelector<HTMLElement>('#burn-bar')!;
    const revTraceWrap = root.querySelector<HTMLElement>('#revenue-trace-wrap')!;
    revChartEl.innerHTML = renderRevenueBridgeSvg(output, fxInrPerUsd);

    const burnMarkup = renderBurnComparisonBar(output, fxInrPerUsd);
    if (burnMarkup) {
      burnBarEl.hidden = false;
      burnBarEl.innerHTML = burnMarkup;
    } else {
      burnBarEl.hidden = true;
      burnBarEl.innerHTML = '';
    }

    revTraceWrap.innerHTML = renderTraceDetails(
      'chart_revenue_trace',
      `${metrics.requiredNextAnnualRevenue.formula} · ${metrics.requiredGrowthMultiple.formula}`,
      `${metrics.requiredNextAnnualRevenue.calculation} | Growth: ${metrics.requiredGrowthMultiple.calculation} (${formatNumber(state.input.monthsToNextRound, 0)} mo)`,
      true,
      LABELS.ruleOfThumbTag,
      openTraces
    );

    // Render Signal Cards (Required CAGR, Valuation Multiple Shift, and optional Burn/R0)
    const signalsEl = root.querySelector<HTMLElement>('#signals-strip')!;

    // Card 1: Required CAGR (Visualized)
    const cagrVal = metrics.impliedCagrPct.value;
    const cmgrVal = metrics.impliedCmgrPct.value;
    let cagrHero = 'Pre-revenue';
    let cagrSub = 'DeepTech Round Planner (coming soon)';
    if (cagrVal !== null && cmgrVal !== null) {
      cagrHero = `${formatPercent(cagrVal, 0)}/yr`;
      cagrSub = `${formatPercent(cmgrVal, 1)}/mo compounded for ${formatNumber(safeMonths, 0)} mo`;
    }

    // Card 2: Valuation Multiple Shift (Visualized)
    const preMult = metrics.impliedPreRevenueMultiple.value;
    const postMult = metrics.impliedPostRevenueMultiple.value;
    let multHero = 'Pre-revenue';
    let multSub = `vs. ${formatMultiple(state.input.nextRoundMultiple, 1)} R2 multiple`;
    if (preMult !== null && postMult !== null) {
      multHero = `${formatMultiple(preMult, 1)} pre · ${formatMultiple(postMult, 1)} post`;
      if (postMult > state.input.nextRoundMultiple) {
        const compRatio = postMult / state.input.nextRoundMultiple;
        multSub = `vs. ${formatMultiple(state.input.nextRoundMultiple, 1)} R2 multiple (${formatMultiple(compRatio, 1)} drop)`;
      } else {
        multSub = `vs. ${formatMultiple(state.input.nextRoundMultiple, 1)} R2 multiple (no drop)`;
      }
    }

    // Card 3: Burn Plan & R0 Check (hidden when both monthly burn and R0 raise are empty/0)
    const priorMult = metrics.askToPriorRaiseMultiple.value;
    const priorExtra =
      state.input.priorRaise > 0 && priorMult !== null
        ? `R0 raise: ${formatMultiple(priorMult, 1)} (${state.input.priorRaiseWasPriced ? '3x to 4x priced band' : 'unpriced'})`
        : null;
    const showBurnOrR0Card = effectiveBurnNeedCr > 0 || state.input.priorRaise > 0;
    signalsEl.classList.toggle('vc-signals--two', !showBurnOrR0Card);

    const signalCardsHtml = [
      renderSignalCard(
        'impliedCagrPct',
        'Required CAGR',
        cagrHero,
        cagrSub,
        null,
        null,
        renderTraceDetails(
          'tile_impliedCagrPct',
          metrics.impliedCagrPct.formula,
          metrics.impliedCagrPct.calculation,
          true,
          metrics.impliedCagrPct.assumptionOrigin,
          openTraces
        ),
        renderCagrGaugeSvg(output)
      ),
      renderSignalCard(
        'impliedPostRevenueMultiple',
        'Valuation multiple shift',
        multHero,
        multSub,
        null,
        null,
        renderTraceDetails(
          'tile_impliedPostRevenueMultiple',
          metrics.impliedPostRevenueMultiple.formula,
          metrics.impliedPostRevenueMultiple.calculation,
          false,
          metrics.impliedPostRevenueMultiple.assumptionOrigin,
          openTraces
        ),
        renderMultipleShiftSvg(output)
      ),
    ];
    if (showBurnOrR0Card) {
      signalCardsHtml.push(
        renderSignalCard(
          'fundingGap',
          effectiveBurnNeedCr > 0 ? 'Burn plan & R0 check' : 'R0 raise check',
          effectiveBurnNeedCr > 0
            ? metrics.fundingGap.formattedValue
            : metrics.askToPriorRaiseMultiple.formattedValue,
          effectiveBurnNeedCr > 0
            ? metrics.fundingGap.subtitle
            : metrics.askToPriorRaiseMultiple.subtitle,
          effectiveBurnNeedCr > 0 ? priorExtra : null,
          null,
          renderTraceDetails(
            'tile_fundingGap',
            effectiveBurnNeedCr > 0
              ? metrics.fundingGap.formula
              : metrics.askToPriorRaiseMultiple.formula,
            effectiveBurnNeedCr > 0
              ? metrics.fundingGap.calculation
              : metrics.askToPriorRaiseMultiple.calculation,
            false,
            metrics.fundingGap.assumptionOrigin,
            openTraces
          )
        )
      );
    }
    signalsEl.innerHTML = signalCardsHtml.join('');

    // Render Feasible Ask Bar & Goal-Seek Section
    const feasibleBarEl = root.querySelector<HTMLElement>('#feasible-bar')!;
    feasibleBarEl.innerHTML = renderFeasibleAskBarSvg(output, fxInrPerUsd);

    const bandPillsEl = root.querySelector<HTMLElement>('#band-pills')!;
    const gsOutputEl = root.querySelector<HTMLElement>('#gs-output')!;
    const seek = solveGoalSeek(
      state.input,
      state.goalSeekTarget,
      state.goalSeekGrowth,
      unit,
      fxInrPerUsd
    );

    const pills: string[] = [];
    if (output.validation.valid && state.input.annualRevenue > 0) {
      pills.push(`
        <div class="vc-band-pill" data-band="reachable">
          <div class="vc-band-pill__head">
            <span class="bl">Max ask for ${escapeHtml(LABELS.bands.reachable)} pricing (≤${escapeHtml(formatMultiple(effectiveVerdictBands.reachableMax, 1))} · ${escapeHtml(formatPercent(effectiveVerdictBands.reachableCagrPct, 0))}/yr)</span>
            <span class="chip chip--open">${escapeHtml(LABELS.bands.reachable)}</span>
          </div>
          <span class="bv">${escapeHtml(formatMoney(output.feasibleAskBand.reachableAsk, unit, undefined, fxInrPerUsd))}</span>
        </div>
      `);
      pills.push(`
        <div class="vc-band-pill" data-band="stretch">
          <div class="vc-band-pill__head">
            <span class="bl">Max ask for ${escapeHtml(LABELS.bands.stretch)} pricing (≤${escapeHtml(formatMultiple(effectiveVerdictBands.stretchMax, 1))} · ${escapeHtml(formatPercent(effectiveVerdictBands.stretchCagrPct, 0))}/yr)</span>
            <span class="chip chip--soon">${escapeHtml(LABELS.bands.stretch)}</span>
          </div>
          <span class="bv">${escapeHtml(formatMoney(output.feasibleAskBand.stretchAsk, unit, undefined, fxInrPerUsd))}</span>
        </div>
      `);
    }
    if (output.feasibleAskBand.priorRaiseBand) {
      pills.push(`
        <div class="vc-band-pill" data-band="prior">
          <div class="vc-band-pill__head">
            <span class="bl">Priced R0 band</span>
            <span class="chip chip--primary">3x to 4x</span>
          </div>
          <span class="bv">${escapeHtml(formatMoney(output.feasibleAskBand.priorRaiseBand[0], unit, undefined, fxInrPerUsd))} to ${escapeHtml(formatMoney(output.feasibleAskBand.priorRaiseBand[1], unit, undefined, fxInrPerUsd))}</span>
        </div>
      `);
    }
    bandPillsEl.innerHTML = pills.join('');
    bandPillsEl.hidden = pills.length === 0;

    const canApplyGoalSeek = seek.isFeasible && seek.solvedValue !== null;
    gsOutputEl.innerHTML = `
      <div class="vc-solver-result-row">
        <div class="vc-solver-hero">
          <span class="sv">${escapeHtml(seek.formattedSolvedValue)}</span>
          ${
            seek.secondaryFormattedValue
              ? `<span class="ss">(${escapeHtml(seek.secondaryFormattedValue)})</span>`
              : ''
          }
        </div>
        ${
          canApplyGoalSeek
            ? `<button type="button" id="apply-goalseek-btn" class="btn btn--primary btn--sm">Apply to inputs</button>`
            : ''
        }
      </div>
      <p class="vc-solver-summary">${escapeHtml(seek.summary)}</p>
      ${
        seek.formula
          ? renderTraceDetails(
              'goalseek_trace',
              seek.formula,
              seek.calculation,
              true,
              `Backwards goal-seek at ≤${formatMultiple(seek.targetGrowthMultiple, 1)} target growth`,
              openTraces
            )
          : ''
      }
    `;

    const applyBtn = gsOutputEl.querySelector<HTMLButtonElement>('#apply-goalseek-btn');
    if (applyBtn && seek.solvedValue !== null) {
      applyBtn.addEventListener('click', () => {
        state.activePresetId = null;
        const val = Number(seek.solvedValue!.toFixed(4));
        if (state.goalSeekTarget === 'max_ask') {
          state.input.ask = val;
        } else if (state.goalSeekTarget === 'required_revenue') {
          state.input.annualRevenue = val;
        } else if (state.goalSeekTarget === 'required_dilution') {
          state.input.dilutionPct = Number(seek.solvedValue!.toFixed(1));
        }
        populateInputsFromState();
        updateUI();
      });
    }

    // Render Detail Sensitivity Table (inside collapsible drawer) & Ask vs. Dilution Grid
    const sensDrawer = root.querySelector<HTMLDetailsElement>('#sens-detail-drawer')!;
    const sensTable = root.querySelector<HTMLElement>('#sens')!;

    if (output.sensitivity.length === 0) {
      sensDrawer.hidden = true;
      sensTable.innerHTML = '';
    } else {
      sensDrawer.hidden = false;
      const headerHtml = `
        <thead>
          <tr>
            <th>Dilution</th>
            <th>Post</th>
            <th>Pre</th>
            <th>Pre / Post</th>
            <th>R2 pre</th>
            <th>Growth</th>
          </tr>
        </thead>
      `;
      const rowsHtml = output.sensitivity
        .map((row) => {
          const rowClass = row.isUserSelected ? ' class="active-row"' : '';
          const dilLabel = row.isUserSelected
            ? `${formatPercent(row.dilutionPct, 1)} (yours)`
            : formatPercent(row.dilutionPct, 1);
          const multCell =
            row.impliedPreMultiple !== null && row.impliedPostMultiple !== null
              ? `${formatMultiple(row.impliedPreMultiple, 1)} / ${formatMultiple(row.impliedPostMultiple, 1)}`
              : '-';
          const growthCell =
            row.requiredGrowthMultiple !== null
              ? formatMultiple(row.requiredGrowthMultiple, 1)
              : '-';

          return `
            <tr${rowClass}>
              <td title="${escapeHtml(row.note)}">${escapeHtml(dilLabel)}</td>
              <td>${escapeHtml(formatMoney(row.postMoney, unit, undefined, fxInrPerUsd))}</td>
              <td>${escapeHtml(formatMoney(row.preMoney, unit, undefined, fxInrPerUsd))}</td>
              <td>${escapeHtml(multCell)}</td>
              <td>${escapeHtml(formatMoney(row.nextPreMoney, unit, undefined, fxInrPerUsd))}</td>
              <td>${escapeHtml(growthCell)}</td>
            </tr>
          `;
        })
        .join('');

      sensTable.innerHTML = `${headerHtml}<tbody>${rowsHtml}</tbody>`;
    }

    const heatmapTraceWrap = root.querySelector<HTMLElement>('#heatmap-trace-wrap')!;
    const heatmap = computeAskDilutionHeatmap(state.input);
    if (!heatmap.available) {
      heatmapWrap.innerHTML =
        '<p class="vc-hm-empty">Pre-revenue: enter positive ARR above to render the Ask vs. Dilution sensitivity grid (milestone-priced DeepTech tool coming soon).</p>';
      heatmapTraceWrap.innerHTML = '';
    } else {
      const hmColGroup = `<colgroup><col class="vc-hm-col-ask" />${heatmap.dilutions.map(() => '<col class="vc-hm-col-dil" />').join('')}</colgroup>`;
      const hmColsHtml = heatmap.dilutions
        .map((d) => {
          const isCurCol = Math.abs(d - heatmap.currentDilutionPct) < 0.05;
          return `<th scope="col" class="vc-hm-col-head${isCurCol ? ' is-current-col' : ''}"><span>${escapeHtml(formatPercent(d, 1))}</span>${isCurCol ? '<span class="vc-hm-yours"> (yours)</span>' : ''}</th>`;
        })
        .join('');

      const hmRowsHtml = heatmap.rows
        .map((row) => {
          const askLabel = formatMoney(row.ask, unit, undefined, fxInrPerUsd);
          const rowHead = `<th scope="row" class="vc-hm-row-head${row.isCurrentAsk ? ' is-current-row' : ''}"><span>${escapeHtml(askLabel)}</span>${row.isCurrentAsk ? '<span class="vc-hm-now">Current</span>' : ''}</th>`;
          const cellsHtml = row.cells
            .map((cell) => {
              const clsParts = ['vc-hm-cell', `vc-hm-cell--${cell.level}`];
              if (cell.isCurrent) clsParts.push('vc-hm-cell--current');
              const cagrPctOnly = formatPercent(cell.impliedCagrPct, 0);
              const growthOnly = formatMultiple(cell.requiredGrowthMultiple, 1);
              const postMoneyText = formatMoney(cell.postMoney, unit, undefined, fxInrPerUsd);
              const ariaLabel = `Set R1 ask to ${formatMoney(cell.ask, unit, undefined, fxInrPerUsd)} at ${formatPercent(cell.dilutionPct, 1)} dilution: ${cagrPctOnly}/yr CAGR, ${LABELS.bands[cell.level]}`;
              return `
                <td>
                  <button
                    type="button"
                    class="${clsParts.join(' ')}"
                    data-ask="${cell.ask}"
                    data-dil="${cell.dilutionPct}"
                    aria-current="${cell.isCurrent ? 'true' : 'false'}"
                    aria-label="${escapeXml(ariaLabel)}"
                  >
                    <span class="vc-hm-cagr">${escapeXml(cagrPctOnly)}<span class="vc-hm-unit">/yr</span></span>
                    <span class="vc-hm-meta"><span>${escapeXml(growthOnly)}</span><span class="vc-hm-post"> · ${escapeXml(postMoneyText)}</span></span>
                  </button>
                </td>
              `;
            })
            .join('');
          return `<tr>${rowHead}${cellsHtml}</tr>`;
        })
        .join('');

      heatmapWrap.innerHTML = `
        <table class="vc-heatmap-table" aria-label="Ask vs. dilution sensitivity grid">
          ${hmColGroup}
          <thead>
            <tr>
              <th scope="col" class="vc-hm-corner">Ask \\ Dil.</th>
              ${hmColsHtml}
            </tr>
          </thead>
          <tbody>
            ${hmRowsHtml}
          </tbody>
        </table>
      `;

      heatmapTraceWrap.innerHTML = renderTraceDetails(
        'heatmap_trace',
        'Required R2 ARR = ((Ask ÷ Dilution) × R2 Step-Up) ÷ R2 Multiple · CAGR = ((Required R2 ARR ÷ Current ARR) ^ (12 ÷ Months)) − 1',
        `Evaluated ${heatmap.rows.length} ask levels against ${heatmap.dilutions.map((d) => formatPercent(d, 1)).join(', ')} dilution over ${formatNumber(safeMonths, 0)} months.`,
        false,
        LABELS.pricingThresholdsLine(
          `${formatPercent(effectiveVerdictBands.reachableCagrPct, 0)}/yr`,
          `${formatPercent(effectiveVerdictBands.stretchCagrPct, 0)}/yr`
        ),
        openTraces
      );
    }

    // Render Founder Ownership Waterfall inside R0 & waterfall drawer
    const wfEl = root.querySelector<HTMLElement>('#ownership-waterfall')!;
    const wfSummaryEl = root.querySelector<HTMLElement>('#ownership-summary')!;
    const capTableEl = root.querySelector<HTMLElement>('#ownership-captable')!;
    const wfTraceWrap = root.querySelector<HTMLElement>('#ownership-trace-wrap')!;

    wfEl.innerHTML = renderOwnershipWaterfallSvg(output);
    if (!waterfall.valid) {
      wfSummaryEl.className = 'chip chip--closed';
      wfSummaryEl.textContent = 'Check dilution inputs';
      capTableEl.innerHTML = '';
      wfTraceWrap.innerHTML = '';
    } else {
      wfSummaryEl.className =
        waterfall.founderPostR2Pct >= 50 ? 'chip chip--open' : 'chip chip--soon';
      wfSummaryEl.textContent = `${formatPercent(waterfall.founderPreR1Pct, 1)} pre-R1 → ${formatPercent(waterfall.founderPostR1Pct, 1)} R1 → ${formatPercent(waterfall.founderPostR2Pct, 1)} R2`;

      const capPills: string[] = [
        `<div class="vc-captable-pill"><span class="cl">Founders (Post R1)</span><span class="cv">${escapeHtml(formatPercent(waterfall.founderPostR1Pct, 1))}</span></div>`,
      ];
      if (waterfall.r0DilutionPct > 0) {
        capPills.push(
          `<div class="vc-captable-pill"><span class="cl">R0 investors${waterfall.r0DilutionIsAssumed ? ' (est.)' : ''}</span><span class="cv">${escapeHtml(formatPercent(waterfall.r0InvestorPostR1Pct, 1))}</span></div>`
        );
      }
      if (waterfall.esopTopUpPct > 0) {
        capPills.push(
          `<div class="vc-captable-pill"><span class="cl">R1 ESOP pool</span><span class="cv">${escapeHtml(formatPercent(waterfall.esopTopUpPct, 1))}</span></div>`
        );
      }
      capPills.push(
        `<div class="vc-captable-pill"><span class="cl">R1 investors</span><span class="cv">${escapeHtml(formatPercent(waterfall.r1DilutionPct, 1))}</span></div>`
      );
      capTableEl.innerHTML = capPills.join('');

      wfTraceWrap.innerHTML = renderTraceDetails(
        'ownership_waterfall_trace',
        'Founder Post-R1 = (100% − R0 %) × (1 − (ESOP % + R1 %) ÷ 100) · Founder Post-R2 = Founder Post-R1 × (1 − R2 % ÷ 100)',
        `Pre-R1 ${formatPercent(waterfall.founderPreR1Pct, 1)} -> after ${formatPercent(waterfall.esopTopUpPct, 1)} ESOP and ${formatPercent(waterfall.r1DilutionPct, 1)} R1 = ${formatPercent(waterfall.founderPostR1Pct, 1)} -> after ${formatPercent(waterfall.r2DilutionPct, 1)} illustrative R2 = ${formatPercent(waterfall.founderPostR2Pct, 1)}`,
        waterfall.r0DilutionIsAssumed || state.input.nextRoundDilutionPct === undefined,
        LABELS.ruleOfThumbTag,
        openTraces
      );
    }
    syncStickyStrip();
  }

  populateInputsFromState();
  updateUI();
}
