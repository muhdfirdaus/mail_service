"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/models/Player.ts
const db_1 = require("../db");
const mongoose_1 = require("mongoose");
const PlayerSchema = new mongoose_1.Schema({
    playfab_id: { type: String, required: true, unique: true },
    delete_time: { type: Date, required: true },
    status: { type: Number, default: 1 },
    // ... add fields you may segment on later (level, region, etc.)
}, { collection: "players" });
// Helpful index for scans
PlayerSchema.index({ status: 1, delete_time: 1, playfab_id: 1 });
exports.default = db_1.gameDB.model("Player", PlayerSchema);
