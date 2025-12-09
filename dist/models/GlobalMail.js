"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const time_1 = require("../lib/time");
const db_1 = require("../db");
const Localization = new mongoose_1.Schema({
    language: { type: String, required: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
}, { _id: false });
const RewardsItem = new mongoose_1.Schema({
    item_id: { type: String, required: true },
    quantity: { type: Number, required: true }
}, { _id: false });
const GlobalMailSchema = new mongoose_1.Schema({
    // ---- audit / status ----
    create_time: { type: Date, default: () => new Date() },
    update_time: { type: Date, default: () => new Date() },
    delete_time: { type: Date, default: () => time_1.NOT_DELETED_DATE },
    status: { type: Number, default: 1 },
    // ---- identity ----
    legacy_mail_id: { type: Number, required: true, unique: true },
    // ---- presentation ----
    category: { type: String, default: "System" },
    order_by: { type: Number, default: 0 },
    display: { type: Boolean, default: true },
    available: { type: Boolean, default: true },
    // ---- content ----
    default_language: { type: String, required: true },
    localizations: { type: [Localization], validate: (v) => v.length > 0 },
    rewards: { items: [RewardsItem] },
    customs: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    asset_path: { type: String, default: "" },
    // ---- schedule (UTC) ----
    schedule: {
        start_at: { type: Date, required: true },
        end_at: { type: Date, required: true }
    },
    // ---- targeting ----
    targeting: {
        type: { type: String, enum: ["all", "segment", "players", "conditions"], default: "all" },
        segment_id: { type: Number, default: null },
        player_ids: { type: [String], default: [] },
        conditions: { type: mongoose_1.Schema.Types.Mixed, default: {} }
    }
}, { collection: "global_mails", minimize: false });
GlobalMailSchema.index({ status: 1, "schedule.start_at": 1, "schedule.end_at": 1 });
GlobalMailSchema.index({ category: 1, order_by: 1 });
// indexes for /global-mails listing
GlobalMailSchema.index({ delete_time: 1, status: 1, "schedule.start_at": -1, update_time: -1 }, { name: "gm_list_by_window_desc" });
// (Optional but helpful for scope=expired queries)
GlobalMailSchema.index({ delete_time: 1, status: 1, "schedule.end_at": -1 }, { name: "gm_list_by_end_desc" });
// Sanity check: start < end
GlobalMailSchema.pre("validate", function (next) {
    const s = this.schedule;
    if (s?.start_at && s?.end_at && s.start_at >= s.end_at) {
        return next(new Error("schedule.start_at must be before schedule.end_at"));
    }
    next();
});
// Always bump update_time
GlobalMailSchema.pre("save", function (next) {
    this.update_time = new Date();
    next();
});
GlobalMailSchema.pre("findOneAndUpdate", function (next) {
    this.set({ update_time: new Date() });
    next();
});
exports.default = db_1.mailDB.model("GlobalMail", GlobalMailSchema);
