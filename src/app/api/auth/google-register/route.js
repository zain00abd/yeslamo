import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireAuthUid } from "@/lib/serverAuth";
import { validateGoogleRegistrationPayload } from "@/lib/auth/profileValidation";
import { rateLimit, getClientFingerprint } from "@/lib/rateLimit";

const RATE_LIMIT_WINDOW_MS = 10 * 60_000;

export async function POST(request) {
    const clientKey = getClientFingerprint(request);
    const rl = rateLimit(`google-register:${clientKey}`, 5, RATE_LIMIT_WINDOW_MS);
    if (!rl.allowed) {
        return NextResponse.json(
            { error: "محاولات كثيرة. حاول مجدداً بعد قليل" },
            {
                status: 429,
                headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
            }
        );
    }

    const { uid: authUid, error: authError } = await requireAuthUid(request);
    if (authError) return authError;

    try {
        // Verify this is a Google-authenticated user
        const userRecord = await adminAuth.getUser(authUid);
        const isGoogleUser = userRecord.providerData.some(
            (p) => p.providerId === "google.com"
        );
        if (!isGoogleUser) {
            return NextResponse.json({ error: "هذا المسار مخصص لحسابات Google فقط" }, { status: 403 });
        }

        // Prevent duplicate profiles
        const existing = await adminDb.collection("users").doc(authUid).get();
        if (existing.exists) {
            return NextResponse.json({ error: "الملف الشخصي موجود بالفعل" }, { status: 409 });
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: "جسم الطلب غير صالح" }, { status: 400 });
        }

        // Use Google display name as fallback if not provided
        if (!body?.name && userRecord.displayName) {
            body = { ...body, name: userRecord.displayName };
        }

        const validated = validateGoogleRegistrationPayload(body);
        if (validated.error) {
            return NextResponse.json({ error: validated.error }, { status: 400 });
        }

        const { name, phone, address, city, locationDesc, locationCoords } = validated.data;

        await adminDb.collection("users").doc(authUid).set({
            name,
            phone,
            address,
            city,
            locationDesc,
            locationCoords,
            role: "customer",
            googleEmail: userRecord.email || null,
            createdAt: FieldValue.serverTimestamp(),
        });

        return NextResponse.json(
            {
                message: "تم إنشاء الحساب بنجاح",
                user: { id: authUid, name, phone, address, city, locationDesc, locationCoords },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Google register error:", error);
        return NextResponse.json({ error: "حدث خطأ في إنشاء الحساب" }, { status: 500 });
    }
}
