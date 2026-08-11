const { fetchMetalUsd } = require('./metals');
const { usdRate, validateCurrency } = require('./currency');
const { getOneHourAgoSample } = require('../db');

const GRAMS_PER_TROY_OUNCE = 31.1034768;
const GRAMS_PER_AVOIRDUPOIS_POUND = 453.59237;
const GRAMS_PER_AVOIRDUPOIS_OUNCE = 28.349523125;
const GRAMS_PER_PENNYWEIGHT = 1.55517384;

async function getQuote(metal, currency = 'USD') {
  const normalizedCurrency = validateCurrency(currency);
  const [metalQuote, rate] = await Promise.all([
    fetchMetalUsd(metal),
    usdRate(normalizedCurrency),
  ]);

  const pricePerOz = metalQuote.usdPrice * rate;
  const previous = getOneHourAgoSample(metal);
  const previousPricePerOz = previous ? previous.usd_price * rate : null;

  let change = null;
  if (previousPricePerOz && previousPricePerOz > 0) {
    const amount = pricePerOz - previousPricePerOz;
    change = {
      amount,
      percent: (amount / previousPricePerOz) * 100,
      sampledAt: previous.sampled_at,
    };
  }

  return {
    ...metalQuote,
    currency: normalizedCurrency,
    rate,
    pricePerOz,
    pricePerGram: pricePerOz / GRAMS_PER_TROY_OUNCE,
    pricePer10Gram: (pricePerOz / GRAMS_PER_TROY_OUNCE) * 10,
    pricePerKg: (pricePerOz / GRAMS_PER_TROY_OUNCE) * 1000,
    change,
  };
}

function karatToPurity(karat) {
  const value = Number(karat);
  if (!Number.isFinite(value) || value <= 0 || value > 24) {
    throw new Error('Karat must be greater than 0 and no more than 24');
  }
  return value / 24;
}

function amountToTroyOunces(amount, unit) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw new Error('Amount must be greater than zero');

  switch (unit) {
    case 'oz': return value;
    case 'g': return value / GRAMS_PER_TROY_OUNCE;
    case 'kg': return (value * 1000) / GRAMS_PER_TROY_OUNCE;
    case 'dwt': return (value * GRAMS_PER_PENNYWEIGHT) / GRAMS_PER_TROY_OUNCE;
    case 'avdp_oz': return (value * GRAMS_PER_AVOIRDUPOIS_OUNCE) / GRAMS_PER_TROY_OUNCE;
    case 'lb': return (value * GRAMS_PER_AVOIRDUPOIS_POUND) / GRAMS_PER_TROY_OUNCE;
    default: throw new Error(`Unsupported unit: ${unit}`);
  }
}

module.exports = {
  GRAMS_PER_TROY_OUNCE,
  GRAMS_PER_PENNYWEIGHT,
  GRAMS_PER_AVOIRDUPOIS_OUNCE,
  GRAMS_PER_AVOIRDUPOIS_POUND,
  getQuote,
  karatToPurity,
  amountToTroyOunces,
};
