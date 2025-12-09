# 📬 Mail Service (MongoDB + Node.js)

A lightweight mailing system for managing **in-game mails** and **player inboxes**, integrated with MongoDB.  
Supports global mail definitions, localization, player targeting, and scheduled releases with a cron-driven dispatcher.

---

## 🚀 Features

- Add and edit global mails with multilingual content.
- Schedule mails for automatic release to players.
- Target players by type (`all`, `segment`, `players`, `conditions`).
- Manage release lifecycle — activate, cancel, recall.
- Separate databases for system mails (`mail-db`) and players (`game-db`).
- Automatic status tracking for `pending`, `running`, and `completed` releases.

---

## 🧩 Architecture

### Collections

| Collection | Database | Purpose |
|-------------|-----------|----------|
| `global_mails` | `mail-db` | Master data for each mail (subject, body, rewards, targeting). |
| `mail_releases` | `mail-db` | Defines when a mail becomes active and which players receive it. |
| `player_mails` | `mail-db` | Bindings between players and mails; generated automatically. |
| `players` | `game-db` | Source of active players (existing collection in your game system). |

---

## 🗃️ MongoDB Schema Summary

### `global_mails`
```js
{
  legacy_mail_id: Number, // unique key
  category: String,
  order_by: Number,
  display: Boolean,
  available: Boolean,
  default_language: String,
  localizations: [
    { language: "EN", subject: "Welcome!", body: "Here are your rewards!" },
    { language: "JP", subject: "ようこそ！", body: "100個のジェムをどうぞ。" }
  ],
  rewards: { items: [{ item_id: "70341001", quantity: 100 }] },
  schedule: { start_at: Date, end_at: Date },
  targeting: {
    type: "all" | "segment" | "players" | "conditions",
    segment_id: Number | null,
    player_ids: [String],
    conditions: Object
  },
  create_time: Date,
  update_time: Date,
  delete_time: Date,
  status: Number
}
```

### `mail_releases`
```js
{
  legacy_mail_id: Number, // unique: 1 mail = 1 release
  release_legacy_id: Number, // optional (auto-generated)
  window: { start_at: Date, end_at: Date },
  state: "pending" | "running" | "completed" | "cancelled",
  run_once: Boolean,
  recurrence: Object | null,
  targeting_snapshot: Object,
  progress: {
    matched: Number,
    created: Number,
    errors: Number,
    last_run_at: Date
  },
  create_time: Date,
  update_time: Date,
  delete_time: Date,
  status: Number
}
```

### `player_mails`
```js
{
  playfab_id: String,
  legacy_mail_id: Number,
  release_legacy_id: Number,
  rewards_snapshot: Object,
  is_read: Boolean,
  is_claimed: Boolean,
  claimed_at: Date | null,
  visible_from: Date,
  expires_at: Date,
  create_time: Date,
  update_time: Date,
  delete_time: Date,
  status: Number
}
```

---

## 🔧 Environment Setup

You have **four environments** (`develop`, `qa`, `staging`, `prod`), each with its own `.env` file.

Example `.env.develop`:
```bash
APP_ENV=develop
PORT=8000
MONGO_URI=mongodb://<username>:<password>@<mongo-host>:10255/?ssl=true&retrywrites=false
GAME_MONGO_URI=mongodb://<username>:<password>@<mongo-host>:10255/?ssl=true&retrywrites=false
```

`MONGO_URI` = mail database (`mail-db`)  
`GAME_MONGO_URI` = player database (`game-db`)

---

## ⚙️ Local Development

### Install dependencies
```bash
npm ci
```

### Run locally (develop environment)
```bash
npm run dev:develop
```

### Build (compile TypeScript)
```bash
npm run build
```

### Start from built code
```bash
npm run start:develop
```

---

## ☁️ Deployment (BytePlus or Azure)

