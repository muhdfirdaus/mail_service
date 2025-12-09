"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const GlobalMail_1 = __importDefault(require("../models/GlobalMail"));
const MailRelease_1 = __importDefault(require("../models/MailRelease"));
const PlayerMail_1 = __importDefault(require("../models/PlayerMail"));
const time_1 = require("../lib/time");
const crypto_1 = __importDefault(require("crypto"));
const cache_1 = require("../lib/cache");
const r = (0, express_1.Router)();
// src/routes/globalMails.ts
r.post("/", async (req, res) => {
    const now = new Date();
    const NOT_DELETED_DATE = new Date(-62135596800000);
    // pull out audit + status so they don't sneak into $set
    const { legacy_mail_id, status, // <— capture and REMOVE from $set
    create_time: _ct, delete_time: _dt, update_time: _ut, ...rest } = req.body || {};
    // $set — everything except audit fields & status
    const setDoc = {
        ...rest,
        update_time: now
    };
    // $setOnInsert — audit fields + initial status
    const setOnInsertDoc = {
        legacy_mail_id,
        create_time: now,
        delete_time: NOT_DELETED_DATE,
        status: (typeof status === "number" ? status : 1)
    };
    const doc = await GlobalMail_1.default.findOneAndUpdate({ legacy_mail_id }, { $set: setDoc, $setOnInsert: setOnInsertDoc }, { new: true, upsert: true, runValidators: true });
    return res.json(doc);
});
// POST compat (for gateways that don't pass PATCH)
r.post("/:legacy_mail_id/_patch", async (req, res) => {
    const legacy_mail_id = Number(req.params.legacy_mail_id);
    const doc = await GlobalMail_1.default.findOneAndUpdate({ legacy_mail_id, delete_time: time_1.NOT_DELETED_DATE }, { $set: { ...req.body, update_time: new Date() } }, { new: true });
    return doc ? res.json(doc) : res.status(404).json({ error: "global_mail not found" });
});
// Soft delete (set delete_time)
r.delete("/:legacy_mail_id", async (req, res) => {
    const legacy_mail_id = Number(req.params.legacy_mail_id);
    const doc = await GlobalMail_1.default.findOneAndUpdate({ legacy_mail_id }, { $set: { delete_time: new Date(), update_time: new Date(), status: 0 } }, { new: true });
    res.json(doc);
});
// Create a release (snapshot targeting)
r.post("/:legacy_mail_id/releases", async (req, res) => {
    const now = new Date();
    const NOT_DELETED_DATE = new Date(-62135596800000);
    const legacy_mail_id = Number(req.params.legacy_mail_id);
    const gm = await GlobalMail_1.default.findOne({ legacy_mail_id, delete_time: NOT_DELETED_DATE });
    if (!gm)
        return res.status(404).json({ error: "global_mail not found" });
    // Enforce single release per mail
    const existing = await MailRelease_1.default.findOne({ legacy_mail_id, delete_time: NOT_DELETED_DATE });
    if (existing)
        return res.status(409).json({ error: "release already exists for this mail" });
    const winStart = gm.schedule?.start_at;
    const winEnd = gm.schedule?.end_at;
    if (!winStart || !winEnd) {
        return res.status(400).json({ error: "global_mail.schedule is required (start_at & end_at)" });
    }
    let { run_once = true, recurrence = null, release_legacy_id } = req.body || {};
    if (!release_legacy_id) {
        release_legacy_id = parseInt(crypto_1.default.randomBytes(3).toString("hex"), 16);
    }
    const filter = { legacy_mail_id, delete_time: NOT_DELETED_DATE };
    const setDoc = {
        legacy_mail_id,
        release_legacy_id,
        window: { start_at: winStart, end_at: winEnd },
        state: "pending",
        run_once,
        recurrence,
        targeting_snapshot: gm.targeting,
        status: 1,
        update_time: now
    };
    const setOnInsert = {
        create_time: now,
        delete_time: NOT_DELETED_DATE
    };
    const rel = await MailRelease_1.default.findOneAndUpdate(filter, { $set: setDoc, $setOnInsert: setOnInsert }, { new: true, upsert: true, runValidators: true });
    return res.json(rel);
});
// Cancel a release
r.post("/:legacy_mail_id/releases/:release_legacy_id/cancel", async (req, res) => {
    const { legacy_mail_id, release_legacy_id } = req.params;
    await MailRelease_1.default.updateOne({ legacy_mail_id: Number(legacy_mail_id), release_legacy_id: Number(release_legacy_id) }, { $set: { state: "cancelled", update_time: new Date() } });
    res.json({ ok: true });
});
// Recall unclaimed player mails for a release
r.post("/:legacy_mail_id/releases/:release_legacy_id/recall", async (req, res) => {
    const { legacy_mail_id, release_legacy_id } = req.params;
    const now = new Date();
    const result = await PlayerMail_1.default.updateMany({ legacy_mail_id: Number(legacy_mail_id), release_legacy_id: Number(release_legacy_id), is_claimed: false }, { $set: { status: 0, delete_time: now, update_time: now } });
    res.json({ ok: true, recalled: result.modifiedCount });
});
// cancel the only release for a mail
r.post("/:legacy_mail_id/cancel-release", async (req, res) => {
    const legacy_mail_id = Number(req.params.legacy_mail_id);
    const now = new Date();
    const doc = await MailRelease_1.default.findOneAndUpdate({ legacy_mail_id, delete_time: time_1.NOT_DELETED_DATE }, { $set: { state: "cancelled", status: 0, update_time: now } }, { new: true });
    if (!doc)
        return res.status(404).json({ error: "release not found" });
    res.json({ ok: true });
});
// recall unclaimed player mails
r.post("/:legacy_mail_id/recall", async (req, res) => {
    const legacy_mail_id = Number(req.params.legacy_mail_id);
    const now = new Date();
    const result = await PlayerMail_1.default.updateMany({ legacy_mail_id, is_claimed: false, delete_time: time_1.NOT_DELETED_DATE }, { $set: { status: 0, delete_time: now, update_time: now } });
    res.json({ ok: true, recalled: result.modifiedCount });
});
// GET /global-mails?scope=active|upcoming|expired|all&page=1&pageSize=20
r.get("/", async (req, res) => {
    const scope = String(req.query.scope || "active").toLowerCase();
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 20)));
    const now = new Date();
    const key = `${cache_1.GLOBAL_MAILS_CACHE_PREFIX}${scope}:${page}:${pageSize}`;
    const cachedETag = cache_1.cache.getETag(key);
    const ifNoneMatch = req.header("if-none-match");
    if (cachedETag && ifNoneMatch === cachedETag) {
        res.setHeader("ETag", cachedETag);
        return res.status(304).end();
    }
    const cached = cache_1.cache.get(key);
    if (cached) {
        if (cached.etag)
            res.setHeader("ETag", cached.etag);
        return res.json(cached.payload);
    }
    // base filter: alive + enabled
    const base = { delete_time: time_1.NOT_DELETED_DATE, status: 1 };
    // time windows (only filters, NO sort at DB level)
    const active = {
        "schedule.start_at": { $lte: now },
        $or: [
            { "schedule.end_at": { $gt: now } },
            { "schedule.end_at": null }, // open-ended mails are active
        ],
    };
    const upcoming = { "schedule.start_at": { $gt: now } };
    const expired = { "schedule.end_at": { $lte: now } };
    let filter = base;
    switch (scope) {
        case "active":
            filter = { ...base, ...active };
            break;
        case "upcoming":
            filter = { ...base, ...upcoming };
            break;
        case "expired":
            filter = { ...base, ...expired };
            break;
        case "all":
        default:
            filter = base;
            break;
    }
    // IMPORTANT: no .sort() here → avoid Cosmos ORDER BY index requirements
    const docs = await GlobalMail_1.default.find(filter).lean();
    // sort in memory instead
    docs.sort((a, b) => {
        const aStart = a?.schedule?.start_at ? new Date(a.schedule.start_at).getTime() : 0;
        const bStart = b?.schedule?.start_at ? new Date(b.schedule.start_at).getTime() : 0;
        if (aStart !== bStart)
            return bStart - aStart; // newest start_at first
        const aUpd = a?.update_time ? new Date(a.update_time).getTime() : 0;
        const bUpd = b?.update_time ? new Date(b.update_time).getTime() : 0;
        return bUpd - aUpd; // tie-break by update_time desc
    });
    const total = docs.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const itemsForPage = docs.slice(startIndex, endIndex);
    const mapped = itemsForPage.map((gm) => ({
        legacy_mail_id: gm.legacy_mail_id,
        category: gm.category,
        order_by: gm.order_by,
        display: gm.display,
        default_language: gm.default_language,
        schedule: gm.schedule,
        targeting: gm.targeting,
        available: gm.available,
        update_time: gm.update_time,
        is_active: gm.schedule?.start_at &&
            new Date(gm.schedule.start_at) <= now &&
            (gm.schedule?.end_at == null || new Date(gm.schedule.end_at) > now),
    }));
    const maxUpdated = itemsForPage.reduce((mx, it) => Math.max(mx, it.update_time ? new Date(it.update_time).getTime() : 0), 0);
    const etag = itemsForPage.length > 0
        ? (0, cache_1.makeETag)([
            scope,
            page,
            pageSize,
            ...itemsForPage.map((x) => x.legacy_mail_id),
            maxUpdated,
        ])
        : undefined;
    const payload = {
        page,
        pageSize,
        total,
        scope,
        items: mapped,
    };
    if (etag)
        res.setHeader("ETag", etag);
    cache_1.cache.set(key, { payload, etag }, 30000, etag);
    res.json(payload);
});
exports.default = r;
