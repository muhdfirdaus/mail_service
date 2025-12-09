import mongoose, { Schema } from "mongoose";
import { NOT_DELETED_DATE } from "../lib/time";
import { mailDB } from "../db";

const RewardsItem = new Schema({
  item_id:  { type: String, required: true },
  quantity: { type: Number, required: true }
}, { _id: false });

const PlayerMailSchema = new Schema({
  // ---- audit / status ----
  create_time: { type: Date, default: () => new Date() },
  update_time: { type: Date, default: () => new Date() },
  delete_time: { type: Date, default: () => NOT_DELETED_DATE },
  status: { type: Number, default: 1 },

  // ---- identity ----
  playfab_id: { type: String, required: true },
  legacy_mail_id: { type: Number, required: true },     // FK to global_mails
  release_legacy_id: { type: Number, required: true },  // FK-ish to mail_releases

  // ---- content snapshot (no subject/body for space efficiency) ----
  rewards_snapshot: { items: [RewardsItem] },

  // ---- state ----
  is_read:    { type: Boolean, default: false },
  is_claimed: { type: Boolean, default: false },
  claimed_at: { type: Date, default: null },

  // ---- visibility ----
  visible_from: { type: Date, required: true },
  expires_at:   { type: Date, required: true }
}, { collection: "player_mails" });

PlayerMailSchema.index({ playfab_id: 1, visible_from: -1, status: 1, delete_time: 1 });
PlayerMailSchema.index({ playfab_id: 1, is_claimed: 1, expires_at: 1 });
PlayerMailSchema.index(
  { playfab_id: 1, legacy_mail_id: 1 },
  { unique: true }
);
PlayerMailSchema.index({ playfab_id: 1});

// Optional TTL autoclean (single-field index)
PlayerMailSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

PlayerMailSchema.pre("save", function(next) {
  (this as any).update_time = new Date();
  next();
});

export default mailDB.model("PlayerMail", PlayerMailSchema);
