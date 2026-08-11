const {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js');
const { SUPPORTED_CURRENCIES } = require('./config');

const currencyChoices = SUPPORTED_CURRENCIES.map((c) => ({ name: c, value: c }));

function currencyOption(option, required = false) {
  return option
    .setName('currency')
    .setDescription('Display currency')
    .setRequired(required)
    .addChoices(...currencyChoices);
}

const commands = [
  new SlashCommandBuilder()
    .setName('gold')
    .setDescription('Show the current gold spot price')
    .addStringOption((o) => currencyOption(o)),

  new SlashCommandBuilder()
    .setName('silver')
    .setDescription('Show the current silver spot price')
    .addStringOption((o) => currencyOption(o)),

  new SlashCommandBuilder()
    .setName('metals')
    .setDescription('Show gold and silver spot prices together')
    .addStringOption((o) => currencyOption(o)),

  new SlashCommandBuilder()
    .setName('value')
    .setDescription('Calculate metal spot value, including gold karat/purity')
    .addStringOption((o) => o
      .setName('metal')
      .setDescription('Metal')
      .setRequired(true)
      .addChoices(
        { name: 'Gold', value: 'gold' },
        { name: 'Silver', value: 'silver' },
      ))
    .addNumberOption((o) => o
      .setName('weight')
      .setDescription('Item weight (decimals allowed, e.g. 12.5)')
      .setRequired(true)
      .setMinValue(0.0001))
    .addStringOption((o) => o
      .setName('unit')
      .setDescription('Weight unit')
      .setRequired(true)
      .addChoices(
        { name: 'Gram (g)', value: 'g' },
        { name: 'Pennyweight (dwt)', value: 'dwt' },
        { name: 'Troy ounce (oz t)', value: 'oz' },
        { name: 'Avoirdupois ounce (oz)', value: 'avdp_oz' },
        { name: 'Kilogram (kg)', value: 'kg' },
        { name: 'Pound (lb)', value: 'lb' },
      ))
    .addNumberOption((o) => o
      .setName('karat')
      .setDescription('Gold purity in karats, 1–24 (e.g. 10, 14, 18, 22, 24)')
      .setMinValue(1)
      .setMaxValue(24))
    .addStringOption((o) => currencyOption(o)),

  new SlashCommandBuilder()
    .setName('goldvalue')
    .setDescription('Calculate gold melt/spot value from weight and karat')
    .addNumberOption((o) => o
      .setName('weight')
      .setDescription('Item weight (decimals allowed, e.g. 12.5)')
      .setRequired(true)
      .setMinValue(0.0001))
    .addStringOption((o) => o
      .setName('unit')
      .setDescription('Weight unit')
      .setRequired(true)
      .addChoices(
        { name: 'Gram (g)', value: 'g' },
        { name: 'Pennyweight (dwt)', value: 'dwt' },
        { name: 'Troy ounce (oz t)', value: 'oz' },
        { name: 'Avoirdupois ounce (oz)', value: 'avdp_oz' },
        { name: 'Kilogram (kg)', value: 'kg' },
        { name: 'Pound (lb)', value: 'lb' },
      ))
    .addNumberOption((o) => o
      .setName('karat')
      .setDescription('Gold purity in karats, 1–24 (e.g. 10, 14, 18, 22, 24)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(24))
    .addStringOption((o) => currencyOption(o)),

  new SlashCommandBuilder()
    .setName('alert')
    .setDescription('Create and manage personal metal price alerts')
    .addSubcommand((s) => s
      .setName('add')
      .setDescription('DM you when a metal crosses a spot-price threshold')
      .addStringOption((o) => o
        .setName('metal')
        .setDescription('Metal')
        .setRequired(true)
        .addChoices(
          { name: 'Gold', value: 'gold' },
          { name: 'Silver', value: 'silver' },
        ))
      .addStringOption((o) => o
        .setName('direction')
        .setDescription('Trigger when price moves above or below the threshold')
        .setRequired(true)
        .addChoices(
          { name: 'At or above', value: 'above' },
          { name: 'At or below', value: 'below' },
        ))
      .addNumberOption((o) => o
        .setName('price')
        .setDescription('Threshold per troy ounce')
        .setRequired(true)
        .setMinValue(0.01))
      .addStringOption((o) => currencyOption(o, true)))
    .addSubcommand((s) => s
      .setName('list')
      .setDescription('List your active alerts'))
    .addSubcommand((s) => s
      .setName('remove')
      .setDescription('Remove one of your alerts')
      .addIntegerOption((o) => o
        .setName('id')
        .setDescription('Alert ID from /alert list')
        .setRequired(true)
        .setMinValue(1))),

  new SlashCommandBuilder()
    .setName('pricesetup')
    .setDescription('Configure automatic metals posts for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s
      .setName('enable')
      .setDescription('Enable scheduled gold and silver posts')
      .addChannelOption((o) => o
        .setName('channel')
        .setDescription('Channel to receive scheduled updates')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
      .addStringOption((o) => o
        .setName('interval')
        .setDescription('How often to post')
        .setRequired(true)
        .addChoices(
          { name: 'Every 15 minutes', value: '15' },
          { name: 'Every 30 minutes', value: '30' },
          { name: 'Every hour', value: '60' },
          { name: 'Every 3 hours', value: '180' },
          { name: 'Every 6 hours', value: '360' },
          { name: 'Every 12 hours', value: '720' },
          { name: 'Every 24 hours', value: '1440' },
        ))
      .addStringOption((o) => currencyOption(o, true)))
    .addSubcommand((s) => s
      .setName('disable')
      .setDescription('Disable scheduled metals posts'))
    .addSubcommand((s) => s
      .setName('show')
      .setDescription('Show the current scheduled-post settings')),

  new SlashCommandBuilder()
    .setName('goldstatus')
    .setDescription('Owner-only: show gold spot price in the bot presence')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addBooleanOption((o) => o
      .setName('enabled')
      .setDescription('Enable or disable live gold-price presence')
      .setRequired(true))
    .addStringOption((o) => currencyOption(o)),
];

module.exports = { commands };
