import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { normalizePhone, validateRegistrationPayload } from "@/lib/auth/profileValidation";

const DUPLICATE_ACCOUNT_ERROR = "تعذر إنشاء الحساب بهذه البيانات. إن كان لديك حساب، سجّل الدخول.";
const RATE_LIMIT_WINDOW_MS = 10 * 60_000;

export async function POST(request) {
    const clientKey = getClientIp(request);
    const ipLimit = rateLimit(`register:ip:${clientKey}`, 5, RATE_LIMIT_WINDOW_MS);
    if (!ipLimit.allowed) {
        return NextResponse.json(
            { error: "محاولات كثيرة. حاول مجدداً بعد قليل" },
            {
                status: 429,
                headers: { "Retry-After": String(Math.ceil((ipLimit.resetAt - Date.now()) / 1000)) },
            }
        );
    }

    let userRecord = null;
    try {
        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: "جسم الطلب غير صالح" }, { status: 400 });
        }

        const validated = validateRegistrationPayload(body);
        if (validated.error) {
            return NextResponse.json({ error: validated.error }, { status: 400 });
        }

        const { name, phone, password, address, city, locationDesc, locationCoords } = validated.data;
        const phoneLimit = rateLimit(`register:phone:${normalizePhone(phone)}`, 3, RATE_LIMIT_WINDOW_MS);
        if (!phoneLimit.allowed) {
            return NextResponse.json(
                { error: "محاولات كثيرة. حاول مجدداً بعد قليل" },
                {
                    status: 429,
                    headers: { "Retry-After": String(Math.ceil((phoneLimit.resetAt - Date.now()) / 1000)) },
                }
            );
        }

        // Create user in Firebase Auth first — email uniqueness is enforced atomically
        const email = `${phone}@yaslamo.app`;
        try {
            userRecord = await adminAuth.createUser({
                email,
                password,
                displayName: name,
            });
        } catch (authErr) {
            if (authErr.code === "auth/email-already-exists") {
                return NextResponse.json({ error: DUPLICATE_ACCOUNT_ERROR }, { status: 409 });
            }
            throw authErr;
        }

        // Save profile in Firestore using a transaction to prevent duplicates
        try {
            await adminDb.runTransaction(async (tx) => {
                const existingSnap = await tx.get(
                    adminDb.collection("users").where("phone", "==", phone).limit(1)
                );
                if (!existingSnap.empty) {
                    throw new Error("PHONE_DUPLICATE");
                }
                tx.set(adminDb.collection("users").doc(userRecord.uid), {
                    name,
                    phone,
                    address,
                    city,
                    locationDesc,
                    locationCoords,
                    role: "customer",
                    createdAt: FieldValue.serverTimestamp(),
                });
            });
        } catch (txErr) {
            // Rollback Auth user regardless of Firestore failure reason
            try { await adminAuth.deleteUser(userRecord.uid); } catch {}
            if (txErr.message === "PHONE_DUPLICATE") {
                return NextResponse.json({ error: DUPLICATE_ACCOUNT_ERROR }, { status: 409 });
            }
            throw txErr;
        }

        return NextResponse.json(
            {
                message: "تم إنشاء الحساب بنجاح",
                user: {
                    id: userRecord.uid,
                    name,
                    phone,
                    address,
                    city,
                    locationDesc,
                    locationCoords,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Register error:", error);
        return NextResponse.json({ error: "حدث خطأ في إنشاء الحساب" }, { status: 500 });
    }
}
