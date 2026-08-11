# Gold Spot Discord Bot

A small Discord bot for live gold and silver spot pricing.

## Features

- `/gold [currency]` — gold spot price per troy ounce, gram, 10 g, and kilogram
- `/silver [currency]` — silver spot price
- `/metals [currency]` — gold + silver overview
- `/value metal weight unit [karat] [currency]` — calculate spot value by weight; gold can be adjusted for karat/purity
- `/goldvalue weight unit karat [currency]` — quick jewelry/scrap-gold melt-value calculator
- `/alert add|list|remove` — one-shot personal price alerts via Discord DM
- `/pricesetup enable|disable|show` — server-specific scheduled metals posts
- `/goldstatus` — owner-only live gold-price bot presence
- USD, EUR, GBP, and CAD display currencies
- SQLite persistence using Node's built-in `node:sqlite`
- 1-hour change once the bot has collected enough 5-minute price samples

## Requirements

- Node.js **22.13+**. Node 24 LTS or newer is recommended.
- A Discord application/bot.

## 1. Create the Discord bot

1. Open the Discord Developer Portal.
2. Create a new application.
3. Open **Bot** and create/copy the bot token.
4. Copy the application's **Application ID** / Client ID.
5. Install the app into your server with the `bot` and `applications.commands` scopes.
6. Give the bot at least **View Channels**, **Send Messages**, and **Embed Links** where it will post.

No privileged gateway intents are required.

## 2. Configure

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Fill in:

```env
DISCORD_TOKEN=...
CLIENT_ID=...
GUILD_ID=...
OWNER_ID=...
```

### GUILD_ID

During development, set `GUILD_ID` to your server ID. Discord guild commands update immediately.

When you are ready to use global commands, run:

```bash
npm run register:global
```

If you previously registered guild-only development commands, clear those afterward so the test server does not show both guild and global copies:

```bash
npm run clear:guild
```

### OWNER_ID

Set this to your Discord user ID if you want `/goldstatus`. Discord presence belongs to the bot account globally, so only the configured owner is allowed to change it.

## 3. Install and register commands

```bash
npm install
npm run register
```

## 4. Run

```bash
npm start
```

You should see:

```text
Logged in as YourBotName#0000
```

## Commands

### `/gold`

Examples:

```text
/gold
/gold currency:EUR
```

### `/value`

Examples:

```text
/value metal:Gold weight:25 unit:Gram karat:14 currency:USD
/value metal:Gold weight:1 unit:Troy ounce karat:18 currency:USD
/value metal:Silver weight:100 unit:Gram currency:CAD
/value metal:Gold weight:2.5 unit:Pennyweight karat:10 currency:USD
```

For gold, `karat` is optional. If omitted, the bot assumes **24K** so the command remains useful for bullion. Karat can be any numeric value from 1 through 24, including decimals.

Gold value is calculated as:

```text
purity = karat / 24
fine gold weight = gross item weight × purity
spot value = fine gold troy ounces × current 24K spot price
```

The gold result shows:

- gross item weight
- karat and purity percentage
- fine/pure gold content in grams and troy ounces
- current 24K spot price per troy ounce and gram
- estimated intrinsic/melt value

Supported weight units are **grams, pennyweight (dwt), troy ounces, ordinary avoirdupois ounces, kilograms, and pounds**.

For silver, leave `karat` blank. The silver calculation remains a full-metal spot-value calculation.

### `/goldvalue`

`/goldvalue` is a shortcut specifically for jewelry and scrap gold, so `karat` is required:

```text
/goldvalue weight:12.5 unit:Gram karat:14 currency:USD
/goldvalue weight:3.2 unit:Pennyweight karat:18 currency:USD
/goldvalue weight:1 unit:Avoirdupois ounce karat:10 currency:USD
```

The displayed value is the theoretical intrinsic gold value at spot. A dealer, pawn shop, or refiner may pay less, and the result does not subtract stones, clasps, watch movements, non-gold components, assay differences, refining charges, bid/ask spreads, taxes, or other fees.

### `/alert`

Example:

```text
/alert add metal:Gold direction:At or above price:4500 currency:USD
```

The bot checks active alerts periodically and sends a one-time DM when the threshold is crossed. Users must allow the bot to DM them.

### `/pricesetup`

Requires **Manage Server**.

```text
/pricesetup enable channel:#metals interval:Every hour currency:USD
/pricesetup show
/pricesetup disable
```

Scheduled-post configuration is saved separately for every Discord server.

### `/goldstatus`

Requires the user ID specified by `OWNER_ID`.

```text
/goldstatus enabled:true currency:USD
/goldstatus enabled:false
```

The bot presence will look approximately like:

```text
Watching Gold $4,413/oz
```

## Price sources

- Metal spot pricing: Gold-API.com (`XAU` and `XAG`)
- Currency conversion: Frankfurter v2

The bot caches spot responses briefly and FX rates for 30 minutes.

## 1-hour change

The bot records a gold and silver USD sample every 5 minutes. Once it has about an hour of history, price embeds show an explicitly labeled **1-hour change**. This is calculated from the bot's own samples and is not presented as an exchange-provided daily change.

Price history older than 48 hours is pruned automatically.

## Data

SQLite data is stored locally at:

```text
data/goldbot.sqlite
```

You can override this with `DB_PATH`. On Railway, if a persistent volume is attached, the bot automatically detects `RAILWAY_VOLUME_MOUNT_PATH` and stores `goldbot.sqlite` there. Back up the database if you want to preserve alerts and server configuration.

## Deploy from GitHub to Railway

This repository is ready for Railway deployment. Railway detects the included `Dockerfile`, and `railway.json` keeps the deployment configuration with the source code.

1. Push this project to a GitHub repository. **Do not commit `.env`**.
2. In Railway, create a project/service from that GitHub repository.
3. Add these Railway service variables:

```env
DISCORD_TOKEN=...
CLIENT_ID=...
GUILD_ID=...
OWNER_ID=...
REGISTER_COMMANDS_ON_START=true
DEFAULT_CURRENCY=USD
```

`GUILD_ID` is recommended initially because guild-scoped Discord commands update immediately. Leave it blank later if you want commands registered globally.

4. Attach a Railway Volume to the bot service and mount it at:

```text
/data
```

Railway provides `RAILWAY_VOLUME_MOUNT_PATH` automatically, and the bot will store the SQLite database at `/data/goldbot.sqlite`. You do not need to set `DB_PATH` manually.

5. Deploy the service. No public Railway domain is required; this bot initiates outbound connections to Discord and the pricing APIs.

6. Keep GitHub autodeploy enabled. New commits pushed to the connected branch will trigger a new Railway deployment automatically.

Slash commands are registered automatically at startup by default. You can turn that off with:

```env
REGISTER_COMMANDS_ON_START=false
```

## Running continuously

The bot needs a process that stays online. Good options include:

- a small VPS
- a home server / mini PC
- Docker or a process manager on an existing server
- a Node-compatible application host

If you use PM2, for example:

```bash
npm install -g pm2
npm run register
pm2 start src/index.js --name goldbot
```

For production, start the script under your preferred process manager and make sure the `data` directory is persistent.

## Notes

Spot-price APIs can briefly fail or return stale data during upstream outages. Do not use this bot as the sole source for time-critical trading or settlement decisions.
