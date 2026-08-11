const {
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
} = require('discord.js');
const {
  DEFAULT_CURRENCY,
  DISCORD_TOKEN,
  OWNER_ID,
  REGISTER_COMMANDS_ON_START,
} = require('./config');
const {
  addAlert,
  disableGuildSchedule,
  getAlertForUser,
  getGuildSettings,
  listAlerts,
  removeAlert,
  setAppSetting,
  setGuildSchedule,
} = require('./db');
const {
  GRAMS_PER_TROY_OUNCE,
  getQuote,
  amountToTroyOunces,
  karatToPurity,
} = require('./services/quotes');
const { metalEmbed, metalsEmbed, money } = require('./ui/embeds');
const { startScheduler, refreshStatus } = require('./jobs/scheduler');
const { registerCommands } = require('./register');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function selectedCurrency(interaction) {
  return interaction.options.getString('currency') || DEFAULT_CURRENCY;
}

function unitLabel(unit) {
  return ({
    oz: 'troy oz',
    g: 'g',
    kg: 'kg',
    dwt: 'dwt',
    avdp_oz: 'avoirdupois oz',
    lb: 'lb',
  })[unit] || unit;
}

function number(value, maximumFractionDigits = 4) {
  return value.toLocaleString('en-US', { maximumFractionDigits });
}

function goldValueEmbed({ quote, weight, unit, karat }) {
  const grossTroyOunces = amountToTroyOunces(weight, unit);
  const purity = karatToPurity(karat);
  const fineTroyOunces = grossTroyOunces * purity;
  const fineGrams = fineTroyOunces * GRAMS_PER_TROY_OUNCE;
  const value = fineTroyOunces * quote.pricePerOz;
  const purityPercent = purity * 100;

  return new EmbedBuilder()
    .setTitle(`🟡 ${number(karat, 3)}K Gold Melt / Spot Value`)
    .setDescription(`## ${money(value, quote.currency)}`)
    .addFields(
      { name: 'Item weight', value: `${number(weight, 6)} ${unitLabel(unit)}`, inline: true },
      { name: 'Purity', value: `${number(karat, 3)}K • ${purityPercent.toFixed(2)}%`, inline: true },
      { name: 'Pure gold content', value: `${number(fineGrams, 4)} g\n${number(fineTroyOunces, 6)} troy oz`, inline: true },
      { name: '24K spot price', value: `${money(quote.pricePerOz, quote.currency)} / troy oz`, inline: true },
      { name: '24K spot per gram', value: `${money(quote.pricePerGram, quote.currency)} / g`, inline: true },
      { name: 'Value per item gram', value: `${money(value / (grossTroyOunces * GRAMS_PER_TROY_OUNCE), quote.currency)} / g`, inline: true },
    )
    .setFooter({
      text: 'Estimated intrinsic gold value at spot. Refiners/buyers may pay less; stones, non-gold parts, fees, spreads, and assay differences are not included.',
    })
    .setTimestamp();
}

async function safeErrorReply(interaction, error) {
  console.error(`[command:${interaction.commandName}]`, error);
  const message = '⚠️ I could not retrieve pricing right now. Please try again in a moment.';
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ content: message, embeds: [] }).catch(() => {});
  } else {
    await interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => {});
  }
}

async function handleMetal(interaction, metal) {
  await interaction.deferReply();
  const quote = await getQuote(metal, selectedCurrency(interaction));
  await interaction.editReply({ embeds: [metalEmbed(quote)] });
}

async function handleMetals(interaction) {
  await interaction.deferReply();
  const currency = selectedCurrency(interaction);
  const [gold, silver] = await Promise.all([
    getQuote('gold', currency),
    getQuote('silver', currency),
  ]);
  await interaction.editReply({ embeds: [metalsEmbed(gold, silver)] });
}

