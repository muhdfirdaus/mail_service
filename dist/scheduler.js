"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startScheduler = startScheduler;
const node_cron_1 = __importDefault(require("node-cron"));
const MailRelease_1 = __importDefault(require("./models/MailRelease"));
const GlobalMail_1 = __importDefault(require("./models/GlobalMail"));
const PlayerMail_1 = __importDefault(require("./models/PlayerMail"));
const Player_1 = __importDefault(require("./models/Player")); // <-- game-db players (playfab_id, status, delete_time)
const time_1 = require("./lib/time");
const cache_1 = require("./lib/cache");
/**
 * Recipients iterator
 * - players: uses provided array
 * - all: streams from game-db.players with Cosmos-friendly projection
 * - segment/conditions: stubs to implement later
 */
async function* recipientsFor(snapshot) {
    const type = snapshot?.type;
    if (type === "players") {
        for (const pid of snapshot.player_ids || []) {
            if (pid)
                yield pid;
        }
        return;
    }
    if (type === "all") {
        // Only alive players; projection via .select() to avoid Cosmos projection error
        const cursor = Player_1.default.find({ delete_time: time_1.NOT_DELETED_DATE,
            status: 1,
            name: { $not: { $regex: "deleted", $options: "i" } }
        }, undefined)
            .select("playfab_id -_id")
            .lean()
            .cursor();
        for await (const p of cursor) {
            if (p?.playfab_id)
                yield p.playfab_id;
        }
        return;
    }
    if (type === "segment") {
        // TODO: implement segment resolution to a query on Player, then yield playfab_id
        return;
    }
    if (type === "conditions") {
        // TODO: translate snapshot.conditions => Player query, then yield playfab_id
        return;
    }
}
/**
 * Scheduler
 * - runs every minute
 * - flips states (pending->running; running/pending past end->completed)
 * - for each active release, bulk upserts PlayerMail rows
 */
function startScheduler() {
    const BATCH_SIZE = Number(process.env.SCHEDULER_BATCH_SIZE || 1000);
    const task = node_cron_1.default.schedule("* * * * *", async () => {
        const now = new Date();
        try {
            // 1) Pending that should start -> running
            await MailRelease_1.default.updateMany({
                delete_time: time_1.NOT_DELETED_DATE,
                status: 1,
                state: "pending",
                "window.start_at": { $lte: now },
                "window.end_at": { $gt: now },
            }, { $set: { state: "running", update_time: now } });
            // 2) Pending/Running that already ended -> completed
            await MailRelease_1.default.updateMany({
                delete_time: time_1.NOT_DELETED_DATE,
                status: 1,
                state: { $in: ["pending", "running"] },
                "window.end_at": { $lte: now },
            }, { $set: { state: "completed", update_time: now } });
            // 3) Process active releases
            const releases = await MailRelease_1.default.find({
                delete_time: time_1.NOT_DELETED_DATE,
                status: 1,
                state: { $in: ["pending", "running"] },
                "window.start_at": { $lte: now },
                "window.end_at": { $gt: now },
            });
            for (const rel of releases) {
                try {
                    // Ensure state is "running"
                    if (rel.state !== "running") {
                        rel.state = "running";
                        rel.update_time = now;
                        await rel.save();
                    }
                    // Guard window presence
                    if (!rel.window || !rel.window.start_at || !rel.window.end_at) {
                        // bad data; skip this release
                        continue;
                    }
                    const visible_from = rel.window.start_at;
                    const expires_at = rel.window.end_at;
                    // Load the global mail backing this release
                    const gm = await GlobalMail_1.default.findOne({
                        legacy_mail_id: rel.legacy_mail_id,
                        delete_time: time_1.NOT_DELETED_DATE,
                        status: 1,
                    }).lean();
                    if (!gm)
                        continue;
                    if (!gm.display || !gm.available)
                        continue;
                    // Prepare batching
                    const rewards_snapshot = gm.rewards || { items: [] };
                    const release_legacy_id = rel.release_legacy_id ??
                        parseInt(rel._id.toHexString().slice(-6), 16);
                    let matched = 0, created = 0, errors = 0;
                    let ops = [];
                    async function flush() {
                        if (ops.length === 0)
                            return;
                        try {
                            const result = await PlayerMail_1.default.bulkWrite(ops, { ordered: false });
                            created += result?.upsertedCount || 0;
                            // Some drivers expose writeErrors only via thrown error; still attempt to read
                            // @ts-ignore
                            const werr = (result?.getWriteErrors && result.getWriteErrors()) || [];
                            errors += Array.isArray(werr) ? werr.length : 0;
                        }
                        catch (e) {
                            // bulkWrite throws for severe errors; count per-op errors if present
                            const werr = e?.writeErrors || [];
                            errors += Array.isArray(werr) && werr.length ? werr.length : 1;
                        }
                        finally {
                            ops = [];
                        }
                    }
                    for await (const playfab_id of recipientsFor(rel.targeting_snapshot)) {
                        matched++;
                        ops.push({
                            updateOne: {
                                filter: {
                                    playfab_id,
                                    legacy_mail_id: gm.legacy_mail_id,
                                    delete_time: time_1.NOT_DELETED_DATE,
                                },
                                update: {
                                    $setOnInsert: {
                                        playfab_id,
                                        legacy_mail_id: gm.legacy_mail_id,
                                        release_legacy_id,
                                        rewards_snapshot,
                                        is_read: false,
                                        is_claimed: false,
                                        claimed_at: null,
                                        visible_from,
                                        expires_at,
                                        status: 1,
                                        create_time: now,
                                        update_time: now,
                                        delete_time: time_1.NOT_DELETED_DATE,
                                    },
                                },
                                upsert: true,
                            },
                        });
                        (0, cache_1.bustGlobalMailsCache)();
                        if (ops.length >= BATCH_SIZE) {
                            await flush();
                        }
                    }
                    await flush();
                    // Persist progress
                    await MailRelease_1.default.updateOne({ _id: rel._id }, {
                        $set: {
                            "progress.matched": matched,
                            "progress.created": created,
                            "progress.errors": errors,
                            "progress.last_run_at": now,
                            update_time: new Date(),
                        },
                    });
                }
                catch (e) {
                    // per-release guard; never crash the cron
                    // eslint-disable-next-line no-console
                    console.error("[scheduler] release error", rel?.legacy_mail_id, e);
                }
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error("[scheduler] tick error", e);
        }
    });
    task.start();
    return () => task.stop();
}
