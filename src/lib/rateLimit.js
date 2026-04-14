/**
 * Simple in-memory rate limiter.
 *
 * Works for single-process deployments (dev, Docker, Node server).
 * For multi-instance / serverless edge deployments, replace the store
 * with Upstash Redis (@upstash/ratelimit + @upstash/redis).
 */

const store = new Map(); // key -> { count, resetAt }

/**
 * @param {string} key      - Unique identifier (e.g. IP + route)
 * @param {number} limit    - Max requests allowed in the window
 * @param {number} windowMs - Window duration in milliseconds
 * @returns {{ allowed: boolean, remaining: number, resetAt: number }}
 */
export function rateLimit(key, limit = 10, windowMs = 60_000) {
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

// Cleanup stale entries every 5 minutes to avoid memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
        if (now > entry.resetAt) store.delete(key);
    }
}, 5 * 60_000);
