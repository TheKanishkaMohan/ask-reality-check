import {
  ASSUMPTION_REFERENCES,
  PRESET_SCENARIOS,
  SECTOR_MULTIPLE_BENCHMARKS,
  UNIT_METADATA,
  convertUnitScale,
  evaluateAsk,
  formatMoney,
  formatMonthlyMoney,
  formatMultiple,
  formatNumber,
  formatPercent,
  solveGoalSeek,
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
  isAssumption: boolean,
  origin: string,
  openTraces: Set<string>
): string {
  const isOpen = openTraces.has(traceId) ? ' open' : '';
  const chipClass = isAssumption ? 'chip chip--primary' : 'chip chip--rolling';
  const chipLabel = isAssumption ? 'Tool assumption' : 'VC benchmark';
  const showDetailOrigin = origin.trim().toLowerCase() !== chipLabel.toLowerCase();
  return `
    <details class="trace" data-trace-id="${escapeHtml(traceId)}"${isOpen}>
      <summary>How this is calculated</summary>
      <div class="trace-body">
        <div class="trace-formula">${escapeHtml(formula)}</div>
        <div class="trace-calc">${escapeHtml(calculation)}</div>
        <div class="trace-origin">
          <span class="${chipClass}">${escapeHtml(chipLabel)}</span>
          ${showDetailOrigin ? `<span>${escapeHtml(origin)}</span>` : ''}
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

function renderBurnComparisonBar(output: CheckOutput): string {
  const { input, unit } = output;
  if (!output.validation.valid || input.cashNeeded <= 0) return '';

  const ask = Math.max(0, input.ask);
  const cash = Math.max(0, input.cashNeeded);
  const diff = cash - ask;
  const maxVal = Math.max(ask, cash, 1);
  const askW = Math.max(8, Math.round((ask / maxVal) * 420));
  const cashW = Math.max(8, Math.round((cash / maxVal) * 420));

  let chipCls = 'chip chip--rolling';
  let statusText = `Exact match: Ask equals ${formatMoney(cash, unit)} burn plan`;
  let askFill = '#007aff';

  if (diff > 0) {
    chipCls = 'chip chip--closed';
    statusText = `Shortfall: ${formatMoney(diff, unit)} below ${formatMoney(cash, unit)} burn plan`;
    askFill = '#ff3b30';
  } else if (diff < 0) {
    chipCls = 'chip chip--open';
    statusText = `Buffer: ${formatMoney(Math.abs(diff), unit)} above ${formatMoney(cash, unit)} burn plan`;
    askFill = '#1b7a35';
  }

  return `
    <div class="vc-burn-bar__head">
      <span><strong>Burn plan check</strong> (${formatMoney(ask, unit)} ask vs. ${formatMoney(cash, unit)} needed)</span>
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
  reachable: { cls: 'chip chip--open', label: 'Reachable' },
  stretch: { cls: 'chip chip--soon', label: 'Stretch' },
  stiff: { cls: 'chip chip--closed', label: 'Stiff' },
  invalid: { cls: 'chip chip--closed', label: 'Check inputs' },
  incomplete: { cls: 'chip chip--rolling', label: 'Add revenue' },
};

