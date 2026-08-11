const fs = require('node:fs');
const path = require('node:path');

// Load a local .env file when present. Hosted platforms such as Railway inject
// environment variables directly, so a .env file is not required in production.
const localEnvPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(localEnvPath) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(localEnvPath);
}

const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD'];
const DEFAULT_CURRENCY = (process.env.DEFAULT_CURRENCY || 'USD').toUpperCase();

function intEnv(name, fallback, min = 1) {
  const raw = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(raw) && raw >= min ? raw : fallback;
}

function boolEnv(name, fallback = false) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const defaultDbPath = path.join(__dirname, '..', 'data', 'goldbot.sqlite');
const railwayDbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'goldbot.sqlite')
  : null;

module.exports = {
  DISCORD_TOKEN: () => requireEnv('DISCORD_TOKEN'),
  CLIENT_ID: () => requireEnv('CLIENT_ID'),
  GUILD_ID: process.env.GUILD_ID || null,
  OWNER_ID: process.env.OWNER_ID || null,
  DEFAULT_CURRENCY: SUPPORTED_CURRENCIES.includes(DEFAULT_CURRENCY) ? DEFAULT_CURRENCY : 'USD',
  SUPPORTED_CURRENCIES,
  STATUS_REFRESH_MINUTES: intEnv('STATUS_REFRESH_MINUTES', 5),
  ALERT_CHECK_SECONDS: intEnv('ALERT_CHECK_SECONDS', 60, 30),
  PRICE_SAMPLE_MINUTES: intEnv('PRICE_SAMPLE_MINUTES', 5),
  REGISTER_COMMANDS_ON_START: boolEnv('REGISTER_COMMANDS_ON_START', true),
  DB_PATH: process.env.DB_PATH || railwayDbPath || defaultDbPath,
};
