import { Router } from "express";
import PlayerMail from "../models/PlayerMail";
import GlobalMail from "../models/GlobalMail";
import { NOT_DELETED_DATE } from "../lib/time";

const r = Router();

// List inbox (resolve localization at read-time from global_mails)
r.get("/:playfab_id/mails", async (req, res) => {
  const { playfab_id } = req.params;
  const lang = (req.query.lang as string) || "EN";
  const includeExpired = req.query.includeExpired === "true";
  const now = new Date();

  const filter: any = { playfab_id, delete_time: NOT_DELETED_DATE, status: 1 };
  if (!includeExpired) {
    filter.visible_from = { $lte: now };
    filter.expires_at   = { $gt:  now };
  }

  const inbox = await PlayerMail.find(filter).sort({ visible_from: -1 }).lean();

  // batch fetch globals by legacy id
  const legacyIds = [...new Set(inbox.map(i => i.legacy_mail_id))];
  const globals = await GlobalMail.find({
    legacy_mail_id: { $in: legacyIds },
    delete_time: NOT_DELETED_DATE,
    status: 1
  }).lean();
  const map = new Map(globals.map(g => [g.legacy_mail_id, g]));

  const result = inbox.map(pm => {
    const gm = map.get(pm.legacy_mail_id);
    let subject = "", body = "";
    if (gm) {
      const loc = (gm.localizations || []).find((x: any) => x.language === lang)
              || (gm.localizations || []).find((x: any) => x.language === gm.default_language)
              || (gm.localizations || [])[0];
      subject = loc?.subject || "";
      body    = loc?.body || "";
    }
    return { ...pm, subject, body };
  });

  res.json(result);
});

// Claim mail (idempotent)
r.post("/:playfab_id/mails/:playerMailId/claim", async (req, res) => {
  const { playfab_id, playerMailId } = req.params;
  const now = new Date();

  const doc = await PlayerMail.findOneAndUpdate(
    { _id: playerMailId, playfab_id, is_claimed: false, delete_time: NOT_DELETED_DATE, status: 1 },
    { $set: { is_claimed: true, claimed_at: now, update_time: now } },
    { new: true }
  );

  if (!doc) return res.status(409).json({ error: "Already claimed or not found" });

  // TODO: hook to your reward-grant logic using doc.rewards_snapshot
  res.json({ ok: true, rewards: doc.rewards_snapshot });
});

export default r;
