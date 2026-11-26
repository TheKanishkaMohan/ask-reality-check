import type { CurrencyUnit } from './types';

export const DEFAULT_FX_INR_PER_USD = 85;

export interface UnitMetadata {
  id: CurrencyUnit;
  label: string;
  shortUnit: string;
  symbol: string;
  suffix: string;
  locale: string;
  indianSubUnitLabel: string;
}

export const UNIT_METADATA: Record<CurrencyUnit, UnitMetadata> = {
  INR_CR: {
    id: 'INR_CR',
    label: '₹ Crore (₹ Cr)',
    shortUnit: '₹ Cr',
    symbol: '₹',
    suffix: ' Cr',
    locale: 'en-IN',
    indianSubUnitLabel: '₹ Cr (or Lakhs/mo)',
  },
  INR_LAKH: {
    id: 'INR_LAKH',
    label: '₹ Lakh (₹ L)',
    shortUnit: '₹ Lakh',
    symbol: '₹',
    suffix: ' Lakh',
    locale: 'en-IN',
    indianSubUnitLabel: '₹ Lakh',
  },
  USD_M: {
    id: 'USD_M',
    label: 'US Dollars ($M)',
    shortUnit: '$M',
    symbol: '$',
    suffix: 'M',
    locale: 'en-US',
    indianSubUnitLabel: '$M',
  },
};

function sanitizeFx(fxInrPerUsd: number): number {
  return Number.isFinite(fxInrPerUsd) && fxInrPerUsd > 0 ? fxInrPerUsd : DEFAULT_FX_INR_PER_USD;
}

/**
 * Converts a canonical ₹ Cr monetary value to the selected display unit.
 * 1 Cr INR = 100 Lakh INR = (10 / fxInrPerUsd) USD Millions.
 */
export function fromCr(
  crValue: number,
  unit: CurrencyUnit,
  fxInrPerUsd = DEFAULT_FX_INR_PER_USD
): number {
  if (!Number.isFinite(crValue)) return crValue;
  if (unit === 'INR_CR') return crValue;
  if (unit === 'INR_LAKH') return crValue * 100;
  return (crValue * 10) / sanitizeFx(fxInrPerUsd);
}

/**
 * Converts a user-entered value in the selected display unit back to canonical ₹ Cr.
 */
export function toCr(
  displayValue: number,
  unit: CurrencyUnit,
  fxInrPerUsd = DEFAULT_FX_INR_PER_USD
): number {
  if (!Number.isFinite(displayValue)) return displayValue;
  if (unit === 'INR_CR') return displayValue;
  if (unit === 'INR_LAKH') return displayValue / 100;
  return (displayValue * sanitizeFx(fxInrPerUsd)) / 10;
}

export function formatInputValue(displayValue: number): string {
  if (!Number.isFinite(displayValue)) return '';
  if (Math.abs(displayValue) < 1e-9) return '0';
  return String(Number(displayValue.toFixed(4)));
}

export function formatNumber(
  value: number | null | undefined,
  maxDecimals = 1,
  locale = 'en-IN'
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '-';
  }
  const rounded = Math.abs(value) < 1e-9 ? 0 : value;
  return rounded.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}

/**
 * Formats a canonical ₹ Cr value in the target currency unit.
 */
export function formatMoney(
  crValue: number | null | undefined,
  unit: CurrencyUnit = 'INR_CR',
  maxDecimals?: number,
  fxInrPerUsd = DEFAULT_FX_INR_PER_USD
): string {
  if (crValue === null || crValue === undefined || !Number.isFinite(crValue)) {
    return '-';
  }
  const displayValue = fromCr(crValue, unit, fxInrPerUsd);
  const meta = UNIT_METADATA[unit];
  const absVal = Math.abs(displayValue);
  const decimals =
    maxDecimals !== undefined
      ? maxDecimals
      : absVal >= 100 && Math.abs(absVal - Math.round(absVal)) < 0.05
        ? 0
        : absVal < 1 && absVal > 0
          ? 2
          : 1;
  const sign = displayValue < 0 ? '-' : '';
  const formatted = formatNumber(absVal, decimals, meta.locale);
  return `${sign}${meta.symbol}${formatted}${meta.suffix}`;
}

/**
 * Formats a canonical monthly ₹ Cr/mo value in the target currency unit.
 */
export function formatMonthlyMoney(
  monthlyCrValue: number | null | undefined,
  unit: CurrencyUnit = 'INR_CR',
  fxInrPerUsd = DEFAULT_FX_INR_PER_USD
): string {
  if (
    monthlyCrValue === null ||
    monthlyCrValue === undefined ||
    !Number.isFinite(monthlyCrValue)
  ) {
    return '-';
  }
  const monthlyInUnit = fromCr(monthlyCrValue, unit, fxInrPerUsd);
  if (unit === 'INR_CR') {
    if (monthlyInUnit > 0 && monthlyInUnit < 1) {
      const lakhs = monthlyInUnit * 100;
      return `₹${formatNumber(lakhs, 1, 'en-IN')} Lakh/mo (₹${formatNumber(monthlyInUnit, 2, 'en-IN')} Cr/mo)`;
    }
    return `${formatMoney(monthlyCrValue, 'INR_CR', 2, fxInrPerUsd)}/mo`;
  }
  if (unit === 'USD_M') {
    if (monthlyInUnit > 0 && monthlyInUnit < 1) {
      const thousands = monthlyInUnit * 1000;
      return `$${formatNumber(thousands, 0, 'en-US')}K/mo ($${formatNumber(monthlyInUnit, 2, 'en-US')}M/mo)`;
    }
    return `${formatMoney(monthlyCrValue, 'USD_M', 2, fxInrPerUsd)}/mo`;
  }
  return `${formatMoney(monthlyCrValue, unit, 1, fxInrPerUsd)}/mo`;
}

export function formatMultiple(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '-';
  }
  return `${formatNumber(value, decimals, 'en-US')}x`;
}

export function formatPercent(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '-';
  }
  return `${formatNumber(value, decimals, 'en-US')}%`;
}

/**
 * Losslessly converts a monetary amount between any two display units via canonical ₹ Cr.
 */
export function convertUnitScale(
  value: number,
  fromUnit: CurrencyUnit,
  toUnit: CurrencyUnit,
  fxInrPerUsd = DEFAULT_FX_INR_PER_USD
): number {
  if (fromUnit === toUnit) return value;
  return fromCr(toCr(value, fromUnit, fxInrPerUsd), toUnit, fxInrPerUsd);
}
