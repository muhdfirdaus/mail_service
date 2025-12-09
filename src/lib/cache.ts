// src/lib/cache.ts
import crypto from "crypto";

type Entry<T> = { value: T; expiresAt: number; etag?: string };

class TinyCache {
  private store = new Map<string, Entry<any>>();

  get<T>(key: string): Entry<T>["value"] | undefined {
    const hit = this.store.get(key);
    if (!hit) return;
    if (Date.now() > hit.expiresAt) {
      this.store.delete(key);
      return;
    }
    return hit.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number, etag?: string) {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs, etag });
  }

  getETag(key: string) {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return hit.etag;
  }

  bust(prefix: string) {
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) this.store.delete(k);
    }
  }
}

export const cache = new TinyCache();
export const GLOBAL_MAILS_CACHE_PREFIX = "global-mails:";

export function makeETag(parts: (string | number | null | undefined)[]) {
  const s = parts.map(x => (x ?? "")).join("|");
  const h = crypto.createHash("sha256").update(s).digest("hex");
  return `"${h}"`; // quoted per RFC
}

// centralised cache bust helper used by routes + scheduler
export function bustGlobalMailsCache() {
  cache.bust(GLOBAL_MAILS_CACHE_PREFIX);
}
