/**
 * Centralized formatting utilities for OfficeERP
 */

export interface CurrencyFormatOptions {
  currency?: string;
  currencySymbol?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

/**
 * Formats monetary amounts using company currency configuration and proper locale standards.
 * Supports INR (Indian Numbering System e.g. ₹18,00,000), USD, EUR, GBP, etc.
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = 'INR',
  currencySymbol?: string
): string {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount || 0);

  if (isNaN(numericAmount)) {
    return currencySymbol ? `${currencySymbol}0` : '₹0';
  }

  const cleanCurrency = (currency || 'INR').toUpperCase().trim();

  try {
    let locale = 'en-US';
    if (cleanCurrency === 'INR') {
      locale = 'en-IN';
    } else if (cleanCurrency === 'EUR') {
      locale = 'de-DE';
    } else if (cleanCurrency === 'GBP') {
      locale = 'en-GB';
    }

    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: cleanCurrency,
      maximumFractionDigits: numericAmount % 1 === 0 ? 0 : 2,
      minimumFractionDigits: 0,
    });

    return formatter.format(numericAmount);
  } catch (err) {
    // Fallback if currency code is not supported by Intl
    const symbol = currencySymbol || (cleanCurrency === 'INR' ? '₹' : '$');
    return `${symbol}${numericAmount.toLocaleString('en-IN')}`;
  }
}

/**
 * Formats ISO dates into clean readable calendar strings (e.g. 2026-01-06 -> Jan 06, 2026 or YYYY-MM-DD)
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return String(dateStr);
  }
}

/**
 * Extracts clean user initials (e.g. Jeba Prakash -> JP, Arun Raj -> AR)
 */
export function getInitials(firstName?: string, lastName?: string): string {
  const first = (firstName || '').trim().charAt(0).toUpperCase();
  const last = (lastName || '').trim().charAt(0).toUpperCase();
  return (first + last) || 'E';
}
