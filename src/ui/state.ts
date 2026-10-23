import {
  DEFAULT_VERDICT_BANDS,
  PRESET_SCENARIOS,
  type CheckInput,
  type CurrencyUnit,
} from '../engine';

export interface AppState {
  unit: CurrencyUnit;
  activePresetId: string | null;
  input: CheckInput;
}

const PARAM_MAP = {
  unit: 'u',
  preset: 'p',
  ask: 'ask',
  dilutionPct: 'dil',
  annualRevenue: 'rev',
  priorRaise: 'prior',
  priorRaiseWasPriced: 'priced',
  stepUpMultiple: 'step',
  nextRoundMultiple: 'mult',
  monthsToNextRound: 'm',
  cashNeeded: 'cash',
  esopTopUpPct: 'esop',
  reachableMax: 'rmax',
  stretchMax: 'smax',
} as const;

export function getInitialState(): AppState {
  const defaultPreset = PRESET_SCENARIOS[0]!;
  const baseInput: CheckInput = {
    ...defaultPreset.input,
    verdictBands: { ...DEFAULT_VERDICT_BANDS },
  };

  if (typeof window === 'undefined' || !window.location.search) {
    return {
      unit: defaultPreset.unit,
      activePresetId: defaultPreset.id,
      input: baseInput,
    };
  }

  const params = new URLSearchParams(window.location.search);
  if ([...params.keys()].length === 0) {
    return {
      unit: defaultPreset.unit,
      activePresetId: defaultPreset.id,
      input: baseInput,
    };
  }

  const presetId = params.get(PARAM_MAP.preset);
  const matchedPreset = PRESET_SCENARIOS.find((p) => p.id === presetId);
  const seed = matchedPreset ? matchedPreset.input : baseInput;

  const parseNum = (key: string, fallback: number): number => {
    const raw = params.get(key);
    if (raw === null || raw.trim() === '') return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  };

  const unitRaw = params.get(PARAM_MAP.unit);
  const unit: CurrencyUnit =
    unitRaw === 'INR_CR' || unitRaw === 'INR_LAKH' || unitRaw === 'USD_M'
      ? unitRaw
      : matchedPreset?.unit ?? 'INR_CR';

  const pricedRaw = params.get(PARAM_MAP.priorRaiseWasPriced);
  const priorRaiseWasPriced =
    pricedRaw === '0' || pricedRaw === 'false'
      ? false
      : pricedRaw === '1' || pricedRaw === 'true'
        ? true
        : seed.priorRaiseWasPriced;

  const input: CheckInput = {
    ask: parseNum(PARAM_MAP.ask, seed.ask),
    dilutionPct: parseNum(PARAM_MAP.dilutionPct, seed.dilutionPct),
    annualRevenue: parseNum(PARAM_MAP.annualRevenue, seed.annualRevenue),
    priorRaise: parseNum(PARAM_MAP.priorRaise, seed.priorRaise),
    priorRaiseWasPriced,
    stepUpMultiple: parseNum(PARAM_MAP.stepUpMultiple, seed.stepUpMultiple),
    nextRoundMultiple: parseNum(PARAM_MAP.nextRoundMultiple, seed.nextRoundMultiple),
    monthsToNextRound: parseNum(PARAM_MAP.monthsToNextRound, seed.monthsToNextRound),
    cashNeeded: parseNum(PARAM_MAP.cashNeeded, seed.cashNeeded),
    esopTopUpPct: parseNum(PARAM_MAP.esopTopUpPct, seed.esopTopUpPct),
    verdictBands: {
      reachableMax: parseNum(PARAM_MAP.reachableMax, seed.verdictBands.reachableMax),
      stretchMax: parseNum(PARAM_MAP.stretchMax, seed.verdictBands.stretchMax),
    },
  };

  // Detect if input still matches the preset
  const stillMatchesPreset =
    matchedPreset &&
    unit === matchedPreset.unit &&
    input.ask === matchedPreset.input.ask &&
    input.dilutionPct === matchedPreset.input.dilutionPct &&
    input.annualRevenue === matchedPreset.input.annualRevenue &&
    input.priorRaise === matchedPreset.input.priorRaise &&
    input.stepUpMultiple === matchedPreset.input.stepUpMultiple &&
    input.nextRoundMultiple === matchedPreset.input.nextRoundMultiple &&
    input.monthsToNextRound === matchedPreset.input.monthsToNextRound &&
    input.cashNeeded === matchedPreset.input.cashNeeded &&
    input.esopTopUpPct === matchedPreset.input.esopTopUpPct;

  return {
    unit,
    activePresetId: stillMatchesPreset ? matchedPreset.id : null,
    input,
  };
}

export function buildQueryString(state: AppState): string {
  const params = new URLSearchParams();
  if (state.activePresetId) {
    params.set(PARAM_MAP.preset, state.activePresetId);
  }
  if (state.unit !== 'INR_CR') {
    params.set(PARAM_MAP.unit, state.unit);
  }
  params.set(PARAM_MAP.ask, String(state.input.ask));
  params.set(PARAM_MAP.dilutionPct, String(state.input.dilutionPct));
  params.set(PARAM_MAP.annualRevenue, String(Number(state.input.annualRevenue.toFixed(4))));
  if (state.input.priorRaise > 0) {
    params.set(PARAM_MAP.priorRaise, String(state.input.priorRaise));
    if (!state.input.priorRaiseWasPriced) {
      params.set(PARAM_MAP.priorRaiseWasPriced, '0');
    }
  }
  params.set(PARAM_MAP.stepUpMultiple, String(state.input.stepUpMultiple));
  params.set(PARAM_MAP.nextRoundMultiple, String(state.input.nextRoundMultiple));
  params.set(PARAM_MAP.monthsToNextRound, String(state.input.monthsToNextRound));
  if (state.input.cashNeeded > 0) {
    params.set(PARAM_MAP.cashNeeded, String(state.input.cashNeeded));
  }
  if (state.input.esopTopUpPct > 0) {
    params.set(PARAM_MAP.esopTopUpPct, String(state.input.esopTopUpPct));
  }
  if (state.input.verdictBands.reachableMax !== DEFAULT_VERDICT_BANDS.reachableMax) {
    params.set(PARAM_MAP.reachableMax, String(state.input.verdictBands.reachableMax));
  }
  if (state.input.verdictBands.stretchMax !== DEFAULT_VERDICT_BANDS.stretchMax) {
    params.set(PARAM_MAP.stretchMax, String(state.input.verdictBands.stretchMax));
  }
  return params.toString();
}

export function syncStateToUrl(state: AppState): void {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  const qs = buildQueryString(state);
  const newUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
  window.history.replaceState(null, '', newUrl);
}