async function handleValue(interaction) {
  await interaction.deferReply();
  const metal = interaction.options.getString('metal', true);
  const weight = interaction.options.getNumber('weight', true);
  const unit = interaction.options.getString('unit', true);
  const karat = interaction.options.getNumber('karat');
  const currency = selectedCurrency(interaction);

  if (metal === 'silver' && karat !== null) {
    await interaction.editReply({
      content: 'Karat is a gold-purity measurement. For silver, leave the `karat` option blank.',
      embeds: [],
    });
    return;
  }

  const quote = await getQuote(metal, currency);

  if (metal === 'gold') {
    const effectiveKarat = karat ?? 24;
    await interaction.editReply({ embeds: [goldValueEmbed({ quote, weight, unit, karat: effectiveKarat })] });
    return;
  }

  const troyOunces = amountToTroyOunces(weight, unit);
  const value = troyOunces * quote.pricePerOz;

  const embed = new EmbedBuilder()
    .setTitle(`${quote.emoji} ${quote.name} Spot Value`)
    .setDescription(`## ${money(value, currency)}`)
    .addFields(
      { name: 'Weight', value: `${number(weight, 6)} ${unitLabel(unit)}`, inline: true },
      { name: 'Equivalent', value: `${number(troyOunces, 6)} troy oz`, inline: true },
      { name: 'Spot price', value: `${money(quote.pricePerOz, currency)} / troy oz`, inline: true },
    )
    .setFooter({ text: 'Metal-only spot value; purity, premiums, fees, spreads, taxes, and assay differences are not included.' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleGoldValue(interaction) {
  await interaction.deferReply();
  const weight = interaction.options.getNumber('weight', true);
  const unit = interaction.options.getString('unit', true);
  const karat = interaction.options.getNumber('karat', true);
  const currency = selectedCurrency(interaction);
  const quote = await getQuote('gold', currency);

  await interaction.editReply({ embeds: [goldValueEmbed({ quote, weight, unit, karat })] });
}

async function handleAlert(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'add') {
    const metal = interaction.options.getString('metal', true);
    const direction = interaction.options.getString('direction', true);
    const threshold = interaction.options.getNumber('price', true);
    const currency = interaction.options.getString('currency', true);
    const id = addAlert({
      userId: interaction.user.id,
      guildId: interaction.guildId,
      metal,
      direction,
      threshold,
      currency,
    });
    const directionText = direction === 'above' ? 'at or above' : 'at or below';
    await interaction.reply({
      content: `🔔 Alert **#${id}** created. I’ll DM you when ${metal} is ${directionText} **${money(threshold, currency)} / troy oz**. This is a one-shot alert.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === 'list') {
    const alerts = listAlerts(interaction.user.id);
    const content = alerts.length
      ? alerts.map((a) => `**#${a.id}** • ${a.metal} • ${a.direction === 'above' ? '≥' : '≤'} ${money(a.threshold, a.currency)}/oz`).join('\n')
      : 'You have no active price alerts.';
    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'remove') {
    const id = interaction.options.getInteger('id', true);
    const existing = getAlertForUser(id, interaction.user.id);
    if (!existing) {
      await interaction.reply({ content: `I could not find an active alert #${id} that belongs to you.`, flags: MessageFlags.Ephemeral });
      return;
    }
    removeAlert(id, interaction.user.id);
    await interaction.reply({ content: `🗑️ Removed alert **#${id}**.`, flags: MessageFlags.Ephemeral });
  }
}

async function handlePriceSetup(interaction) {
  if (!interaction.guildId) {
    await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
    return;
  }

  const sub = interaction.options.getSubcommand();
  if (sub === 'enable') {
    const channel = interaction.options.getChannel('channel', true);
    const intervalMinutes = Number(interaction.options.getString('interval', true));
    const currency = interaction.options.getString('currency', true);
    setGuildSchedule({ guildId: interaction.guildId, channelId: channel.id, intervalMinutes, currency });
    await interaction.reply({
      content: `✅ Scheduled metals updates enabled in ${channel} every **${intervalMinutes === 1440 ? '24 hours' : `${intervalMinutes} minutes`}**, using **${currency}**.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === 'disable') {
    disableGuildSchedule(interaction.guildId);
    await interaction.reply({ content: '⏹️ Scheduled metals updates disabled.', flags: MessageFlags.Ephemeral });
    return;
  }

  const settings = getGuildSettings(interaction.guildId);
  if (!settings?.channel_id || !settings.interval_minutes) {
    await interaction.reply({ content: 'Scheduled metals updates are currently disabled.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.reply({
    content: `Scheduled updates: <#${settings.channel_id}> • every **${settings.interval_minutes} minutes** • **${settings.currency}** • next post <t:${Math.floor(settings.next_post_at / 1000)}:R>.`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleGoldStatus(interaction) {
  if (!OWNER_ID) {
    await interaction.reply({
      content: 'Set `OWNER_ID` in `.env` before using `/goldstatus`.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (interaction.user.id !== OWNER_ID) {
    await interaction.reply({ content: 'Only the configured bot owner can change the global bot presence.', flags: MessageFlags.Ephemeral });
    return;
  }

  const enabled = interaction.options.getBoolean('enabled', true);
  const currency = selectedCurrency(interaction);
  setAppSetting('gold_status_enabled', enabled ? 'true' : 'false');
  setAppSetting('gold_status_currency', currency);
  await refreshStatus(client);
  await interaction.reply({
    content: enabled
      ? `✅ Live gold-price bot status enabled in **${currency}**.`
      : '⏹️ Live gold-price bot status disabled.',
    flags: MessageFlags.Ephemeral,
  });
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);

  if (REGISTER_COMMANDS_ON_START) {
    try {
      await registerCommands();
    } catch (error) {
      console.error('[command-registration]', error);
    }
  }

  startScheduler(readyClient);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    switch (interaction.commandName) {
      case 'gold': await handleMetal(interaction, 'gold'); break;
      case 'silver': await handleMetal(interaction, 'silver'); break;
      case 'metals': await handleMetals(interaction); break;
      case 'value': await handleValue(interaction); break;
      case 'goldvalue': await handleGoldValue(interaction); break;
      case 'alert': await handleAlert(interaction); break;
      case 'pricesetup': await handlePriceSetup(interaction); break;
      case 'goldstatus': await handleGoldStatus(interaction); break;
      default: break;
    }
  } catch (error) {
    await safeErrorReply(interaction, error);
  }
});

process.on('unhandledRejection', (error) => console.error('[unhandledRejection]', error));
process.on('uncaughtException', (error) => console.error('[uncaughtException]', error));

client.login(DISCORD_TOKEN());
