const { SUPPORTED_CURRENCIES } = require('../config');

const cache = new Map();
const FX_CACHE_MS = 30 * 60_000;

function validateCurrency(currency) {
  const normalized = String(currency || 'USD').toUpperCase();
  if (!SUPPORTED_CURRENCIES.includes(normalized)) {
    throw new Error(`Unsupported currency: ${normalized}`);
  }
  return normalized;
}

async function usdRate(currency) {
  const quote = validateCurrency(currency);
  if (quote === 'USD') return 1;

  const cached = cache.get(quote);
  if (cached && Date.now() - cached.fetchedAt < FX_CACHE_MS) {
    return cached.rate;
  }

  const response = await fetch(`https://api.frankfurter.dev/v2/rate/USD/${quote}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'GoldSpotDiscordBot/1.0' },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`FX API returned HTTP ${response.status}`);
  }

  const data = await response.json();
  const rate = Number(data.rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('FX API returned an invalid rate');
  }

  cache.set(quote, { rate, fetchedAt: Date.now() });
  return rate;
}

async function convertUsd(amount, currency) {
  return Number(amount) * (await usdRate(currency));
}

module.exports = { validateCurrency, usdRate, convertUsd };
