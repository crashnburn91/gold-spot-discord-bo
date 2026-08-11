const { EmbedBuilder } = require('discord.js');

function money(value, currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function compactMoney(value, currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function changeText(change, currency) {
  if (!change) return '1-hour change: collecting history…';
  const up = change.amount >= 0;
  const arrow = up ? '▲' : '▼';
  const sign = up ? '+' : '';
  return `1-hour change: ${arrow} ${sign}${money(change.amount, currency)} (${sign}${change.percent.toFixed(2)}%)`;
}

function metalEmbed(quote) {
  return new EmbedBuilder()
    .setTitle(`${quote.emoji} ${quote.name.toUpperCase()} — ${quote.symbol}/${quote.currency}`)
    .setDescription(`## ${money(quote.pricePerOz, quote.currency)} / troy oz\n${changeText(quote.change, quote.currency)}`)
    .addFields(
      { name: '1 gram', value: money(quote.pricePerGram, quote.currency), inline: true },
      { name: '10 grams', value: money(quote.pricePer10Gram, quote.currency), inline: true },
      { name: '1 kilogram', value: money(quote.pricePerKg, quote.currency), inline: true },
    )
    .setFooter({ text: 'Spot: Gold-API.com • FX: Frankfurter • 1h change uses bot samples' })
    .setTimestamp(new Date(quote.fetchedAt));
}

function metalsEmbed(gold, silver) {
  return new EmbedBuilder()
    .setTitle(`Precious Metals — ${gold.currency}`)
    .addFields(
      {
        name: '🟡 Gold',
        value: `**${money(gold.pricePerOz, gold.currency)} / oz**\n${changeText(gold.change, gold.currency)}`,
      },
      {
        name: '⚪ Silver',
        value: `**${money(silver.pricePerOz, silver.currency)} / oz**\n${changeText(silver.change, silver.currency)}`,
      },
    )
    .setFooter({ text: 'Spot: Gold-API.com • FX: Frankfurter • 1h change uses bot samples' })
    .setTimestamp();
}

function scheduledMetalsEmbed(gold, silver) {
  return metalsEmbed(gold, silver).setTitle(`📈 Scheduled Metals Update — ${gold.currency}`);
}

module.exports = { money, compactMoney, metalEmbed, metalsEmbed, scheduledMetalsEmbed, changeText };
