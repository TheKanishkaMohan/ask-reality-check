import {
  ASSUMPTION_REFERENCES,
  DEFAULT_VERDICT_BANDS,
  PRESET_SCENARIOS,
  UNIT_METADATA,
  convertUnitScale,
  evaluateAsk,
  formatMoney,
  formatMonthlyMoney,
  formatMultiple,
  formatPercent,
  solveGoalSeek,
  type CheckOutput,
  type CurrencyUnit,
  type GoalSeekTarget,
  type TracedMetric,
  type ValidationField,
} from '../engine';
import { generateMarkdownSummary } from './export';
import { syncStateToUrl, type AppState } from './state';

function escapeHtml(str: string): string {
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
  const badgeClass = isAssumption ? 'badge badge-assumption' : 'badge';
  const badgeLabel = isAssumption ? `Our assumption` : `Source article`;
  const showDetailOrigin = origin.trim().toLowerCase() !== badgeLabel.toLowerCase();
  return `
    <details class="trace" data-trace-id="${escapeHtml(traceId)}"${isOpen}>
      <summary>How this is calculated</summary>
      <div class="trace-body">
        <div class="trace-formula">${escapeHtml(formula)}</div>
        <div class="trace-calc">${escapeHtml(calculation)}</div>
        <div class="trace-origin">
          <span class="${badgeClass}">${escapeHtml(badgeLabel)}</span>
          ${showDetailOrigin ? `<span>${escapeHtml(origin)}</span>` : ''}
        </div>
      </div>
    </details>
  `;
}

