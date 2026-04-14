import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { rateLimit } from "@/lib/rateLimit";

const PHONE_REGEX = /^\+?[0-9]{7,15}$/;
const MAX_NAME_LEN = 80;
const MAX_ADDRESS_LEN = 200;
const MAX_CITY_LEN = 80;
const MAX_DESC_LEN = 300;

export async function POST(request) {
    // Rate limit: max 5 registration attempts per IP per 10 minutes
    const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
        request.headers.get("x-real-ip") ||
        "unknown";
    const rl = rateLimit(`register:${ip}`, 5, 10 * 60_000);
    if (!rl.allowed) {
        return NextResponse.json(
            { error: "محاولات كثيرة. حاول مجدداً بعد قليل" },
            {
                status: 429,
                headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
            }
        );
    }

    let userRecord = null;
    try {
        const { name, phone, password, address, city, locationDesc, locationCoords } = await request.json();

        // Required fields
        if (!name || !phone || !password || !address) {
            return NextResponse.json({ error: "جميع الحقول مطلوبة" }, { status: 400 });
        }

        // Length limits
        if (name.trim().length > MAX_NAME_LEN) {
            return NextResponse.json({ error: "الاسم طويل جداً" }, { status: 400 });
        }
        if (address.trim().length > MAX_ADDRESS_LEN) {
            return NextResponse.json({ error: "العنوان طويل جداً" }, { status: 400 });
        }
        if (city && city.trim().length > MAX_CITY_LEN) {
            return NextResponse.json({ error: "اسم المدينة طويل جداً" }, { status: 400 });
        }
        if (locationDesc && locationDesc.trim().length > MAX_DESC_LEN) {
            return NextResponse.json({ error: "وصف الموقع طويل جداً" }, { status: 400 });
        }

        // Phone format
        const cleanPhone = phone.trim().replace(/\s/g, "");
        if (!PHONE_REGEX.test(cleanPhone)) {
            return NextResponse.json({ error: "رقم الهاتف غير صالح" }, { status: 400 });
        }

        // Password length
        if (password.length < 6) {
            return NextResponse.json(
                { error: "كلمة السر يجب أن تكون 6 أحرف على الأقل" },
                { status: 400 }
            );
        }

        // Validate locationCoords shape if provided
        if (locationCoords !== undefined && locationCoords !== null) {
            if (
                typeof locationCoords !== "object" ||
                typeof locationCoords.lat !== "number" ||
                typeof locationCoords.lng !== "number"
            ) {
                return NextResponse.json({ error: "إحداثيات الموقع غير صالحة" }, { status: 400 });
            }
        }

        // Check if phone already registered in Firestore
        const existing = await adminDb
            .collection("users")
            .where("phone", "==", cleanPhone)
            .limit(1)
            .get();

        if (!existing.empty) {
            return NextResponse.json(
                { error: "رقم الهاتف مسجل بالفعل. يرجى تسجيل الدخول" },
                { status: 409 }
            );
        }

        // Create user in Firebase Authentication
        const email = `${cleanPhone}@yaslamo.app`;
        userRecord = await adminAuth.createUser({
            email,
            password,
            displayName: name.trim(),
        });

        // Save profile in Firestore (NO password stored)
        // If this fails we rollback by deleting the Auth user
        await adminDb.collection("users").doc(userRecord.uid).set({
            name: name.trim(),
            phone: cleanPhone,
            address: address.trim(),
            city: city?.trim() || "",
            locationDesc: locationDesc?.trim() || "",
            locationCoords: locationCoords || null,
            role: "customer",
            createdAt: FieldValue.serverTimestamp(),
        });

        return NextResponse.json(
            {
                message: "تم إنشاء الحساب بنجاح",
                user: {
                    id: userRecord.uid,
                    name: name.trim(),
                    phone: cleanPhone,
                    address: address.trim(),
                    city: city?.trim() || "",
                    locationDesc: locationDesc?.trim() || "",
                    locationCoords: locationCoords || null,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Register error:", error);

        // Firebase Auth error codes
        if (error.code === "auth/email-already-exists") {
            return NextResponse.json(
                { error: "رقم الهاتف مسجل بالفعل. يرجى تسجيل الدخول" },
                { status: 409 }
            );
        }

        // Rollback: if Auth user was created but Firestore write failed, delete the Auth user
        // so the account doesn't get permanently stuck in a broken state
        if (userRecord) {
            try {
                await adminAuth.deleteUser(userRecord.uid);
            } catch (rollbackErr) {
                console.error("Rollback failed — orphaned Auth user:", userRecord.uid, rollbackErr);
            }
        }

        return NextResponse.json({ error: "حدث خطأ في إنشاء الحساب" }, { status: 500 });
    }
}
