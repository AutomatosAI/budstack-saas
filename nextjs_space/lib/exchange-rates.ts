/**
 * Exchange Rate Service
 *
 * Dr Green API returns all prices in EUR regardless of countryCode param.
 * This module converts EUR → tenant's local currency using live exchange rates
 * from api.exchangerate-api.com (free, no key required).
 *
 * Matches the approach used in the HealingBudStacks template
 * (supabase/functions/exchange-rates + src/lib/currency.ts).
 */

import { logger } from "@/lib/logger";

// In-memory cache
let cachedRates: Record<string, number> | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

// Fallback rates (EUR as base = 1.0) — approximate as of March 2026
const FALLBACK_RATES: Record<string, number> = {
  EUR: 1,
  ZAR: 19.27,
  GBP: 0.84,
  USD: 1.08,
  CAD: 1.47,
  AUD: 1.66,
  NZD: 1.80,
  CHF: 0.96,
  SEK: 11.20,
  NOK: 11.50,
  DKK: 7.46,
  PLN: 4.30,
  CZK: 25.20,
  THB: 37.50,
  BRL: 5.40,
  SAR: 4.05,
  MYR: 4.80,
  SGD: 1.45,
  INR: 90.50,
  JPY: 162.0,
  KRW: 1450.0,
  CNY: 7.80,
  HKD: 8.45,
  ILS: 3.95,
  PKR: 300.0,
  PHP: 61.0,
  IDR: 17200.0,
  TWD: 34.5,
  MXN: 18.5,
  ARS: 950.0,
  CLP: 1020.0,
  COP: 4300.0,
};

async function fetchLiveRates(): Promise<Record<string, number>> {
  try {
    // exchangerate-api.com free tier — EUR as base
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/EUR', {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Exchange rate API: ${response.status}`);
    }

    const data = await response.json();
    return data.rates as Record<string, number>;
  } catch (error) {
    console.warn('[Exchange Rates] Failed to fetch live rates, using fallback:', error instanceof Error ? error.message : error);
    return FALLBACK_RATES;
  }
}

async function getRates(): Promise<Record<string, number>> {
  const now = Date.now();
  if (cachedRates && (now - cacheTimestamp) < CACHE_DURATION_MS) {
    return cachedRates;
  }

  const rates = await fetchLiveRates();
  cachedRates = rates;
  cacheTimestamp = now;
  logger.info('[Exchange Rates] Refreshed', { eurToZar: rates.ZAR || 'N/A' });
  return rates;
}

/**
 * Convert an amount from EUR to the target currency.
 * Dr Green API always returns prices in EUR.
 */
export async function convertFromEUR(amount: number, targetCurrency: string): Promise<number> {
  if (!amount || amount <= 0) return 0;

  const target = targetCurrency.toUpperCase();
  if (target === 'EUR') return amount;

  const rates = await getRates();
  const rate = rates[target];

  if (!rate) {
    console.warn(`[Exchange Rates] No rate for ${target}, returning EUR amount`);
    return amount;
  }

  return Math.round(amount * rate * 100) / 100;
}
