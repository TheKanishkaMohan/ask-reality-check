import type { CurrencyUnit } from './types';

export interface UnitMetadata {
  id: CurrencyUnit;
  label: string;
  shortUnit: string;
  symbol: string;
  suffix: string;
  locale: string;
  /** Factor relative to ₹ Cr when converting preset/input values across Indian units, or 1 for manual unit switch */
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

export function formatMoney(
  value: number | null | undefined,
  unit: CurrencyUnit = 'INR_CR',
  maxDecimals?: number
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '-';
  }
  const meta = UNIT_METADATA[unit];
  const absVal = Math.abs(value);
  const decimals =
    maxDecimals !== undefined
      ? maxDecimals
      : absVal >= 100 && Math.abs(absVal - Math.round(absVal)) < 0.05
        ? 0
        : absVal < 1 && absVal > 0
          ? 2
          : 1;
  const sign = value < 0 ? '-' : '';
  const formatted = formatNumber(absVal, decimals, meta.locale);
  return `${sign}${meta.symbol}${formatted}${meta.suffix}`;
}

/**
 * Formats monthly revenue concisely: in INR_CR mode, ₹0.75 Cr/mo is also "₹75 Lakh/mo"
 */
export function formatMonthlyMoney(
  monthlyValueInUnit: number | null | undefined,
  unit: CurrencyUnit = 'INR_CR'
): string {
  if (
    monthlyValueInUnit === null ||
    monthlyValueInUnit === undefined ||
    !Number.isFinite(monthlyValueInUnit)
  ) {
    return '-';
  }
  if (unit === 'INR_CR') {
    if (monthlyValueInUnit > 0 && monthlyValueInUnit < 1) {
      const lakhs = monthlyValueInUnit * 100;
      return `₹${formatNumber(lakhs, 1, 'en-IN')} Lakh/mo (₹${formatNumber(monthlyValueInUnit, 2, 'en-IN')} Cr/mo)`;
    }
    return `${formatMoney(monthlyValueInUnit, 'INR_CR', 2)}/mo`;
  }
  if (unit === 'USD_M') {
    if (monthlyValueInUnit > 0 && monthlyValueInUnit < 1) {
      const thousands = monthlyValueInUnit * 1000;
      return `$${formatNumber(thousands, 0, 'en-US')}K/mo ($${formatNumber(monthlyValueInUnit, 2, 'en-US')}M/mo)`;
    }
    return `${formatMoney(monthlyValueInUnit, 'USD_M', 2)}/mo`;
  }
  return `${formatMoney(monthlyValueInUnit, unit, 1)}/mo`;
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
 * Converts a monetary amount between INR_CR and INR_LAKH if switching between Indian scale units,
 * or keeps numerical magnitude when switching to USD_M (with optional explicit scale factor).
 */
export function convertUnitScale(
  value: number,
  fromUnit: CurrencyUnit,
  toUnit: CurrencyUnit
): number {
  if (fromUnit === toUnit) return value;
  if (fromUnit === 'INR_CR' && toUnit === 'INR_LAKH') return Number((value * 100).toFixed(4));
  if (fromUnit === 'INR_LAKH' && toUnit === 'INR_CR') return Number((value / 100).toFixed(4));
  return value;
}