export function mountCheckerApp(root: HTMLElement, initialState: AppState): void {
  const state: AppState = {
    unit: initialState.unit,
    activePresetId: initialState.activePresetId,
    input: {
      ...initialState.input,
      verdictBands: { ...initialState.input.verdictBands },
    },
    goalSeekTarget: initialState.goalSeekTarget,
    goalSeekGrowth: initialState.goalSeekGrowth,
  };

  const openTraces = new Set<string>();

  const rulesHtml = ASSUMPTION_REFERENCES.map((item) => {
    const isAssumption = item.origin === 'Tool Assumption';
    const chipClass = isAssumption ? 'chip chip--primary' : 'chip chip--rolling';
    return `
      <li class="vc-rule-item">
        <div class="vc-rule-item__head">
          <span class="vc-rule-item__title">${escapeHtml(item.parameter)}</span>
          <span class="vc-rule-item__chips">
            <span class="chip chip--rolling">${escapeHtml(item.defaultValue)}</span>
            <span class="${chipClass}">${escapeHtml(item.origin)}</span>
          </span>
        </div>
        <p class="vc-rule-item__body">${escapeHtml(item.explanation)}</p>
      </li>
    `;
  }).join('');

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
        </div>
      </section>

      <section class="section band section--tight" aria-label="Valuation calculator">
        <div class="wrap">
          <h2 class="tkm-sr">Valuation Check calculator</h2>

          <div class="tkm-toolbar">
            <div class="tkm-segmented" id="unit-switcher" role="group" aria-label="Currency and unit selection">
              <button type="button" class="tkm-seg-btn" data-unit="INR_CR" aria-pressed="true">₹ Cr</button>
              <button type="button" class="tkm-seg-btn" data-unit="INR_LAKH" aria-pressed="false">₹ Lakh</button>
              <button type="button" class="tkm-seg-btn" data-unit="USD_M" aria-pressed="false">USD ($M)</button>
            </div>
            <div class="vc-toolbar-actions">
              <button type="button" id="download-xlsx-btn" class="btn btn--primary btn--sm" aria-label="Download scenario workbook as XLSX">
                Download XLSX
              </button>
            </div>
          </div>

          <div class="vc-config-stack">
            <details id="examples-panel" class="tkm-filters-panel">
              <summary>
                <span class="tkm-filters-panel__title">
                  <span class="tkm-filters-panel__badge">Examples</span>
                  Sample scenarios
                </span>
                <span class="tkm-filters-panel__right">
                  <span id="active-preset-chip" class="chip chip--rolling">Optional</span>
                  <span class="tkm-filters-panel__toggle" aria-hidden="true"></span>
                </span>
              </summary>
              <div class="tkm-filters-panel__body">
                <div class="tkm-filter-pills" id="presets" role="group" aria-label="Examples"></div>
                <p id="pnote" class="vc-preset-note" hidden></p>
              </div>
            </details>

            <details class="tkm-accordion" id="settings-drawer">
              <summary>
                <span class="tkm-accordion__title">Last round (R0) &amp; ESOP</span>
                <span class="tkm-accordion__right">
                  <span class="chip chip--rolling" id="settings-summary-chip">Optional</span>
                  <span class="tkm-accordion__plus" aria-hidden="true"></span>
                </span>
              </summary>
              <div class="tkm-accordion__body tkm-accordion__body--pad">
                <p class="vc-r0-note">
                  Optional starting point before R1. R0 checks if your raise jump is realistic; ESOP lowers founders' effective R1 pre-money while R2 targets stay unchanged.
                </p>
                <div class="vc-grid-2">
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
                      <label for="esop">R1 ESOP top-up</label>
                      ${renderInfoTip(
                        'tip-esop',
                        'R1 ESOP top-up',
                        'New option pool added at R1 as a % of post-money. This reduces existing shareholders effective R1 pre-money, not your R2 target.',
                        true
                      )}
                    </div>
                    <input id="esop" class="tkm-input" type="number" step="any" min="0" max="50" inputmode="decimal" />
                    <small>% of post-money; lowers effective R1 pre-money</small>
                    <div class="vc-field-error" id="err-esop" hidden></div>
                  </div>
                </div>

                <div class="vc-switch-row" id="priced-switch-row">
                  <input id="priced" type="checkbox" checked />
                  <div>
                    <label for="priced">R0 was a priced equity round</label>
                    <small>Checks the 3x to 4x raise jump rule. Uncheck for grants, notes, or founder cash.</small>
                  </div>
                </div>
              </div>
            </details>

            <section class="vc-card vc-config-card" aria-label="Inputs">
              <div class="vc-card__head">
                <p class="vc-eyebrow">Configuration: R1 &amp; R2</p>
                <small class="vc-hint">R0 Last · R1 Now · R2 Next · <span id="unit-hint">Amounts in ₹ Cr</span></small>
              </div>

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
                    <label for="cash">R1 cash needed (burn plan)</label>
                    ${renderInfoTip(
                      'tip-cash',
                      'R1 cash needed',
                      'Cash your burn plan says you need to hit R2 milestones. Kept separate from R1 ask to reveal shortfalls or safety buffers.',
                      true
                    )}
                  </div>
                  <input id="cash" class="tkm-input" type="number" step="any" min="0" inputmode="decimal" />
                  <small id="cash-sub">₹ Cr needed for R2 (0 if unset)</small>
                  <div class="vc-field-error" id="err-cash" hidden></div>
                </div>
                <div class="vc-field">
                  <div class="vc-field__head">
                    <label for="ask">R1 ask (raise)</label>
                    ${renderInfoTip(
                      'tip-ask',
                      'R1 ask',
                      'Capital you plan to raise in this round (R1). Together with R1 dilution, this directly sets your R1 valuation.',
                      true
                    )}
                  </div>
                  <input id="ask" class="tkm-input" type="number" step="any" min="0" inputmode="decimal" />
                  <small id="ask-unit-sub">₹ Cr target raise in R1</small>
                  <div class="vc-field-error" id="err-ask" hidden></div>
                </div>
              </div>

              <div class="vc-grid-4">
                <div class="vc-field">
                  <div class="vc-field__head">
                    <label for="dil">R1 dilution</label>
                    ${renderInfoTip(
                      'tip-dil',
                      'R1 dilution',
                      'Equity % sold to new investors in R1 (usually 20% to 25%). Lower dilution raises your implied valuation.'
                    )}
                  </div>
                  <input id="dil" class="tkm-input" type="number" step="any" min="0.1" max="99.9" inputmode="decimal" />
                  <small>% equity sold in R1 (20% to 25% std)</small>
                  <div class="vc-field-error" id="err-dil" hidden></div>
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
                    <label for="step">R2 valuation step-up</label>
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
                    <label for="mult">R2 revenue multiple</label>
                    <span class="vc-field__head-right">
                      <span class="chip chip--primary">Assumption</span>
                      ${renderInfoTip(
                        'tip-mult',
                        'R2 revenue multiple',
                        'Expected valuation-to-ARR multiple in R2. Revenue multiples fit software and high-margin brands best. For hardware or asset-heavy models, use sector comparables.',
                        true
                      )}
                    </span>
                  </div>
                  <input id="mult" class="tkm-input" type="number" step="any" min="0.1" inputmode="decimal" />
                  <small>x ARR at next round (R2)</small>
                  <div class="vc-field-error" id="err-mult" hidden></div>
                </div>
              </div>
            </section>

            <details class="tkm-accordion" id="sector-benchmarks-drawer">
              <summary>
                <span class="tkm-accordion__title">Indicative sector revenue multiples (R2)</span>
                <span class="tkm-accordion__right">
                  <span class="chip chip--primary">P25 / Median / P75</span>
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

            <details class="tkm-accordion" id="assumptions-drawer">
              <summary>
                <span class="tkm-accordion__title">How VCs do this math: 5 rules of thumb</span>
                <span class="tkm-accordion__right">
                  <span class="chip chip--rolling">5 rules</span>
                  <span class="tkm-accordion__plus" aria-hidden="true"></span>
                </span>
              </summary>
              <div class="tkm-accordion__body tkm-accordion__body--pad">
                <ul class="vc-rules-list" aria-label="VC rules of thumb">
                  ${rulesHtml}
                </ul>
              </div>
            </details>
          </div>

          <section class="vc-results-stack" aria-label="Results" aria-live="polite" id="results-panel">
            <div class="vc-card vc-verdict-card" id="verdict-box">
              <div class="vc-verdict-top">
                <span class="chip chip--open" id="vbadge">Reachable</span>
                <h3 class="vc-verdict-title" id="vh"></h3>
                <div class="vc-verdict-badges">
                  <span class="chip chip--rolling" id="vc-pace-chip" hidden></span>
                  <span class="chip chip--primary" id="verdict-band-badge">Reachable ≤108%/yr · Stretch ≤192%/yr</span>
                </div>
              </div>
              <ul class="vc-reasons" id="vreasons"></ul>
            </div>

            <div class="vc-charts-grid">
              <div class="vc-card">
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
              <div class="vc-card" aria-label="Goal-seek calculator">
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
                      <option value="max_ask">Max R1 ask for growth ceiling</option>
                      <option value="required_revenue">Current ARR for this R1 ask</option>
                      <option value="required_dilution">R1 dilution for this ask &amp; ARR</option>
                    </select>
                  </div>
                  <div class="vc-field">
                    <div class="vc-field__head">
                      <label for="gs-growth">Target max growth (x)</label>
                      <span class="vc-field__head-right">
                        <span class="chip chip--primary">Assumption</span>
                        ${renderInfoTip(
                          'tip-gs-growth',
                          'Target max growth',
                          'Maximum R1-to-R2 revenue growth multiple you think is realistic. Goal-Seek solves the largest R1 ask that stays within this ceiling.',
                          true
                        )}
                      </span>
                    </div>
                    <input id="gs-growth" class="tkm-input" type="number" step="0.1" min="0.5" max="50" inputmode="decimal" />
                    <small id="gs-growth-hint">Required CAGR: 108%/yr over 18 mo</small>
                  </div>
                </div>

                <div class="vc-solver-output" id="gs-output"></div>
              </div>

              <div class="vc-card">
                <div class="vc-card__head">
                  <p class="vc-eyebrow">If the dilution were different</p>
                </div>
                <div class="vc-scroll">
                  <table class="vc-table vc-table--num" id="sens" aria-label="Dilution sensitivity table"></table>
                </div>
                <div id="sens-trace-wrap"></div>
                <p class="vc-footnote">
                  Lower dilution raises your R1 valuation and makes R2 harder to clear. Early rounds usually land around 20% to 25%.
                </p>
              </div>
            </div>
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
  const pricedEl = root.querySelector<HTMLInputElement>('#priced')!;
  const stepEl = root.querySelector<HTMLInputElement>('#step')!;
  const multEl = root.querySelector<HTMLInputElement>('#mult')!;
  const monthsEl = root.querySelector<HTMLInputElement>('#months')!;
  const cashEl = root.querySelector<HTMLInputElement>('#cash')!;
  const esopEl = root.querySelector<HTMLInputElement>('#esop')!;
  const gsTargetEl = root.querySelector<HTMLSelectElement>('#gs-target')!;
  const gsGrowthEl = root.querySelector<HTMLInputElement>('#gs-growth')!;
  const presetsBox = root.querySelector<HTMLElement>('#presets')!;
  const presetNoteEl = root.querySelector<HTMLElement>('#pnote')!;
  const activePresetChip = root.querySelector<HTMLElement>('#active-preset-chip')!;
  const settingsSummaryChip = root.querySelector<HTMLElement>('#settings-summary-chip')!;
  const unitSwitcher = root.querySelector<HTMLElement>('#unit-switcher')!;
  const downloadXlsxBtn = root.querySelector<HTMLButtonElement>('#download-xlsx-btn')!;
  const sectorDrawer = root.querySelector<HTMLElement>('#sector-benchmarks-drawer')!;
  const navTools = root.querySelector<HTMLDetailsElement>('#nav-tools');

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
      state.goalSeekGrowth
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

  // Unit switcher
  unitSwitcher.querySelectorAll<HTMLButtonElement>('button[data-unit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextUnit = btn.dataset.unit as CurrencyUnit;
      if (nextUnit === state.unit) return;
      const prevUnit = state.unit;
      state.unit = nextUnit;

      if (
        (prevUnit === 'INR_CR' && nextUnit === 'INR_LAKH') ||
        (prevUnit === 'INR_LAKH' && nextUnit === 'INR_CR')
      ) {
        state.input.ask = convertUnitScale(state.input.ask, prevUnit, nextUnit);
        state.input.annualRevenue = convertUnitScale(
          state.input.annualRevenue,
          prevUnit,
          nextUnit
        );
        state.input.priorRaise = convertUnitScale(state.input.priorRaise, prevUnit, nextUnit);
        state.input.cashNeeded = convertUnitScale(state.input.cashNeeded, prevUnit, nextUnit);
      } else {
        state.activePresetId = null;
      }

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
      state.unit = p.unit;
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
    const { input } = state;
    if (skipElement !== askEl) askEl.value = String(input.ask);
    if (skipElement !== dilEl) dilEl.value = String(input.dilutionPct);
    if (skipElement !== revEl) {
      revEl.value = String(Number(input.annualRevenue.toFixed(4)));
    }
    if (skipElement !== mrrEl) {
      const monthly = input.annualRevenue / 12;
      mrrEl.value = String(Number(monthly.toFixed(4)));
    }
    if (skipElement !== priorEl) priorEl.value = String(input.priorRaise);
    pricedEl.checked = input.priorRaiseWasPriced;
    if (skipElement !== stepEl) stepEl.value = String(input.stepUpMultiple);
    if (skipElement !== multEl) multEl.value = String(input.nextRoundMultiple);
    if (skipElement !== monthsEl) monthsEl.value = String(input.monthsToNextRound);
    if (skipElement !== cashEl) cashEl.value = String(input.cashNeeded);
    if (skipElement !== esopEl) esopEl.value = String(input.esopTopUpPct);
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
    if (sourceEl !== gsTargetEl && sourceEl !== gsGrowthEl) {
      state.activePresetId = null;
    }

    if (sourceEl === mrrEl) {
      const mrr = readNumericInput(mrrEl);
      state.input.annualRevenue = Number.isFinite(mrr) ? Number((mrr * 12).toFixed(6)) : NaN;
      if (Number.isFinite(state.input.annualRevenue)) {
        revEl.value = String(Number(state.input.annualRevenue.toFixed(4)));
      }
    } else if (sourceEl === revEl) {
      const arr = readNumericInput(revEl);
      state.input.annualRevenue = arr;
      if (Number.isFinite(arr)) {
        mrrEl.value = String(Number((arr / 12).toFixed(4)));
      }
    } else if (sourceEl === gsTargetEl) {
      state.goalSeekTarget = gsTargetEl.value as GoalSeekTarget;
    } else if (sourceEl === gsGrowthEl) {
      const g = readNumericInput(gsGrowthEl);
      if (Number.isFinite(g) && g > 0) {
        state.goalSeekGrowth = g;
      }
    } else {
      state.input.ask = readNumericInput(askEl);
      state.input.dilutionPct = readNumericInput(dilEl);
      state.input.priorRaise = readNumericInput(priorEl);
      state.input.priorRaiseWasPriced = pricedEl.checked;
      state.input.stepUpMultiple = readNumericInput(stepEl);
      state.input.nextRoundMultiple = readNumericInput(multEl);
      state.input.monthsToNextRound = readNumericInput(monthsEl);
      state.input.cashNeeded = readNumericInput(cashEl);
      state.input.esopTopUpPct = readNumericInput(esopEl);
    }

    updateUI();
  }

  [
    askEl,
    dilEl,
    mrrEl,
    revEl,
    priorEl,
    stepEl,
    multEl,
    monthsEl,
    cashEl,
    esopEl,
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
      stepUpMultiple: { input: stepEl, errEl: root.querySelector('#err-step')! },
      nextRoundMultiple: { input: multEl, errEl: root.querySelector('#err-mult')! },
      monthsToNextRound: { input: monthsEl, errEl: root.querySelector('#err-months')! },
      cashNeeded: { input: cashEl, errEl: root.querySelector('#err-cash')! },
      esopTopUpPct: { input: esopEl, errEl: root.querySelector('#err-esop')! },
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

    const unitMeta = UNIT_METADATA[state.unit];
    root.querySelector('#unit-hint')!.textContent = `Amounts in ${unitMeta.shortUnit}`;
    root.querySelector('#ask-unit-sub')!.textContent = `${unitMeta.shortUnit} target raise in R1`;
    root.querySelector('#rev-sub')!.textContent = `${unitMeta.shortUnit} (monthly x 12)`;
    root.querySelector('#prior-sub')!.textContent = `${unitMeta.shortUnit} (0 if none)`;
    root.querySelector('#cash-sub')!.textContent =
      `${unitMeta.shortUnit} needed for R2 (0 if unset)`;

    // Update unit switcher active button
    unitSwitcher.querySelectorAll<HTMLButtonElement>('button[data-unit]').forEach((btn) => {
      btn.setAttribute('aria-pressed', btn.dataset.unit === state.unit ? 'true' : 'false');
    });

    // Update sector benchmark picker pressed states
    sectorDrawer.querySelectorAll<HTMLButtonElement>('button.vc-mult-pick').forEach((btn) => {
      const m = Number(btn.dataset.mult);
      btn.setAttribute(
        'aria-pressed',
        Math.abs(m - state.input.nextRoundMultiple) < 0.01 ? 'true' : 'false'
      );
    });

    // Update settings summary chip
    const summaryParts: string[] = [];
    if (state.input.priorRaise > 0) {
      summaryParts.push(`R0 ${formatMoney(state.input.priorRaise, state.unit)}`);
    }
    if (state.input.esopTopUpPct > 0) {
      summaryParts.push(`ESOP ${formatPercent(state.input.esopTopUpPct, 1)}`);
    }
    if (summaryParts.length > 0) {
      settingsSummaryChip.className = 'chip chip--primary';
      settingsSummaryChip.textContent = summaryParts.join(' · ');
    } else {
      settingsSummaryChip.className = 'chip chip--rolling';
      settingsSummaryChip.textContent = 'Optional';
    }

    // Update dynamic monthly helper caption
    const mrrSub = root.querySelector('#mrr-sub')!;
    if (Number.isFinite(state.input.annualRevenue) && state.input.annualRevenue > 0) {
      mrrSub.textContent = `${formatMonthlyMoney(state.input.annualRevenue / 12, state.unit)} (synced)`;
    } else {
      mrrSub.textContent = `${unitMeta.shortUnit}/mo (synced with ARR ÷ 12)`;
    }

    // Update preset buttons active state, chip & note
    presetsBox.querySelectorAll('button').forEach((btn) => {
      const isMatch = btn.dataset.id === state.activePresetId;
      btn.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
    });

    const activePreset = PRESET_SCENARIOS.find((p) => p.id === state.activePresetId);
    if (activePreset) {
      presetNoteEl.hidden = false;
      presetNoteEl.textContent = activePreset.description;
      activePresetChip.className = 'chip chip--primary';
      activePresetChip.textContent = activePreset.shortLabel;
    } else {
      presetNoteEl.hidden = true;
      activePresetChip.className = 'chip chip--rolling';
      activePresetChip.textContent = 'Optional';
    }

    const output = evaluateAsk(state.input, state.unit);
    renderValidationErrors(output);

    const { metrics, effectiveVerdictBands } = output;

    // Update verdict band badge
    root.querySelector('#verdict-band-badge')!.textContent =
      `Reachable ≤${formatPercent(effectiveVerdictBands.reachableCagrPct, 0)}/yr · Stretch ≤${formatPercent(effectiveVerdictBands.stretchCagrPct, 0)}/yr`;

    // Update Goal-Seek implied CAGR hint
    const safeMonths = Math.max(1, Number.isFinite(state.input.monthsToNextRound) ? state.input.monthsToNextRound : 18);
    const gsCagrPct = (Math.pow(state.goalSeekGrowth, 12 / safeMonths) - 1) * 100;
    root.querySelector('#gs-growth-hint')!.textContent =
      `Required CAGR: ${formatPercent(gsCagrPct, 0)}/yr over ${formatNumber(safeMonths, 0)} mo`;

    // Render Verdict
    const vbadge = root.querySelector<HTMLElement>('#vbadge')!;
    const vh = root.querySelector<HTMLElement>('#vh')!;
    const paceChip = root.querySelector<HTMLElement>('#vc-pace-chip')!;
    const vreasons = root.querySelector<HTMLElement>('#vreasons')!;

    const badgeSpec = VERDICT_BADGE_MAP[output.verdict.level];
    vbadge.className = badgeSpec.cls;
    vbadge.textContent = badgeSpec.label;
    vh.textContent = output.verdict.headline;

    if (metrics.impliedCagrPct.value !== null && metrics.impliedCmgrPct.value !== null) {
      paceChip.hidden = false;
      paceChip.textContent = `${formatPercent(metrics.impliedCagrPct.value, 0)}/yr · ${formatPercent(metrics.impliedCmgrPct.value, 1)}/mo`;
    } else {
      paceChip.hidden = true;
    }

    vreasons.innerHTML = output.verdict.reasons
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
            <span>${escapeHtml(r.text)}</span>
            <span class="${chipClass}">${escapeHtml(r.origin)}</span>
          </li>
        `;
      })
      .join('');

    // Render Visual Charts
    const valChartEl = root.querySelector<HTMLElement>('#valuation-chart')!;
    const valTraceWrap = root.querySelector<HTMLElement>('#valuation-trace-wrap')!;
    valChartEl.innerHTML = renderValuationLadderSvg(output);

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
        value: formatMoney(state.input.ask, state.unit),
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
    revChartEl.innerHTML = renderRevenueBridgeSvg(output);

    const burnMarkup = renderBurnComparisonBar(output);
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
      `Uses ${formatMultiple(state.input.nextRoundMultiple, 1)} R2 revenue multiple`,
      openTraces
    );

    // Render 3 Non-Redundant Signal Cards (Required CAGR, Valuation Multiple Shift, Burn/R0)
    const signalsEl = root.querySelector<HTMLElement>('#signals-strip')!;

    // Card 1: Required CAGR (Visualized)
    const cagrVal = metrics.impliedCagrPct.value;
    const cmgrVal = metrics.impliedCmgrPct.value;
    let cagrHero = 'Enter revenue';
    let cagrSub = 'add current ARR to compute CAGR';
    if (cagrVal !== null && cmgrVal !== null) {
      cagrHero = `${formatPercent(cagrVal, 0)}/yr`;
      cagrSub = `${formatPercent(cmgrVal, 1)}/mo compounded for ${formatNumber(safeMonths, 0)} mo`;
    }

    // Card 2: Valuation Multiple Shift (Visualized)
    const preMult = metrics.impliedPreRevenueMultiple.value;
    const postMult = metrics.impliedPostRevenueMultiple.value;
    let multHero = 'Enter revenue';
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

    // Card 3: Burn Plan & R0 Check
    const priorMult = metrics.askToPriorRaiseMultiple.value;
    const priorExtra =
      state.input.priorRaise > 0 && priorMult !== null
        ? `R0 raise: ${formatMultiple(priorMult, 1)} (${state.input.priorRaiseWasPriced ? '3x to 4x priced band' : 'unpriced'})`
        : null;

    signalsEl.innerHTML = [
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
      renderSignalCard(
        'fundingGap',
        'Burn plan & R0 check',
        metrics.fundingGap.formattedValue,
        metrics.fundingGap.subtitle,
        priorExtra,
        null,
        renderTraceDetails(
          'tile_fundingGap',
          metrics.fundingGap.formula,
          metrics.fundingGap.calculation,
          false,
          metrics.fundingGap.assumptionOrigin,
          openTraces
        )
      ),
    ].join('');

    // Render Feasible Ask Bar & Goal-Seek Section
    const feasibleBarEl = root.querySelector<HTMLElement>('#feasible-bar')!;
    feasibleBarEl.innerHTML = renderFeasibleAskBarSvg(output);

    const bandPillsEl = root.querySelector<HTMLElement>('#band-pills')!;
    const gsOutputEl = root.querySelector<HTMLElement>('#gs-output')!;
    const seek = solveGoalSeek(
      state.input,
      state.goalSeekTarget,
      state.goalSeekGrowth,
      state.unit
    );

    const pills: string[] = [];
    if (output.validation.valid && state.input.annualRevenue > 0) {
      pills.push(`
        <div class="vc-band-pill" data-band="reachable">
          <div class="vc-band-pill__head">
            <span class="bl">Max ask (≤${escapeHtml(formatMultiple(effectiveVerdictBands.reachableMax, 1))} · ${escapeHtml(formatPercent(effectiveVerdictBands.reachableCagrPct, 0))}/yr)</span>
            <span class="chip chip--open">Reachable</span>
          </div>
          <span class="bv">${escapeHtml(formatMoney(output.feasibleAskBand.reachableAsk, state.unit))}</span>
        </div>
      `);
      pills.push(`
        <div class="vc-band-pill" data-band="stretch">
          <div class="vc-band-pill__head">
            <span class="bl">Max ask (≤${escapeHtml(formatMultiple(effectiveVerdictBands.stretchMax, 1))} · ${escapeHtml(formatPercent(effectiveVerdictBands.stretchCagrPct, 0))}/yr)</span>
            <span class="chip chip--soon">Stretch</span>
          </div>
          <span class="bv">${escapeHtml(formatMoney(output.feasibleAskBand.stretchAsk, state.unit))}</span>
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
          <span class="bv">${escapeHtml(formatMoney(output.feasibleAskBand.priorRaiseBand[0], state.unit))} to ${escapeHtml(formatMoney(output.feasibleAskBand.priorRaiseBand[1], state.unit))}</span>
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
        const val = Number(seek.solvedValue!.toFixed(2));
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

    // Render Sensitivity Table
    const sensTable = root.querySelector<HTMLElement>('#sens')!;
    const sensTraceWrap = root.querySelector<HTMLElement>('#sens-trace-wrap')!;

    if (output.sensitivity.length === 0) {
      sensTable.innerHTML = '';
      sensTraceWrap.innerHTML = '';
    } else {
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
              <td>${escapeHtml(formatMoney(row.postMoney, state.unit))}</td>
              <td>${escapeHtml(formatMoney(row.preMoney, state.unit))}</td>
              <td>${escapeHtml(multCell)}</td>
              <td>${escapeHtml(formatMoney(row.nextPreMoney, state.unit))}</td>
              <td>${escapeHtml(growthCell)}</td>
            </tr>
          `;
        })
        .join('');

      sensTable.innerHTML = `${headerHtml}<tbody>${rowsHtml}</tbody>`;
      const dilListStr = output.sensitivity
        .map((r) => `${formatPercent(r.dilutionPct, 1)}${r.isUserSelected ? ' (yours)' : ''}`)
        .join(', ');
      sensTraceWrap.innerHTML = renderTraceDetails(
        'sens_table_trace',
        'For each dilution d%: R1 Post = R1 Ask ÷ (d/100); R2 Pre = R1 Post × Step-Up; Growth = (R2 Pre ÷ R2 Multiple) ÷ Current ARR',
        `Evaluated across ${dilListStr} dilution scenarios.`,
        false,
        'VC Benchmark (20%, 25%, 33% + step-down)',
        openTraces
      );
    }
  }

  populateInputsFromState();
  updateUI();
}
