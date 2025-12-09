// src/models/Player.ts
import { gameDB } from "../db";
import { Schema } from "mongoose";

const PlayerSchema = new Schema(
  {
    playfab_id: { type: String, required: true, unique: true },
    delete_time: { type: Date, required: true },
    status: { type: Number, default: 1 },
    // ... add fields you may segment on later (level, region, etc.)
  },
  { collection: "players" }
);

// Helpful index for scans
PlayerSchema.index({ status: 1, delete_time: 1, playfab_id: 1 });

export default gameDB.model("Player", PlayerSchema);
