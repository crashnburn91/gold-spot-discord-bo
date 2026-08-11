const { registerCommands } = require('./register');

async function main() {
  await registerCommands({
    forceGlobal: process.argv.includes('--global'),
    clearGuild: process.argv.includes('--clear-guild'),
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
