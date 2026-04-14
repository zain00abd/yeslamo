import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

function readBearerToken(request) {
    const header = request.headers.get("authorization") || request.headers.get("Authorization");
    if (!header || !header.startsWith("Bearer ")) return null;
    const token = header.slice(7).trim();
    return token || null;
}

export async function requireAuthUid(request) {
    const token = readBearerToken(request);
    if (!token) {
        return {
            uid: null,
            error: NextResponse.json({ error: "غير مصرح" }, { status: 401 }),
        };
    }

    try {
        const decoded = await adminAuth.verifyIdToken(token, true);
        return { uid: decoded.uid, error: null };
    } catch {
        return {
            uid: null,
            error: NextResponse.json({ error: "جلسة غير صالحة" }, { status: 401 }),
        };
    }
}
