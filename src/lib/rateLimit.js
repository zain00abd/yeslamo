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
    const headerCandidates = [
        "cf-connecting-ip",
        "x-vercel-forwarded-for",
        "true-client-ip",
        "x-real-ip",
    ];
    for (const headerName of headerCandidates) {
        const value = request.headers.get(headerName)?.trim();
        if (value) return value;
    }

    const xff = request.headers.get("x-forwarded-for");
    if (xff) {
        const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
        // Prefer the left-most value as the original client in standard proxy chains.
        // If your infra defines another trusted position, adapt this selection.
        return parts[0] || "unknown";
    }
    return "unknown";
}

/**
 * Builds a slightly stronger client key for rate limiting by combining
 * network identity with a coarse user agent fingerprint.
 */
export function getClientFingerprint(request) {
    const ip = getClientIp(request);
    const userAgent = (request.headers.get("user-agent") || "ua:unknown").slice(0, 160);
    return `${ip}|${userAgent}`;
}
