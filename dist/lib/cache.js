"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GLOBAL_MAILS_CACHE_PREFIX = exports.cache = void 0;
exports.makeETag = makeETag;
exports.bustGlobalMailsCache = bustGlobalMailsCache;
// src/lib/cache.ts
const crypto_1 = __importDefault(require("crypto"));
class TinyCache {
    constructor() {
        this.store = new Map();
    }
    get(key) {
        const hit = this.store.get(key);
        if (!hit)
            return;
        if (Date.now() > hit.expiresAt) {
            this.store.delete(key);
            return;
        }
        return hit.value;
    }
    set(key, value, ttlMs, etag) {
        this.store.set(key, { value, expiresAt: Date.now() + ttlMs, etag });
    }
    getETag(key) {
        const hit = this.store.get(key);
        if (!hit)
            return undefined;
        if (Date.now() > hit.expiresAt) {
            this.store.delete(key);
            return undefined;
        }
        return hit.etag;
    }
    bust(prefix) {
        for (const k of this.store.keys()) {
            if (k.startsWith(prefix))
                this.store.delete(k);
        }
    }
}
exports.cache = new TinyCache();
exports.GLOBAL_MAILS_CACHE_PREFIX = "global-mails:";
function makeETag(parts) {
    const s = parts.map(x => (x ?? "")).join("|");
    const h = crypto_1.default.createHash("sha256").update(s).digest("hex");
    return `"${h}"`; // quoted per RFC
}
// centralised cache bust helper used by routes + scheduler
function bustGlobalMailsCache() {
    exports.cache.bust(exports.GLOBAL_MAILS_CACHE_PREFIX);
}
