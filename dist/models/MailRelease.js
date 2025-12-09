"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const time_1 = require("../lib/time");
const db_1 = require("../db");
const MailReleaseSchema = new mongoose_1.Schema({
    // ---- audit / status ----
    create_time: { type: Date, default: () => new Date() },
    update_time: { type: Date, default: () => new Date() },
    delete_time: { type: Date, default: () => time_1.NOT_DELETED_DATE },
    status: { type: Number, default: 1 },
    // ---- identity ----
    legacy_mail_id: { type: Number, required: true }, // FK to global_mails
    release_legacy_id: { type: Number }, // optional human-friendly ID
    // ---- window ----
    window: {
        start_at: { type: Date, required: true },
        end_at: { type: Date, required: true }
    },
    // ---- state / recurrence ----
    state: { type: String, enum: ["pending", "running", "completed", "cancelled"], default: "pending" },
    run_once: { type: Boolean, default: true },
    recurrence: { type: mongoose_1.Schema.Types.Mixed, default: null },
    // ---- snapshot ----
    targeting_snapshot: {
        type: { type: String, enum: ["all", "segment", "players", "conditions"], default: "all" },
        segment_id: { type: Number, default: null },
        player_ids: { type: [String], default: [] },
        conditions: { type: mongoose_1.Schema.Types.Mixed, default: {} }
    },
    progress: {
        matched: { type: Number, default: 0 },
        created: { type: Number, default: 0 },
        errors: { type: Number, default: 0 },
        last_run_at: { type: Date, default: null }
    }
}, { collection: "mail_releases" });
MailReleaseSchema.index({ status: 1, state: 1, "window.start_at": 1 });
MailReleaseSchema.index({ legacy_mail_id: 1, release_legacy_id: 1 });
MailReleaseSchema.index({ legacy_mail_id: 1 }, { unique: true });
MailReleaseSchema.pre("save", function (next) {
    this.update_time = new Date();
    next();
});
exports.default = db_1.mailDB.model("MailRelease", MailReleaseSchema);
