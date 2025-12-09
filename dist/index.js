"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_flow_1 = __importDefault(require("dotenv-flow"));
dotenv_flow_1.default.config({
    node_env: process.env.APP_ENV || "develop", // develop | qa | staging | production
    silent: true
});
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const db_1 = require("./db");
const globalMails_1 = __importDefault(require("./routes/globalMails"));
const playerInbox_1 = __importDefault(require("./routes/playerInbox"));
const scheduler_1 = require("./scheduler");
async function main() {
    await (0, db_1.connectAll)();
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.set("trust proxy", 1);
    app.get("/healthz", (_req, res) => res.json({ ok: true }));
    app.use("/global-mails", globalMails_1.default);
    app.use("/players", playerInbox_1.default);
    const stopScheduler = (0, scheduler_1.startScheduler)();
    const port = Number(process.env.PORT || 3000);
    const server = app.listen(port, () => {
        console.log(`Mail service listening on :${port}`);
    });
    // graceful shutdown
    const shutdown = () => {
        console.log("Shutting down…");
        stopScheduler?.();
        server.close(() => {
            console.log("HTTP server closed");
            process.exit(0);
        });
        setTimeout(() => process.exit(0), 5000);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