- Runtime: **Node.js 20.x**
- Build command: `npm run build`
- Start command: `node dist/index.js`
- Port: **bind to `process.env.PORT` (BytePlus default 8000)**
- Make sure both `MONGO_URI` and `GAME_MONGO_URI` are set.

---

## 🕓 Scheduler

### Behavior
Runs every minute via `node-cron`:

1. Marks pending releases as `running` when `start_at <= now < end_at`.
2. Marks running releases as `completed` when `end_at <= now`.
3. For each active release:
   - Finds target players from `game-db.players`.
   - Inserts new documents into `player_mails` if not yet created.
   - Tracks stats (`matched`, `created`, `errors`).

### Stop conditions
- `release.state = cancelled`
- `release.status = 0`
- `global_mail.status = 0`

---

## 🔑 Unique Indexes

| Collection | Index | Purpose |
|-------------|--------|----------|
| `global_mails` | `{ legacy_mail_id: 1 }` (unique) | One master per mail ID |
| `mail_releases` | `{ legacy_mail_id: 1 }` (unique) | One release per mail |
| `player_mails` | `{ playfab_id: 1, legacy_mail_id: 1 }` (unique) | Prevent duplicate mails per player |
| `players` (game-db) | `{ status: 1, delete_time: 1, playfab_id: 1 }` | Efficient player lookup |

---

## 📤 API Reference

### 1️⃣ Create / Upsert a Global Mail
`POST /global-mails`

```json
{
  "legacy_mail_id": 1001,
  "status": 1,
  "category": "Rewards",
  "order_by": 1,
  "display": true,
  "available": true,
  "default_language": "EN",
  "localizations": [
    { "language": "EN", "subject": "Welcome!", "body": "Here are 100 gems." },
    { "language": "JP", "subject": "ようこそ！", "body": "100個のジェムをどうぞ。" }
  ],
  "rewards": { "items": [ { "item_id": "70341001", "quantity": 100 } ] },
  "schedule": {
    "start_at": "2025-10-23T00:00:00.000Z",
    "end_at": "2025-11-24T00:00:00.000Z"
  },
  "targeting": { "type": "all" }
}
```
---

### 🔄 Update an existing mail
`POST /global-mails/:legacy_mail_id/_patch`
```json
{
  "category": "Rewards",
  "localizations": [
    { "language": "EN", "subject": "Updated subject!", "body": "New message here." },
    { "language": "JP", "subject": "更新された件名！", "body": "新しいメッセージです。" }
  ],
  "schedule": {
    "start_at": "2025-11-13T00:00:00Z",
    "end_at":   "2025-12-31T00:00:00Z"
  },
  "targeting": {
    "type": "players",
    "player_ids": ["AAA111", "BBB222"]
  }
}
```
---

### 2️⃣ Create a Release
`POST /global-mails/:legacy_mail_id/releases`

```json
{
  "run_once": true
}
```
- Uses `global_mail.schedule.start_at` and `end_at` automatically.
- Returns **409 Conflict** if a release already exists.

---

### 3️⃣ Cancel a Release
`POST /global-mails/:legacy_mail_id/cancel-release`

Marks release as `state: "cancelled"` and `status: 0`.

```json
{ "ok": true }
```

---

### 4️⃣ Recall Unclaimed Player Mails
`POST /global-mails/:legacy_mail_id/recall`

Soft-deletes unclaimed mails for the given mail.

```json
{ "ok": true, "recalled": 152 }
```

---

### 5️⃣ Get Player Inbox
`GET /players/:playfab_id/mails?lang=EN`

Returns active mails for the given player in preferred language.

--- 
### 6️⃣ Get Global Mails  
`GET /global-mails?scope=active|upcoming|expired|all&page=1&pageSize=20`

Fetches global mail definitions directly from the `global_mails` collection with optional filtering and pagination.  
The endpoint supports a lightweight in-memory cache and ETag headers to reduce database load.

