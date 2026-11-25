import {
  DEFAULT_VERDICT_BANDS,
  PRESET_SCENARIOS,
  type CheckInput,
  type CurrencyUnit,
  type GoalSeekTarget,
} from '../engine';

export interface AppState {
  unit: CurrencyUnit;
  activePresetId: string | null;
  input: CheckInput;
  goalSeekTarget: GoalSeekTarget;
  goalSeekGrowth: number;
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
  priorDilutionPct: 'r0d',
  nextRoundDilutionPct: 'r2d',
  reachableMax: 'rmax',
  stretchMax: 'smax',
  goalSeekTarget: 'gst',
  goalSeekGrowth: 'gsg',
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
      goalSeekTarget: 'max_ask',
      goalSeekGrowth: DEFAULT_VERDICT_BANDS.reachableMax,
    };
  }

  const params = new URLSearchParams(window.location.search);
  if ([...params.keys()].length === 0) {
    return {
      unit: defaultPreset.unit,
      activePresetId: defaultPreset.id,
      input: baseInput,
      goalSeekTarget: 'max_ask',
      goalSeekGrowth: DEFAULT_VERDICT_BANDS.reachableMax,
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
  const parseOptionalNum = (key: string): number | undefined => {
    const raw = params.get(key);
    if (raw === null || raw.trim() === '') return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
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

  const gstRaw = params.get(PARAM_MAP.goalSeekTarget);
  const goalSeekTarget: GoalSeekTarget =
    gstRaw === 'max_ask' || gstRaw === 'required_revenue' || gstRaw === 'required_dilution'
      ? gstRaw
      : 'max_ask';

  const reachableMax = parseNum(PARAM_MAP.reachableMax, seed.verdictBands.reachableMax);
  const stretchMax = parseNum(PARAM_MAP.stretchMax, seed.verdictBands.stretchMax);
  const goalSeekGrowth = parseNum(PARAM_MAP.goalSeekGrowth, reachableMax);
  const priorDilutionPct = parseOptionalNum(PARAM_MAP.priorDilutionPct);
  const nextRoundDilutionPct = parseOptionalNum(PARAM_MAP.nextRoundDilutionPct);

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
    priorDilutionPct,
    nextRoundDilutionPct,
    verdictBands: {
      reachableMax,
      stretchMax,
    },
  };

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
    input.esopTopUpPct === matchedPreset.input.esopTopUpPct &&
    input.priorDilutionPct === undefined &&
    (input.nextRoundDilutionPct === undefined || input.nextRoundDilutionPct === 20);

  return {
    unit,
    activePresetId: stillMatchesPreset ? matchedPreset.id : null,
    input,
    goalSeekTarget,
    goalSeekGrowth,
  };
}

export function buildQueryString(state: AppState): string {
  const defaultPreset = PRESET_SCENARIOS[0]!;
  const base = defaultPreset.input;
  const { input } = state;
  const params = new URLSearchParams();

  const matchesPreset = (p: (typeof PRESET_SCENARIOS)[number]): boolean =>
    state.unit === p.unit &&
    Math.abs(input.ask - p.input.ask) <= 1e-9 &&
    Math.abs(input.dilutionPct - p.input.dilutionPct) <= 1e-9 &&
    Math.abs(input.annualRevenue - p.input.annualRevenue) <= 1e-9 &&
    Math.abs(input.priorRaise - p.input.priorRaise) <= 1e-9 &&
    input.priorRaiseWasPriced === p.input.priorRaiseWasPriced &&
    Math.abs(input.stepUpMultiple - p.input.stepUpMultiple) <= 1e-9 &&
    Math.abs(input.nextRoundMultiple - p.input.nextRoundMultiple) <= 1e-9 &&
    input.monthsToNextRound === p.input.monthsToNextRound &&
    Math.abs(input.cashNeeded - p.input.cashNeeded) <= 1e-9 &&
    Math.abs(input.esopTopUpPct - p.input.esopTopUpPct) <= 1e-9 &&
    input.priorDilutionPct === undefined &&
    (input.nextRoundDilutionPct === undefined || input.nextRoundDilutionPct === 20);

  const matchedPreset = state.activePresetId
    ? PRESET_SCENARIOS.find((p) => p.id === state.activePresetId)
    : undefined;

  if (matchesPreset(defaultPreset)) {
    // Keep the canonical root URL clean on default inputs
  } else if (matchedPreset && matchesPreset(matchedPreset)) {
    params.set(PARAM_MAP.preset, matchedPreset.id);
  } else {
    if (state.unit !== defaultPreset.unit) {
      params.set(PARAM_MAP.unit, state.unit);
    }
    if (Math.abs(input.ask - base.ask) > 1e-9) {
      params.set(PARAM_MAP.ask, String(input.ask));
    }
    if (Math.abs(input.dilutionPct - base.dilutionPct) > 1e-9) {
      params.set(PARAM_MAP.dilutionPct, String(input.dilutionPct));
    }
    if (Math.abs(input.annualRevenue - base.annualRevenue) > 1e-9) {
      params.set(PARAM_MAP.annualRevenue, String(Number(input.annualRevenue.toFixed(4))));
    }
    if (input.priorRaise > 0) {
      params.set(PARAM_MAP.priorRaise, String(input.priorRaise));
      if (!input.priorRaiseWasPriced) {
        params.set(PARAM_MAP.priorRaiseWasPriced, '0');
      }
    }
    if (Math.abs(input.stepUpMultiple - base.stepUpMultiple) > 1e-9) {
      params.set(PARAM_MAP.stepUpMultiple, String(input.stepUpMultiple));
    }
    if (Math.abs(input.nextRoundMultiple - base.nextRoundMultiple) > 1e-9) {
      params.set(PARAM_MAP.nextRoundMultiple, String(input.nextRoundMultiple));
    }
    if (input.monthsToNextRound !== base.monthsToNextRound) {
      params.set(PARAM_MAP.monthsToNextRound, String(input.monthsToNextRound));
    }
    if (input.cashNeeded > 0) {
      params.set(PARAM_MAP.cashNeeded, String(input.cashNeeded));
    }
    if (input.esopTopUpPct > 0) {
      params.set(PARAM_MAP.esopTopUpPct, String(input.esopTopUpPct));
    }
    if (input.priorDilutionPct !== undefined) {
      params.set(PARAM_MAP.priorDilutionPct, String(input.priorDilutionPct));
    }
    if (input.nextRoundDilutionPct !== undefined && input.nextRoundDilutionPct !== 20) {
      params.set(PARAM_MAP.nextRoundDilutionPct, String(input.nextRoundDilutionPct));
    }
  }

  if (input.verdictBands.reachableMax !== DEFAULT_VERDICT_BANDS.reachableMax) {
    params.set(PARAM_MAP.reachableMax, String(input.verdictBands.reachableMax));
  }
  if (input.verdictBands.stretchMax !== DEFAULT_VERDICT_BANDS.stretchMax) {
    params.set(PARAM_MAP.stretchMax, String(input.verdictBands.stretchMax));
  }
  if (state.goalSeekTarget !== 'max_ask') {
    params.set(PARAM_MAP.goalSeekTarget, state.goalSeekTarget);
  }
  if (state.goalSeekGrowth !== input.verdictBands.reachableMax) {
    params.set(PARAM_MAP.goalSeekGrowth, String(state.goalSeekGrowth));
  }
  return params.toString();
}

export function syncStateToUrl(state: AppState): void {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  const qs = buildQueryString(state);
  const newUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (newUrl !== currentUrl) {
    window.history.replaceState(null, '', newUrl);
  }
}
