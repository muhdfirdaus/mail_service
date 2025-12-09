"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameDB = exports.mailDB = void 0;
exports.connectAll = connectAll;
const mongoose_1 = __importDefault(require("mongoose"));
exports.mailDB = mongoose_1.default.createConnection(process.env.MONGO_MAIL_URI, {
    retryWrites: true,
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: 20000
});
exports.gameDB = mongoose_1.default.createConnection(process.env.MONGO_GAME_URI, {
    retryWrites: true,
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: 20000
});
exports.mailDB.on("connected", () => console.log("[mail-db] connected"));
exports.gameDB.on("connected", () => console.log("[game-db] connected"));
async function connectAll() {
    await Promise.all([exports.mailDB.asPromise(), exports.gameDB.asPromise()]);
}
