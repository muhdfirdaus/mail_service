import mongoose, { Schema } from "mongoose";
import { NOT_DELETED_DATE } from "../lib/time";
import { mailDB } from "../db";

const MailReleaseSchema = new Schema({
  // ---- audit / status ----
  create_time: { type: Date, default: () => new Date() },
  update_time: { type: Date, default: () => new Date() },
  delete_time: { type: Date, default: () => NOT_DELETED_DATE },
  status: { type: Number, default: 1 },

  // ---- identity ----
  legacy_mail_id: { type: Number, required: true },  // FK to global_mails
  release_legacy_id: { type: Number },               // optional human-friendly ID

  // ---- window ----
  window: {
    start_at: { type: Date, required: true },
    end_at:   { type: Date, required: true }
  },

  // ---- state / recurrence ----
  state:    { type: String, enum: ["pending","running","completed","cancelled"], default: "pending" },
  run_once: { type: Boolean, default: true },
  recurrence: { type: Schema.Types.Mixed, default: null },

  // ---- snapshot ----
  targeting_snapshot: {
    type: { type: String, enum: ["all","segment","players","conditions"], default: "all" },
    segment_id: { type: Number, default: null },
    player_ids: { type: [String], default: [] },
    conditions: { type: Schema.Types.Mixed, default: {} }
  },

  progress: {
    matched: { type: Number, default: 0 },
    created: { type: Number, default: 0 },
    errors:  { type: Number, default: 0 },
    last_run_at: { type: Date, default: null }
  }
}, { collection: "mail_releases" });

MailReleaseSchema.index({ status: 1, state: 1, "window.start_at": 1 });
MailReleaseSchema.index({ legacy_mail_id: 1, release_legacy_id: 1 });
MailReleaseSchema.index({ legacy_mail_id: 1 }, { unique: true });
MailReleaseSchema.pre("save", function(next) {
  (this as any).update_time = new Date();
  next();
});

export default mailDB.model("MailRelease", MailReleaseSchema);
