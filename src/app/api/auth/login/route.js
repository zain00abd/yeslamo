import { NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { normalizePhone } from "@/lib/auth/profileValidation";

const WINDOW_MS = 15 * 60_000;
const IP_LIMIT = 20;
const PHONE_LIMIT = 8;

/**
 * Server-side gate for login: enforces rate limits before the client
 * performs the actual Firebase signInWithEmailAndPassword call.
 * Returns { ok: true } if the attempt is allowed, or 429 if blocked.
 */
export async function POST(request) {
    const ip = getClientIp(request);
    const ipRl = rateLimit(`login:ip:${ip}`, IP_LIMIT, WINDOW_MS);
    if (!ipRl.allowed) {
        return NextResponse.json(
            { error: "محاولات كثيرة. حاول مجدداً بعد قليل" },
            {
                status: 429,
                headers: { "Retry-After": String(Math.ceil((ipRl.resetAt - Date.now()) / 1000)) },
            }
        );
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
    }

    const phone = normalizePhone(body?.phone);
    if (!phone) {
        return NextResponse.json({ error: "رقم الهاتف مطلوب" }, { status: 400 });
    }

    const phoneRl = rateLimit(`login:phone:${phone}`, PHONE_LIMIT, WINDOW_MS);
    if (!phoneRl.allowed) {
        return NextResponse.json(
            { error: "محاولات كثيرة. حاول مجدداً بعد قليل" },
            {
                status: 429,
                headers: { "Retry-After": String(Math.ceil((phoneRl.resetAt - Date.now()) / 1000)) },
            }
        );
    }

    return NextResponse.json({ ok: true });
}
