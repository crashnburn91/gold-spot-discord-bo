const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { DB_PATH } = require('./config');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH, { timeout: 5000 });

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    guild_id TEXT,
    metal TEXT NOT NULL CHECK (metal IN ('gold', 'silver')),
    direction TEXT NOT NULL CHECK (direction IN ('above', 'below')),
    threshold REAL NOT NULL CHECK (threshold > 0),
    currency TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    triggered_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(active);
  CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id, active);

  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    channel_id TEXT,
    interval_minutes INTEGER,
    currency TEXT NOT NULL DEFAULT 'USD',
    next_post_at INTEGER,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metal TEXT NOT NULL CHECK (metal IN ('gold', 'silver')),
    usd_price REAL NOT NULL,
    sampled_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_price_history_lookup
    ON price_history(metal, sampled_at DESC);
`);

const q = {
  addAlert: db.prepare(`
    INSERT INTO alerts (user_id, guild_id, metal, direction, threshold, currency, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `),
  listAlerts: db.prepare(`
    SELECT * FROM alerts WHERE user_id = ? AND active = 1 ORDER BY created_at DESC
  `),
  getAlertForUser: db.prepare(`
    SELECT * FROM alerts WHERE id = ? AND user_id = ? AND active = 1
  `),
  removeAlert: db.prepare(`
    UPDATE alerts SET active = 0 WHERE id = ? AND user_id = ? AND active = 1
  `),
  activeAlerts: db.prepare(`SELECT * FROM alerts WHERE active = 1 ORDER BY id`),
  triggerAlert: db.prepare(`
    UPDATE alerts SET active = 0, triggered_at = ? WHERE id = ? AND active = 1
  `),
  upsertGuild: db.prepare(`
    INSERT INTO guild_settings (guild_id, channel_id, interval_minutes, currency, next_post_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET
      channel_id = excluded.channel_id,
      interval_minutes = excluded.interval_minutes,
      currency = excluded.currency,
      next_post_at = excluded.next_post_at,
      updated_at = excluded.updated_at
  `),
  getGuild: db.prepare(`SELECT * FROM guild_settings WHERE guild_id = ?`),
  disableGuild: db.prepare(`
    UPDATE guild_settings
    SET channel_id = NULL, interval_minutes = NULL, next_post_at = NULL, updated_at = ?
    WHERE guild_id = ?
  `),
  dueGuilds: db.prepare(`
    SELECT * FROM guild_settings
    WHERE channel_id IS NOT NULL
      AND interval_minutes IS NOT NULL
      AND next_post_at IS NOT NULL
      AND next_post_at <= ?
  `),
  updateNextPost: db.prepare(`
    UPDATE guild_settings SET next_post_at = ?, updated_at = ? WHERE guild_id = ?
  `),
  getAppSetting: db.prepare(`SELECT value FROM app_settings WHERE key = ?`),
  setAppSetting: db.prepare(`
    INSERT INTO app_settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `),
  insertPrice: db.prepare(`
    INSERT INTO price_history (metal, usd_price, sampled_at) VALUES (?, ?, ?)
  `),
  historyNear: db.prepare(`
    SELECT * FROM price_history
    WHERE metal = ? AND sampled_at BETWEEN ? AND ?
    ORDER BY ABS(sampled_at - ?) ASC
    LIMIT 1
  `),
  pruneHistory: db.prepare(`DELETE FROM price_history WHERE sampled_at < ?`),
};

function addAlert({ userId, guildId, metal, direction, threshold, currency }) {
  const result = q.addAlert.run(userId, guildId || null, metal, direction, threshold, currency, Date.now());
  return Number(result.lastInsertRowid);
}

function listAlerts(userId) {
  return q.listAlerts.all(userId);
}

function getAlertForUser(id, userId) {
  return q.getAlertForUser.get(id, userId);
}

function removeAlert(id, userId) {
  return q.removeAlert.run(id, userId).changes > 0;
}

function getActiveAlerts() {
  return q.activeAlerts.all();
}

function markAlertTriggered(id) {
  q.triggerAlert.run(Date.now(), id);
}

function setGuildSchedule({ guildId, channelId, intervalMinutes, currency }) {
  const now = Date.now();
  q.upsertGuild.run(
    guildId,
    channelId,
    intervalMinutes,
    currency,
    now + intervalMinutes * 60_000,
    now,
  );
}

function getGuildSettings(guildId) {
  return q.getGuild.get(guildId);
}

function disableGuildSchedule(guildId) {
  q.disableGuild.run(Date.now(), guildId);
}

function getDueGuildSchedules() {
  return q.dueGuilds.all(Date.now());
}

function advanceGuildSchedule(guildId, intervalMinutes) {
  const now = Date.now();
  q.updateNextPost.run(now + intervalMinutes * 60_000, now, guildId);
}

function getAppSetting(key, fallback = null) {
  return q.getAppSetting.get(key)?.value ?? fallback;
}

function setAppSetting(key, value) {
  q.setAppSetting.run(key, String(value));
}

function recordPriceSample(metal, usdPrice) {
  q.insertPrice.run(metal, usdPrice, Date.now());
}

function getOneHourAgoSample(metal) {
  const target = Date.now() - 60 * 60_000;
  const min = target - 15 * 60_000;
  const max = target + 15 * 60_000;
  return q.historyNear.get(metal, min, max, target) || null;
}

function prunePriceHistory() {
  q.pruneHistory.run(Date.now() - 48 * 60 * 60_000);
}

module.exports = {
  addAlert,
  listAlerts,
  getAlertForUser,
  removeAlert,
  getActiveAlerts,
  markAlertTriggered,
  setGuildSchedule,
  getGuildSettings,
  disableGuildSchedule,
  getDueGuildSchedules,
  advanceGuildSchedule,
  getAppSetting,
  setAppSetting,
  recordPriceSample,
  getOneHourAgoSample,
  prunePriceHistory,
};
