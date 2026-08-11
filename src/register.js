const { REST, Routes } = require('discord.js');
const { commands } = require('./commands');
const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = require('./config');

async function registerCommands({ forceGlobal = false, clearGuild = false } = {}) {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN());
  const body = commands.map((command) => command.toJSON());

  if (clearGuild) {
    if (!GUILD_ID) throw new Error('Set GUILD_ID before clearing guild commands');
    console.log(`Removing guild-specific commands from ${GUILD_ID}...`);
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID(), GUILD_ID), { body: [] });
    console.log('Guild-specific commands cleared.');
    return;
  }

  if (GUILD_ID && !forceGlobal) {
    console.log(`Registering ${body.length} guild commands in ${GUILD_ID}...`);
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID(), GUILD_ID), { body });
    console.log('Guild commands registered. Guild commands update immediately.');
    return;
  }

  console.log(`Registering ${body.length} global commands...`);
  await rest.put(Routes.applicationCommands(CLIENT_ID()), { body });
  console.log('Global commands registered.');
}

module.exports = { registerCommands };
