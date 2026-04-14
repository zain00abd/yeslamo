/**
 * In-memory rate limiter with lazy cleanup.
 *
 * Works for single-process deployments (dev, Docker, Node server).
 * For multi-instance / serverless edge deployments, replace the store
 * with Upstash Redis (@upstash/ratelimit + @upstash/redis).
 */

const store = new Map();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 5 * 60_000;

function lazyCleanup() {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
    lastCleanup = now;
    for (const [key, entry] of store.entries()) {
        if (now > entry.resetAt) store.delete(key);
    }
}

/**
 * @param {string} key      - Unique identifier (e.g. IP + route)
 * @param {number} limit    - Max requests allowed in the window
 * @param {number} windowMs - Window duration in milliseconds
 * @returns {{ allowed: boolean, remaining: number, resetAt: number }}
 */
export function rateLimit(key, limit = 10, windowMs = 60_000) {
    lazyCleanup();

    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
    }

    entry.count += 1;

    if (entry.count > limit) {
        return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

/**
 * Reads the most trustworthy client IP from the request.
 * Takes the LAST entry in x-forwarded-for (closest proxy) to resist spoofing,
 * unless running behind a single trusted proxy (then first entry is correct).
 * Falls back to x-real-ip, then "unknown".
 */
export function getClientIp(request) {
    const xff = request.headers.get("x-forwarded-for");
    if (xff) {
        const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
        // In most setups with a single trusted reverse proxy (Vercel, nginx),
        // the proxy appends the real client IP as the rightmost entry.
        // If you use multiple trusted proxies, adjust the index accordingly.
        return parts[parts.length - 1] || "unknown";
    }
    return request.headers.get("x-real-ip") || "unknown";
}