#### 🧠 Behavior
- `scope` controls which mails to return:
  | Scope | Description |
  |--------|--------------|
  | `active` | Mails currently live (within schedule window). |
  | `upcoming` | Mails scheduled to start in the future. |
  | `expired` | Mails whose end date has passed. |
  | `all` | Returns all active mails (default filter applied). |
- Pagination uses `page` (default = 1) and `pageSize` (default = 20, max = 100).
- Responses include an `ETag` header that allows clients to cache results:
  - Send `If-None-Match` to receive `304 Not Modified` when unchanged.
- Cache auto-invalidates whenever a global mail is created, updated, or deleted.

#### 🧾 Example Request
```bash
GET /global-mails?scope=active&page=1&pageSize=10
```

#### ✅ Example Response
```json
{
  "page": 1,
  "pageSize": 10,
  "total": 45,
  "scope": "active",
  "items": [
    {
      "legacy_mail_id": 1001,
      "category": "Rewards",
      "order_by": 1,
      "display": true,
      "default_language": "EN",
      "schedule": {
        "start_at": "2025-10-23T00:00:00.000Z",
        "end_at": "2025-11-24T00:00:00.000Z"
      },
      "targeting": { "type": "all" },
      "available": true,
      "update_time": "2025-11-12T04:12:03.000Z",
      "is_active": true
    }
  ]
}
```

#### ⚡ Cache & Performance
- Cached in-memory for 30 seconds (per scope/page).
- Auto-clears whenever a mail is changed or when the scheduler updates states.
- Ideal for admin dashboards or status monitors to quickly list live and scheduled mails.

---

## 🎯 Targeting Types & Examples

### `"all"`
```json
"targeting": { "type": "all" }
```

### `"players"`
```json
"targeting": {
  "type": "players",
  "player_ids": ["ABC123", "XYZ999"]
}
```

### `"segment"`
```json
"targeting": {
  "type": "segment",
  "segment_id": 101
}
```

### `"conditions"`
```json
"targeting": {
  "type": "conditions",
  "conditions": { "level": { "$gte": 10 }, "vip_level": { "$gt": 0 } }
}
```

---

## ⚠️ Release Policy

| Rule | Description |
|------|--------------|
| **Single Release per Mail** | Each `legacy_mail_id` can have exactly one release. |
| **Release Window** | Automatically uses `global_mail.schedule.start_at` and `end_at`. |
| **Update Window** | Modify the existing release if you need to change dates. |
| **Re-release** | Duplicate the mail with a new `legacy_mail_id`. |
| **Cancel** | Stops scheduler from distributing mails. |
| **Recall** | Removes unclaimed player mails. |

---

## 🧩 Health Check
`GET /healthz` → `{ "ok": true }`

---


## 🧠 Notes

- Scheduler Frequency: Every 1 minute.

- Timestamps: `create_time`, `update_time`, `delete_time` use same sentinel style as other collections (`delete_time = -62135596800000` for active).

- Rebuild before deploy after any TypeScript change.

- Use 0.0.0.0 binding and `PORT` environment variable for cloud functions.

---
## 💾 Example Deployment Steps (BytePlus)

1. `npm ci && npm run build`
2. Zip `dist/`, `package.json`, and `.env.<env>`
3. Upload to BytePlus Function Service (Node.js 20.x)
4. Environment variables:
   - `APP_ENV`
   - `MONGO_URI`
   - `GAME_MONGO_URI`
5. Start command:  
   ```bash
   node dist/index.js
   ```
6. Ensure `PORT=8000` (BytePlus default).

---

## ✅ Quick Checklist Before Release

- [ ] `.env.<env>` configured with valid connection strings.
- [ ] Unique indexes applied.
- [ ] Release window in future.
- [ ] Scheduler running (`Mail service listening on :8000`).
- [ ] Test `GET /healthz` → `{ ok: true }`.

---

**Author:** OKA Dev Team  
**Maintainer:** @m-firdaus  
**License:** Internal Use Only
