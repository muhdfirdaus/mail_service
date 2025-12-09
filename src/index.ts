import dotenvFlow from "dotenv-flow";
dotenvFlow.config({
  node_env: process.env.APP_ENV || "develop", // develop | qa | staging | production
  silent: true
});

import "dotenv/config";
import express from "express";
import { connectAll } from "./db";
import globalMails from "./routes/globalMails";
import playerInbox from "./routes/playerInbox";
import { startScheduler } from "./scheduler";
import mongoose from "mongoose";

async function main() {
    await connectAll();

    const app = express();
    app.use(express.json());
    app.set("trust proxy", 1);

    app.get("/healthz", (_req, res) => res.json({ ok: true }));

    app.use("/global-mails", globalMails);
    app.use("/players", playerInbox);

    const stopScheduler = startScheduler();

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
