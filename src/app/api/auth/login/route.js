import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { rateLimit, getClientFingerprint } from "@/lib/rateLimit";
import { normalizePhone } from "@/lib/auth/profileValidation";

/**
 * POST /api/auth/login
 *
 * Pre-flight check before the client calls Firebase signInWithEmailAndPassword.
 * Applies rate limiting and confirms the phone is registered.
 * Does NOT verify the password and returns NO user PII.
 */
export async function POST(request) {
    // Rate limit: 10 attempts per IP per 15 minutes
    const clientKey = getClientFingerprint(request);
    const rl = rateLimit(`login:${clientKey}`, 10, 15 * 60_000);
    if (!rl.allowed) {
        return NextResponse.json(
            { error: "محاولات كثيرة. حاول مجدداً بعد قليل" },
            {
                status: 429,
                headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
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

    const email = `${phone}@yaslamo.app`;
    try {
        await adminAuth.getUserByEmail(email);
        // Phone is registered — client can proceed with Firebase sign-in
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: "رقم الهاتف غير مسجل" }, { status: 404 });
    }
}
