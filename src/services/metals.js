const METALS = {
  gold: { symbol: 'XAU', name: 'Gold', emoji: '🟡' },
  silver: { symbol: 'XAG', name: 'Silver', emoji: '⚪' },
};

const CACHE_MS = 15_000;
const cache = new Map();

async function fetchMetalUsd(metal, { bypassCache = false } = {}) {
  const info = METALS[metal];
  if (!info) throw new Error(`Unsupported metal: ${metal}`);

  const cached = cache.get(metal);
  if (!bypassCache && cached && Date.now() - cached.fetchedAt < CACHE_MS) {
    return cached;
  }

  const response = await fetch(`https://api.gold-api.com/price/${info.symbol}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'GoldSpotDiscordBot/1.0' },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Gold API returned HTTP ${response.status}`);
  }

  const data = await response.json();
  const price = Number(data.price);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('Gold API returned an invalid price');
  }

  const quote = {
    metal,
    ...info,
    usdPrice: price,
    fetchedAt: Date.now(),
    sourceUpdatedAt: data.updatedAt || data.updated_at || data.timestamp || null,
  };

  cache.set(metal, quote);
  return quote;
}

module.exports = { METALS, fetchMetalUsd };
