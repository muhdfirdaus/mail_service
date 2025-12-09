import mongoose, { Schema } from "mongoose";
import { NOT_DELETED_DATE } from "../lib/time";

const SegmentSchema = new Schema({
  create_time: { type: Date, default: () => new Date() },
  update_time: { type: Date, default: () => new Date() },
  delete_time: { type: Date, default: () => NOT_DELETED_DATE },
  status: { type: Number, default: 1 },

  legacy_segment_id: { type: Number, unique: true, sparse: true },
  name: { type: String, required: true },
  query: { type: Schema.Types.Mixed, required: true }
}, { collection: "segments" });

SegmentSchema.index({ status: 1, name: 1 });

SegmentSchema.pre("save", function(next) {
  (this as any).update_time = new Date();
  next();
});

export default mongoose.model("Segment", SegmentSchema);
