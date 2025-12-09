"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const PlayerMail_1 = __importDefault(require("../models/PlayerMail"));
const GlobalMail_1 = __importDefault(require("../models/GlobalMail"));
const time_1 = require("../lib/time");
const r = (0, express_1.Router)();
// List inbox (resolve localization at read-time from global_mails)
r.get("/:playfab_id/mails", async (req, res) => {
    const { playfab_id } = req.params;
    const lang = req.query.lang || "EN";
    const includeExpired = req.query.includeExpired === "true";
    const now = new Date();
    const filter = { playfab_id, delete_time: time_1.NOT_DELETED_DATE, status: 1 };
    if (!includeExpired) {
        filter.visible_from = { $lte: now };
        filter.expires_at = { $gt: now };
    }
    const inbox = await PlayerMail_1.default.find(filter).sort({ visible_from: -1 }).lean();
    // batch fetch globals by legacy id
    const legacyIds = [...new Set(inbox.map(i => i.legacy_mail_id))];
    const globals = await GlobalMail_1.default.find({
        legacy_mail_id: { $in: legacyIds },
        delete_time: time_1.NOT_DELETED_DATE,
        status: 1
    }).lean();
    const map = new Map(globals.map(g => [g.legacy_mail_id, g]));
    const result = inbox.map(pm => {
        const gm = map.get(pm.legacy_mail_id);
        let subject = "", body = "";
        if (gm) {
            const loc = (gm.localizations || []).find((x) => x.language === lang)
                || (gm.localizations || []).find((x) => x.language === gm.default_language)
                || (gm.localizations || [])[0];
            subject = loc?.subject || "";
            body = loc?.body || "";
        }
        return { ...pm, subject, body };
    });
    res.json(result);
});
// Claim mail (idempotent)
r.post("/:playfab_id/mails/:playerMailId/claim", async (req, res) => {
    const { playfab_id, playerMailId } = req.params;
    const now = new Date();
    const doc = await PlayerMail_1.default.findOneAndUpdate({ _id: playerMailId, playfab_id, is_claimed: false, delete_time: time_1.NOT_DELETED_DATE, status: 1 }, { $set: { is_claimed: true, claimed_at: now, update_time: now } }, { new: true });
    if (!doc)
        return res.status(409).json({ error: "Already claimed or not found" });
    // TODO: hook to your reward-grant logic using doc.rewards_snapshot
    res.json({ ok: true, rewards: doc.rewards_snapshot });
});
exports.default = r;