function renderTile(metric: TracedMetric, openTraces: Set<string>): string {
  const badgeHtml = metric.isAssumption
    ? `<span class="badge badge-assumption" title="${escapeHtml(metric.assumptionOrigin)}">Assumption</span>`
    : '';
  return `
    <div class="tile" data-metric-id="${escapeHtml(metric.id)}">
      <div class="tile-main">
        <span class="l">
          <span>${escapeHtml(metric.label)}</span>
          ${badgeHtml}
        </span>
        <span class="v">${escapeHtml(metric.formattedValue)}</span>
        <span class="n">${escapeHtml(metric.subtitle)}</span>
      </div>
      ${renderTraceDetails(
        `tile_${metric.id}`,
        metric.formula,
        metric.calculation,
        metric.isAssumption,
        metric.assumptionOrigin,
        openTraces
      )}
    </div>
  `;
}

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
  let themeMode: 'system' | 'light' | 'dark' = 'system';

  const assumptionsRowsHtml = ASSUMPTION_REFERENCES.map((item) => {
    const isOurAssumption = item.origin === 'Our Assumption';
    const badgeClass = isOurAssumption ? 'badge badge-assumption' : 'badge';
    return `
      <tr>
        <td><strong>${escapeHtml(item.parameter)}</strong></td>
        <td><code>${escapeHtml(item.defaultValue)}</code></td>
        <td><span class="${badgeClass}">${escapeHtml(item.origin)}</span></td>
        <td>${escapeHtml(item.explanation)}</td>
      </tr>
    `;
  }).join('');

  root.innerHTML = `
    <div class="wrap">
      <div class="top-bar">
        <div class="brand-pill">
          <img src="./logo-mark.png" alt="" class="brand-logo brand-logo-light" width="20" height="20" />
          <img src="./logo-mark-inverted.png" alt="" class="brand-logo brand-logo-dark" width="20" height="20" />
          <span>Pareto’s Edge · Incrementally Original</span>
        </div>
        <div class="header-actions">
          <button type="button" id="copy-link-btn" class="icon-btn" aria-label="Copy shareable scenario link">
            Copy Link
          </button>
          <button type="button" id="copy-md-btn" class="icon-btn" aria-label="Copy summary as Markdown">
            Copy Markdown
          </button>
          <button type="button" id="print-btn" class="icon-btn" aria-label="Print or save as PDF">
            Print / PDF
          </button>
          <button type="button" id="theme-toggle" class="icon-btn" aria-label="Toggle color theme">
            Theme: Auto
          </button>
        </div>
      </div>

      <header class="hero">
        <p class="eyebrow">Fundraise sanity check</p>
        <h1>Ask Reality Check</h1>
        <div class="rule"></div>
        <p class="sub">
          Your ask sets the valuation a VC hears. This tool works backwards from the ask to the next round, following
          <a href="https://www.linkedin.com/pulse/rookie-fundraising-mistake-even-some-experienced-founders-sajith-pai-nvl2c/" target="_blank" rel="noopener noreferrer">Sajith Pai’s note on the rookie fundraising mistake</a>.
          <span id="unit-banner-text">All monetary amounts are in ₹ Cr.</span>
        </p>
      </header>

      <div class="toolbar-row">
        <section class="presets-bar" aria-label="Worked examples from the article" style="flex: 1; min-width: 260px;">
          <div class="presets" id="presets" role="group" aria-label="Examples"></div>
        </section>

        <div class="action-group" role="group" aria-label="Currency and unit selection">
          <span style="font-size: 12.5px; font-weight: 600; color: var(--muted);">Units:</span>
          <div class="segmented" id="unit-switcher">
            <button type="button" data-unit="INR_CR" aria-pressed="true">₹ Cr</button>
            <button type="button" data-unit="INR_LAKH" aria-pressed="false">₹ Lakh</button>
            <button type="button" data-unit="USD_M" aria-pressed="false">USD ($M)</button>
          </div>
        </div>
      </div>

      <p id="pnote" class="preset-note" hidden></p>

      <div class="cols">
        <section class="card" aria-label="Inputs">
          <div class="card-header">
            <p class="eyebrow">Inputs</p>
            <small id="unit-hint" style="color: var(--muted); font-size: 12.5px;">Amounts in ₹ Cr</small>
          </div>

          <div class="field-group">
            <div class="pair">
              <div class="field">
                <label for="ask">Ask (raise)</label>
                <input id="ask" type="number" step="any" min="0" inputmode="decimal" />
                <small id="ask-unit-sub">₹ Cr intended raise</small>
                <div class="field-error" id="err-ask" hidden></div>
              </div>
              <div class="field">
                <label for="dil">Dilution</label>
                <input id="dil" type="number" step="any" min="0.1" max="99.9" inputmode="decimal" />
                <small>% (early rounds: 20–25%)</small>
                <div class="field-error" id="err-dil" hidden></div>
              </div>
            </div>

            <div class="pair">
              <div class="field">
                <label for="mrr">Monthly revenue now</label>
                <input id="mrr" type="number" step="any" min="0" inputmode="decimal" />
                <small id="mrr-sub">₹ Cr/mo (e.g. 0.75 = ₹75 Lakh/mo)</small>
              </div>
              <div class="field">
                <label for="rev">Annualised revenue now</label>
                <input id="rev" type="number" step="any" min="0" inputmode="decimal" />
                <small id="rev-sub">₹ Cr (monthly × 12)</small>
                <div class="field-error" id="err-rev" hidden></div>
              </div>
            </div>

            <div class="pair">
              <div class="field">
                <label for="prior">Previous raise</label>
                <input id="prior" type="number" step="any" min="0" inputmode="decimal" />
                <small id="prior-sub">₹ Cr (0 if none)</small>
                <div class="field-error" id="err-prior" hidden></div>
              </div>
              <div class="field">
                <label for="cash">Cash needed to hit milestone</label>
                <input id="cash" type="number" step="any" min="0" inputmode="decimal" />
                <small id="cash-sub">₹ Cr from your burn plan (0 if unset)</small>
                <div class="field-error" id="err-cash" hidden></div>
              </div>
            </div>

            <div class="switch-row" id="priced-switch-row">
              <input id="priced" type="checkbox" checked />
              <div>
                <label for="priced">Previous raise was a priced equity round</label>
                <small>Applies the article’s 3–4x previous-raise rule. Uncheck for grants, convertible notes, or founder capital.</small>
              </div>
            </div>

            <div class="pair">
              <div class="field">
                <label for="step">
                  <span>Required step-up</span>
                </label>
                <input id="step" type="number" step="any" min="1" inputmode="decimal" />
                <small>next pre-money ÷ this post-money (2x benchmark)</small>
                <div class="field-error" id="err-step" hidden></div>
              </div>
              <div class="field">
                <label for="mult">
                  <span>Next-round revenue multiple</span>
                  <span class="badge badge-assumption">Assumption</span>
                </label>
                <input id="mult" type="number" step="any" min="0.1" inputmode="decimal" />
                <small>x ARR; multiples typically compress round-to-round</small>
                <div class="field-error" id="err-mult" hidden></div>
              </div>
            </div>

            <div class="sector-caveat">
              <strong>Multiple caveat:</strong> Revenue multiples best fit venture-style software and high-margin consumer brands. For asset-heavy, manufacturing, or low-margin businesses, override the multiple above with sector-specific comparables.
            </div>

            <div class="pair">
              <div class="field">
                <label for="months">Months to next round</label>
                <input id="months" type="number" step="1" min="1" max="120" inputmode="numeric" />
                <small>15–18 months is the seed convention</small>
                <div class="field-error" id="err-months" hidden></div>
              </div>
              <div class="field">
                <label for="esop">ESOP top-up created pre-money</label>
                <input id="esop" type="number" step="any" min="0" max="50" inputmode="decimal" />
                <small>% of post-money; lowers effective pre-money</small>
                <div class="field-error" id="err-esop" hidden></div>
              </div>
            </div>
          </div>
        </section>

        <section class="card" aria-label="Results" aria-live="polite" id="results-panel">
          <div class="card-header">
            <p class="eyebrow">What your ask signals</p>
            <span class="badge badge-assumption" id="verdict-band-badge">Verdict bands: ≤3x / ≤5x (our assumption)</span>
          </div>

          <div class="verdict-box" id="verdict-box">
            <div class="verdict-head">
              <div class="dot" id="vdot" data-level="reachable"></div>
              <div class="verdict-title-wrap">
                <h2 id="vh"></h2>
              </div>
            </div>
            <ul class="reasons-list" id="vreasons"></ul>
          </div>

          <div class="tiles" id="tiles"></div>

          <!-- Step 3: Integrated Goal-Seek Mode -->
          <div class="goalseek-section" aria-label="Goal-seek calculator">
            <div class="card-header">
              <p class="eyebrow">Your ask is a goal-seek</p>
              <span class="badge">Backwards solver</span>
            </div>

            <div class="band-pills" id="band-pills"></div>

            <div class="solver-controls">
              <div class="field">
                <label for="gs-target">Solve backwards for</label>
                <select id="gs-target" class="solver-select">
                  <option value="max_ask">Largest ask that clears growth ceiling</option>
                  <option value="required_revenue">Current revenue needed for this ask</option>
                  <option value="required_dilution">Dilution needed for this ask &amp; revenue</option>
                </select>
              </div>
              <div class="field">
                <label for="gs-growth">
                  <span>Target max growth (x)</span>
                  <span class="badge badge-assumption">Assumption</span>
                </label>
                <input id="gs-growth" type="number" step="0.1" min="0.5" max="50" inputmode="decimal" />
              </div>
            </div>

            <div class="solver-output" id="gs-output"></div>
          </div>

          <div class="chain-section">
            <p class="eyebrow">Valuation &amp; cap-table chain</p>
            <ul class="chain" id="chain"></ul>
          </div>

          <div class="sens-section">
            <div class="card-header">
              <p class="eyebrow">If the dilution were different</p>
              <small style="color: var(--muted); font-size: 12px;">20%, 25%, 33% benchmarks + your input</small>
            </div>
            <div class="scroll">
              <table class="sens-table" id="sens" aria-label="Dilution sensitivity table"></table>
            </div>
            <div id="sens-trace-wrap"></div>
          </div>

          <p class="sub" style="font-size: 13px;">
            Rules of thumb from the source article: 20–25% early dilution (4–5x ask), next pre-money at least 2x this post-money in 15–18 months, and asks of 3–4x the previous priced raise. The growth verdict bands are <strong>our assumption</strong> inferred from the article’s examples and can be customised below.
          </p>
        </section>
      </div>

      <!-- Step 4: Settings & Assumptions Reference -->
      <details class="panel-drawer" id="settings-drawer">
        <summary>
          <span>Settings &amp; Verdict Band Thresholds</span>
          <span class="badge badge-assumption">Configurable assumptions</span>
        </summary>
        <div class="drawer-content">
          <div class="pair">
            <div class="field">
              <label for="band-reach">
                <span>Reachable growth ceiling (x)</span>
                <span class="badge badge-assumption">Our assumption</span>
              </label>
              <input id="band-reach" type="number" step="0.1" min="0.5" max="20" inputmode="decimal" />
              <small>Growth at or below this multiple is marked Reachable (default 3.0x)</small>
            </div>
            <div class="field">
              <label for="band-stretch">
                <span>Stretch growth ceiling (x)</span>
                <span class="badge badge-assumption">Our assumption</span>
              </label>
              <input id="band-stretch" type="number" step="0.1" min="1" max="50" inputmode="decimal" />
              <small>Growth above this multiple is marked Stiff (default 5.0x)</small>
              <div class="field-error" id="err-bands" hidden></div>
            </div>
          </div>
          <div>
            <button type="button" id="reset-bands-btn" class="icon-btn">Reset verdict bands to 3.0x / 5.0x</button>
          </div>
        </div>
      </details>

      <details class="panel-drawer" id="assumptions-drawer">
        <summary>
          <span>All Defaults, Rules of Thumb &amp; Origins</span>
          <span class="badge">Source Article vs. Our Assumptions</span>
        </summary>
        <div class="drawer-content">
          <div class="scroll">
            <table class="assumptions-table" aria-label="Defaults and origins reference">
              <thead>
                <tr>
                  <th>Parameter / Rule</th>
                  <th>Default</th>
                  <th>Origin</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                ${assumptionsRowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </details>

      <footer class="app-footer">
        <div class="footer-row">
          <span class="privacy-pill">100% Client-Side · Offline Ready · Zero Network Calls</span>
          <span>Design system: <strong>TheKanishkaMohan</strong> · Pareto’s Edge</span>
        </div>
        <p style="margin: 0;">
          <strong>Disclaimer:</strong> Unofficial thinking aid based on Sajith Pai’s published LinkedIn note. Not affiliated with Sajith Pai or Blume Ventures, and not financial or investment advice. Nothing you type leaves your browser.
        </p>
      </footer>
    </div>
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
  const bandReachEl = root.querySelector<HTMLInputElement>('#band-reach')!;
  const bandStretchEl = root.querySelector<HTMLInputElement>('#band-stretch')!;
  const resetBandsBtn = root.querySelector<HTMLButtonElement>('#reset-bands-btn')!;
  const presetsBox = root.querySelector<HTMLElement>('#presets')!;
  const presetNoteEl = root.querySelector<HTMLElement>('#pnote')!;
  const unitSwitcher = root.querySelector<HTMLElement>('#unit-switcher')!;
  const themeBtn = root.querySelector<HTMLButtonElement>('#theme-toggle')!;
  const copyLinkBtn = root.querySelector<HTMLButtonElement>('#copy-link-btn')!;
  const copyMdBtn = root.querySelector<HTMLButtonElement>('#copy-md-btn')!;
  const printBtn = root.querySelector<HTMLButtonElement>('#print-btn')!;

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

  // Theme toggle handler
  themeBtn.addEventListener('click', () => {
    if (themeMode === 'system') {
      themeMode = 'dark';
      document.documentElement.setAttribute('data-theme', 'dark');
      themeBtn.textContent = 'Theme: Dark';
    } else if (themeMode === 'dark') {
      themeMode = 'light';
      document.documentElement.setAttribute('data-theme', 'light');
      themeBtn.textContent = 'Theme: Light';
    } else {
      themeMode = 'system';
      document.documentElement.removeAttribute('data-theme');
      themeBtn.textContent = 'Theme: Auto';
    }
  });

  // Share & Export actions
  copyLinkBtn.addEventListener('click', async () => {
    syncStateToUrl(state);
    try {
      await navigator.clipboard.writeText(window.location.href);
      copyLinkBtn.textContent = 'Link Copied!';
      setTimeout(() => {
        copyLinkBtn.textContent = 'Copy Link';
      }, 1800);
    } catch {
      copyLinkBtn.textContent = 'URL in address bar';
    }
  });

  copyMdBtn.addEventListener('click', async () => {
    const md = generateMarkdownSummary(
      state.input,
      state.unit,
      state.goalSeekTarget,
      state.goalSeekGrowth
    );
    try {
      await navigator.clipboard.writeText(md);
      copyMdBtn.textContent = 'Markdown Copied!';
      setTimeout(() => {
        copyMdBtn.textContent = 'Copy Markdown';
      }, 1800);
    } catch {
      copyMdBtn.textContent = 'Copy failed';
    }
  });

  printBtn.addEventListener('click', () => {
    window.print();
  });

  // Unit switcher
  unitSwitcher.querySelectorAll<HTMLButtonElement>('button[data-unit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextUnit = btn.dataset.unit as CurrencyUnit;
      if (nextUnit === state.unit) return;
      const prevUnit = state.unit;
      state.unit = nextUnit;

      // Scale monetary inputs if switching between ₹ Cr and ₹ Lakh
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
    if (skipElement !== bandReachEl)
      bandReachEl.value = String(input.verdictBands.reachableMax);
    if (skipElement !== bandStretchEl)
      bandStretchEl.value = String(input.verdictBands.stretchMax);
  }

  function readNumericInput(el: HTMLInputElement): number {
    const raw = el.value.trim();
    if (raw === '') return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  function handleInputChange(sourceEl: HTMLElement): void {
    if (
      sourceEl !== gsTargetEl &&
      sourceEl !== gsGrowthEl &&
      sourceEl !== bandReachEl &&
      sourceEl !== bandStretchEl
    ) {
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
    } else if (sourceEl === bandReachEl || sourceEl === bandStretchEl) {
      state.input.verdictBands.reachableMax = readNumericInput(bandReachEl);
      state.input.verdictBands.stretchMax = readNumericInput(bandStretchEl);
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
    bandReachEl,
    bandStretchEl,
  ].forEach((el) => {
    el.addEventListener('input', () => handleInputChange(el));
  });
  pricedEl.addEventListener('change', () => handleInputChange(pricedEl));
  gsTargetEl.addEventListener('change', () => handleInputChange(gsTargetEl));

  resetBandsBtn.addEventListener('click', () => {
    state.input.verdictBands = { ...DEFAULT_VERDICT_BANDS };
    state.goalSeekGrowth = DEFAULT_VERDICT_BANDS.reachableMax;
    populateInputsFromState();
    updateUI();
  });

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
      verdictBands: { input: bandStretchEl, errEl: root.querySelector('#err-bands')! },
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
    root.querySelector('#unit-banner-text')!.textContent =
      `All monetary amounts are in ${unitMeta.shortUnit}.`;
    root.querySelector('#unit-hint')!.textContent = `Amounts in ${unitMeta.shortUnit}`;
    root.querySelector('#ask-unit-sub')!.textContent = `${unitMeta.shortUnit} intended raise`;
    root.querySelector('#rev-sub')!.textContent = `${unitMeta.shortUnit} (monthly × 12)`;
    root.querySelector('#prior-sub')!.textContent = `${unitMeta.shortUnit} (0 if none)`;
    root.querySelector('#cash-sub')!.textContent =
      `${unitMeta.shortUnit} from your burn plan (0 if unset)`;

    // Update unit switcher active button
    unitSwitcher.querySelectorAll<HTMLButtonElement>('button[data-unit]').forEach((btn) => {
      btn.setAttribute('aria-pressed', btn.dataset.unit === state.unit ? 'true' : 'false');
    });

    // Update verdict band badge
    root.querySelector('#verdict-band-badge')!.textContent =
      `Verdict bands: ≤${formatMultiple(state.input.verdictBands.reachableMax, 1)} / ≤${formatMultiple(state.input.verdictBands.stretchMax, 1)} (our assumption)`;

    // Update dynamic monthly helper caption
    const mrrSub = root.querySelector('#mrr-sub')!;
    if (Number.isFinite(state.input.annualRevenue) && state.input.annualRevenue > 0) {
      mrrSub.textContent = `${formatMonthlyMoney(state.input.annualRevenue / 12, state.unit)} (synced with annual ÷ 12)`;
    } else {
      mrrSub.textContent = `${unitMeta.shortUnit}/mo (synced with annual ÷ 12)`;
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

    const output = evaluateAsk(state.input, state.unit);
    renderValidationErrors(output);

    // Render Verdict
    const vdot = root.querySelector<HTMLElement>('#vdot')!;
    const vh = root.querySelector<HTMLElement>('#vh')!;
    const vreasons = root.querySelector<HTMLElement>('#vreasons')!;

    vdot.dataset.level = output.verdict.level;
    vh.textContent = output.verdict.headline;

    vreasons.innerHTML = output.verdict.reasons
      .map((r) => {
        const badgeClass = r.isAssumption ? 'badge badge-assumption' : 'badge';
        return `
          <li class="reason-item" data-tone="${escapeHtml(r.tone)}">
            <span>${escapeHtml(r.text)}</span>
            <span class="${badgeClass}">${escapeHtml(r.origin)}</span>
          </li>
        `;
      })
      .join('');

    // Render 6 Core Tiles with expandable formula traces
    const tilesEl = root.querySelector<HTMLElement>('#tiles')!;
    const { metrics } = output;
    tilesEl.innerHTML = [
      renderTile(metrics.impliedPostMoney, openTraces),
      renderTile(metrics.impliedPostRevenueMultiple, openTraces),
      renderTile(metrics.nextRoundPreMoney, openTraces),
      renderTile(metrics.requiredNextAnnualRevenue, openTraces),
      renderTile(metrics.requiredGrowthMultiple, openTraces),
      renderTile(metrics.fundingGap, openTraces),
    ].join('');

    // Render Goal-Seek Section
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
        <div class="band-pill" data-band="reachable">
          <span class="bl">Max Ask for Reachable (≤${escapeHtml(formatMultiple(state.input.verdictBands.reachableMax, 1))})</span>
          <span class="bv">${escapeHtml(formatMoney(output.feasibleAskBand.reachableAsk, state.unit))}</span>
        </div>
      `);
      pills.push(`
        <div class="band-pill" data-band="stretch">
          <span class="bl">Max Ask for Stretch (≤${escapeHtml(formatMultiple(state.input.verdictBands.stretchMax, 1))})</span>
          <span class="bv">${escapeHtml(formatMoney(output.feasibleAskBand.stretchAsk, state.unit))}</span>
        </div>
      `);
    }
    if (output.feasibleAskBand.priorRaiseBand) {
      pills.push(`
        <div class="band-pill" data-band="prior">
          <span class="bl">3–4x Priced Prior Raise Band</span>
          <span class="bv">${escapeHtml(formatMoney(output.feasibleAskBand.priorRaiseBand[0], state.unit))} – ${escapeHtml(formatMoney(output.feasibleAskBand.priorRaiseBand[1], state.unit))}</span>
        </div>
      `);
    }
    bandPillsEl.innerHTML = pills.join('');

    const canApplyGoalSeek = seek.isFeasible && seek.solvedValue !== null;
    gsOutputEl.innerHTML = `
      <div class="solver-result-row">
        <div class="solver-hero">
          <span class="sv">${escapeHtml(seek.formattedSolvedValue)}</span>
          ${
            seek.secondaryFormattedValue
              ? `<span class="ss">(${escapeHtml(seek.secondaryFormattedValue)})</span>`
              : ''
          }
        </div>
        ${
          canApplyGoalSeek
            ? `<button type="button" id="apply-goalseek-btn" class="btn-primary">Apply to inputs</button>`
            : ''
        }
      </div>
      <p style="margin: 0; font-size: 13.5px; color: var(--ink);">${escapeHtml(seek.summary)}</p>
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

    // Render Valuation & Cap-Table Chain with expandable traces
    const chainEl = root.querySelector<HTMLElement>('#chain')!;
    const chainItems: Array<{
      id: string;
      label: string;
      value: string;
      formula: string;
      calculation: string;
      isAssumption: boolean;
      origin: string;
    }> = [
      {
        id: 'chain_ask',
        label: 'Ask (intended raise)',
        value: formatMoney(state.input.ask, state.unit),
        formula: 'Direct user input (Ask)',
        calculation: `Ask = ${formatMoney(state.input.ask, state.unit)} at ${formatPercent(state.input.dilutionPct, 1)} target dilution`,
        isAssumption: false,
        origin: 'User Input',
      },
      {
        id: 'chain_pre',
        label: 'Pre-money signalled',
        value: metrics.impliedPreMoney.formattedValue,
        formula: metrics.impliedPreMoney.formula,
        calculation: metrics.impliedPreMoney.calculation,
        isAssumption: metrics.impliedPreMoney.isAssumption,
        origin: metrics.impliedPreMoney.assumptionOrigin,
      },
      {
        id: 'chain_pre_mult',
        label: 'Implied revenue multiple (pre vs. post)',
        value:
          metrics.impliedPreRevenueMultiple.value !== null &&
          metrics.impliedPostRevenueMultiple.value !== null
            ? `${formatMultiple(metrics.impliedPreRevenueMultiple.value, 1)} pre · ${formatMultiple(metrics.impliedPostRevenueMultiple.value, 1)} post`
            : 'Enter revenue',
        formula: metrics.impliedPreRevenueMultiple.formula,
        calculation: metrics.impliedPostRevenueMultiple.calculation,
        isAssumption: false,
        origin: 'Source Article (Example B notes ~7x pre-money on ₹80 Cr / ₹12 Cr ARR)',
      },
    ];

    if (state.input.esopTopUpPct > 0) {
      chainItems.push({
        id: 'chain_esop',
        label: `Effective pre-money after ${formatPercent(state.input.esopTopUpPct, 1)} ESOP pool`,
        value: metrics.effectivePreMoneyAfterEsop.formattedValue,
        formula: metrics.effectivePreMoneyAfterEsop.formula,
        calculation: metrics.effectivePreMoneyAfterEsop.calculation,
        isAssumption: metrics.effectivePreMoneyAfterEsop.isAssumption,
        origin: metrics.effectivePreMoneyAfterEsop.assumptionOrigin,
      });
    }

    if (state.input.priorRaise > 0) {
      chainItems.push({
        id: 'chain_prior',
        label: 'Ask vs. previous raise',
        value: metrics.askToPriorRaiseMultiple.formattedValue,
        formula: metrics.askToPriorRaiseMultiple.formula,
        calculation: metrics.askToPriorRaiseMultiple.calculation,
        isAssumption: !state.input.priorRaiseWasPriced,
        origin: state.input.priorRaiseWasPriced
          ? 'Source Article (3–4x previous priced raise benchmark)'
          : 'Our Assumption (Unpriced prior raise bypasses 3–4x rule)',
      });
    }

    chainEl.innerHTML = chainItems
      .map(
        (item) => `
        <li>
          <div class="chain-row">
            <span class="chain-label">${escapeHtml(item.label)}</span>
            <span class="chain-value">${escapeHtml(item.value)}</span>
          </div>
          ${renderTraceDetails(
            item.id,
            item.formula,
            item.calculation,
            item.isAssumption,
            item.origin,
            openTraces
          )}
        </li>
      `
      )
      .join('');

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
            <th>Post-money</th>
            <th>Pre-money</th>
            <th>Pre / Post ×</th>
            <th>Next pre</th>
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
              : '—';
          const growthCell =
            row.requiredGrowthMultiple !== null
              ? formatMultiple(row.requiredGrowthMultiple, 1)
              : '—';

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
      sensTraceWrap.innerHTML = renderTraceDetails(
        'sens_table_trace',
        'For each dilution d%: Post = Ask ÷ (d/100); Next Pre = Post × Step-Up; Growth = (Next Pre ÷ Next Multiple) ÷ Current ARR',
        `Evaluated at 20% (5x ask), 25% (4x ask), and 33% (~3x ask) benchmarks from the article${
          output.sensitivity.length > 3
            ? `, plus your custom ${formatPercent(state.input.dilutionPct, 1)} input`
            : ''
        }.`,
        false,
        'Source Article (20%, 25%, 33% dilution benchmarks)',
        openTraces
      );
    }
  }

  populateInputsFromState();
  updateUI();
}
