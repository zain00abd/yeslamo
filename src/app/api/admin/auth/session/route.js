import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { signAdminSession, COOKIE_NAME } from "@/lib/auth/admin-session";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(request) {
    // Rate limit: max 10 attempts per IP per 15 minutes
    const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
        request.headers.get("x-real-ip") ||
        "unknown";
    const rl = rateLimit(`admin-session:${ip}`, 10, 15 * 60_000);
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

    const idToken = typeof body.idToken === "string" ? body.idToken.trim() : "";
    if (!idToken) {
        return NextResponse.json({ error: "رمز الدخول مطلوب" }, { status: 400 });
    }

    try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
        if (!userSnap.exists) {
            return NextResponse.json({ error: "الملف غير موجود" }, { status: 404 });
        }
        const role = userSnap.data()?.role;
        if (role !== "admin") {
            return NextResponse.json({ error: "هذا الحساب ليس مسؤولاً" }, { status: 403 });
        }

        let sessionJwt;
        try {
            sessionJwt = await signAdminSession(decoded.uid);
        } catch (e) {
            console.error("admin session sign:", e);
            return NextResponse.json(
                { error: "إعدادات الخادم ناقصة (ADMIN_SESSION_SECRET)" },
                { status: 503 }
            );
        }

        const res = NextResponse.json({ ok: true });
        res.cookies.set(COOKIE_NAME, sessionJwt, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
        });
        return res;
    } catch (e) {
        console.error("admin session:", e);
        return NextResponse.json({ error: "فشل التحقق من الهوية" }, { status: 401 });
    }
}
