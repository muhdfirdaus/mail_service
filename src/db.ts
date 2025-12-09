import mongoose from "mongoose";

export const mailDB = mongoose.createConnection(process.env.MONGO_MAIL_URI!, {
  retryWrites: true,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 20000
});

export const gameDB = mongoose.createConnection(process.env.MONGO_GAME_URI!, {
  retryWrites: true,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 20000
});

mailDB.on("connected", () => console.log("[mail-db] connected"));
gameDB.on("connected", () => console.log("[game-db] connected"));

export async function connectAll() {
  await Promise.all([mailDB.asPromise(), gameDB.asPromise()]);
}
