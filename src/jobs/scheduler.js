const { ActivityType } = require('discord.js');
const {
  ALERT_CHECK_SECONDS,
  DEFAULT_CURRENCY,
  PRICE_SAMPLE_MINUTES,
  STATUS_REFRESH_MINUTES,
} = require('../config');
const {
  advanceGuildSchedule,
  getActiveAlerts,
  getAppSetting,
  getDueGuildSchedules,
  markAlertTriggered,
  prunePriceHistory,
  recordPriceSample,
} = require('../db');
const { fetchMetalUsd } = require('../services/metals');
const { getQuote } = require('../services/quotes');
const { scheduledMetalsEmbed, money, compactMoney } = require('../ui/embeds');

let sampling = false;
let alertsRunning = false;
let postsRunning = false;
let statusRunning = false;

async function samplePrices() {
  if (sampling) return;
  sampling = true;
  try {
    const [gold, silver] = await Promise.all([
      fetchMetalUsd('gold', { bypassCache: true }),
      fetchMetalUsd('silver', { bypassCache: true }),
    ]);
    recordPriceSample('gold', gold.usdPrice);
    recordPriceSample('silver', silver.usdPrice);
    prunePriceHistory();
  } catch (error) {
    console.error('[sampler]', error.message);
  } finally {
    sampling = false;
  }
}

async function checkAlerts(client) {
  if (alertsRunning) return;
  alertsRunning = true;
  try {
    const alerts = getActiveAlerts();
    if (!alerts.length) return;

    const quoteCache = new Map();
    for (const alert of alerts) {
      const key = `${alert.metal}:${alert.currency}`;
      if (!quoteCache.has(key)) {
        quoteCache.set(key, await getQuote(alert.metal, alert.currency));
      }
      const quote = quoteCache.get(key);
      const crossed = alert.direction === 'above'
        ? quote.pricePerOz >= alert.threshold
        : quote.pricePerOz <= alert.threshold;

      if (!crossed) continue;

      markAlertTriggered(alert.id);
      try {
        const user = await client.users.fetch(alert.user_id);
        const directionText = alert.direction === 'above' ? 'at or above' : 'at or below';
        await user.send(
          `🔔 **${quote.name} price alert #${alert.id}**\n` +
          `${quote.symbol}/${alert.currency} is now **${money(quote.pricePerOz, alert.currency)} / troy oz**, ` +
          `${directionText} your ${money(alert.threshold, alert.currency)} threshold.`,
        );
      } catch (error) {
        console.error(`[alerts] Alert ${alert.id} triggered, but DM failed:`, error.message);
      }
    }
  } catch (error) {
    console.error('[alerts]', error.message);
  } finally {
    alertsRunning = false;
  }
}

async function postScheduledUpdates(client) {
  if (postsRunning) return;
  postsRunning = true;
  try {
    for (const setting of getDueGuildSchedules()) {
      advanceGuildSchedule(setting.guild_id, setting.interval_minutes);
      try {
        const channel = await client.channels.fetch(setting.channel_id);
        if (!channel?.isTextBased()) throw new Error('Configured channel is not text-based or no longer exists');
        const [gold, silver] = await Promise.all([
          getQuote('gold', setting.currency),
          getQuote('silver', setting.currency),
        ]);
        await channel.send({ embeds: [scheduledMetalsEmbed(gold, silver)] });
      } catch (error) {
        console.error(`[scheduled-posts] Guild ${setting.guild_id}:`, error.message);
      }
    }
  } finally {
    postsRunning = false;
  }
}

async function refreshStatus(client) {
  if (statusRunning) return;
  statusRunning = true;
  try {
    const enabled = getAppSetting('gold_status_enabled', 'false') === 'true';
    if (!enabled) {
      client.user.setPresence({ activities: [], status: 'online' });
      return;
    }

    const currency = getAppSetting('gold_status_currency', DEFAULT_CURRENCY);
    const quote = await getQuote('gold', currency);
    client.user.setActivity(`Gold ${compactMoney(quote.pricePerOz, currency)}/oz`, {
      type: ActivityType.Watching,
    });
  } catch (error) {
    console.error('[status]', error.message);
  } finally {
    statusRunning = false;
  }
}

function startScheduler(client) {
  samplePrices();
  refreshStatus(client);
  checkAlerts(client);
  postScheduledUpdates(client);

  const sampleTimer = setInterval(samplePrices, PRICE_SAMPLE_MINUTES * 60_000);
  const alertTimer = setInterval(() => checkAlerts(client), ALERT_CHECK_SECONDS * 1000);
  const postTimer = setInterval(() => postScheduledUpdates(client), 60_000);
  const statusTimer = setInterval(() => refreshStatus(client), STATUS_REFRESH_MINUTES * 60_000);

  for (const timer of [sampleTimer, alertTimer, postTimer, statusTimer]) timer.unref?.();
}

module.exports = { startScheduler, refreshStatus };
