import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
    DRIVER_CITY_OPTIONS,
    DRIVER_VEHICLE_OPTIONS,
    DRIVER_AGE_MIN,
    DRIVER_AGE_MAX,
} from "@/lib/admin/driverConstants";
import { allocateDriverAccountNumber } from "@/lib/admin/allocateDriverAccountNumber";

async function buildDriverRow(docSnap) {
    const d = docSnap.data();
    const oc = await adminDb.collection("orders").where("driverId", "==", docSnap.id).count().get();
    const walletRaw = d.walletBalanceSyp;
    const walletBalanceSyp = typeof walletRaw === "number" && !Number.isNaN(walletRaw) ? walletRaw : 0;

    return {
        id: docSnap.id,
        name: d.name || "—",
        nickname: d.nickname || "",
        age: typeof d.age === "number" ? d.age : d.driverAge ?? null,
        phone: d.phone || "—",
        driverAccountNumber: d.driverAccountNumber || "",
        city: d.city || d.area || "—",
        area: d.area || d.city || "default",
        vehicleType: d.vehicleType || "—",
        isAvailable: d.driverAvailable !== false,
        driverEnabled: d.driverEnabled !== false,
        totalOrders: oc.data().count,
        walletBalanceSyp,
    };
}

export async function GET(request) {
    const { error } = await requireAdmin(request);
    if (error) return error;

    try {
        const qRaw = request.nextUrl.searchParams.get("q")?.trim() || "";
        const digitsOnly = qRaw.replace(/\D/g, "");

        /** بحث برقم الحساب (8 أرقام بالضبط) */
        if (digitsOnly.length === 8) {
            const matchSnap = await adminDb
                .collection("users")
                .where("driverAccountNumber", "==", digitsOnly)
                .limit(10)
                .get();

            const drivers = [];
            for (const docSnap of matchSnap.docs) {
                const d = docSnap.data();
                if (d.role !== "driver") continue;
                drivers.push(await buildDriverRow(docSnap));
            }
            return NextResponse.json({ drivers, searchMode: "account" });
        }

        const snap = await adminDb.collection("users").where("role", "==", "driver").limit(200).get();

        /** تعيين رقم حساب للمندوبين القدامى (حد أقصى 15 طلباً لتفادي البطء) */
        const missing = snap.docs.filter((doc) => {
            const d = doc.data();
            return d.role === "driver" && !d.driverAccountNumber;
        });
        for (const doc of missing.slice(0, 15)) {
            try {
                const num = await allocateDriverAccountNumber();
                await doc.ref.update({
                    driverAccountNumber: num,
                    updatedAt: FieldValue.serverTimestamp(),
                });
            } catch (e) {
                console.error("ensure driverAccountNumber:", e);
            }
        }

        const refreshed = missing.length
            ? await adminDb.collection("users").where("role", "==", "driver").limit(200).get()
            : snap;

        const drivers = [];
        for (const docSnap of refreshed.docs) {
            drivers.push(await buildDriverRow(docSnap));
        }

        drivers.sort((a, b) => a.name.localeCompare(b.name, "ar"));
        return NextResponse.json({ drivers });
    } catch (e) {
        console.error("admin drivers:", e);
        return NextResponse.json({ error: "تعذر تحميل المندوبين" }, { status: 500 });
    }
}

/**
 * إنشاء حساب مندوب (Auth + Firestore) — من لوحة الإدارة فقط.
 */
export async function POST(request) {
    const { error } = await requireAdmin(request);
    if (error) return error;

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "جسم غير صالح" }, { status: 400 });
    }

    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
    const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const city = typeof body.city === "string" ? body.city.trim() : "";
    const vehicleType = typeof body.vehicleType === "string" ? body.vehicleType.trim() : "";
    const age = Number(body.age);

    if (!firstName || !nickname || !phone || !password) {
        return NextResponse.json({ error: "الاسم والكنية والهاتف وكلمة السر مطلوبة" }, { status: 400 });
    }
    if (password.length < 6) {
        return NextResponse.json({ error: "كلمة السر 6 أحرف على الأقل" }, { status: 400 });
    }
    if (!Number.isFinite(age) || age < DRIVER_AGE_MIN || age > DRIVER_AGE_MAX) {
        return NextResponse.json(
            { error: `العمر يجب أن يكون بين ${DRIVER_AGE_MIN} و ${DRIVER_AGE_MAX}` },
            { status: 400 }
        );
    }
    if (!DRIVER_CITY_OPTIONS.includes(city)) {
        return NextResponse.json({ error: "المدينة غير صالحة" }, { status: 400 });
    }
    if (!DRIVER_VEHICLE_OPTIONS.includes(vehicleType)) {
        return NextResponse.json({ error: "وسيلة التوصيل غير صالحة" }, { status: 400 });
    }

    const email = `${phone.replace(/\s/g, "")}@yaslamo.app`;

    try {
        const existing = await adminDb.collection("users").where("phone", "==", phone).limit(1).get();
        if (!existing.empty) {
            return NextResponse.json({ error: "رقم الهاتف مسجّل مسبقاً" }, { status: 409 });
        }

        const displayName = `${firstName} ${nickname}`.trim();
        const userRecord = await adminAuth.createUser({
            email,
            password,
            displayName,
        });

        const driverAccountNumber = await allocateDriverAccountNumber();

        await adminDb.collection("users").doc(userRecord.uid).set({
            name: firstName,
            nickname,
            age: Math.floor(age),
            phone,
            driverAccountNumber,
            city,
            /** يبقى default ليتطابق مع استعلام الطلبات في تطبيق المندوب (areaId) */
            area: "default",
            address: city,
            vehicleType,
            role: "driver",
            walletBalanceSyp: 0,
            driverEnabled: true,
            driverAvailable: true,
            createdAt: FieldValue.serverTimestamp(),
            createdByAdmin: true,
        });

        return NextResponse.json({
            ok: true,
            userId: userRecord.uid,
            driverAccountNumber,
        });
    } catch (e) {
        console.error("admin create driver:", e);
        if (e.code === "auth/email-already-exists") {
            return NextResponse.json({ error: "البريد/الهاتف مسجّل في المصادقة" }, { status: 409 });
        }
        return NextResponse.json({ error: "تعذر إنشاء المندوب" }, { status: 500 });
    }
}

export async function PATCH(request) {
    const { error } = await requireAdmin(request);
    if (error) return error;

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "جسم غير صالح" }, { status: 400 });
    }

    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const driverEnabled = body.driverEnabled;
    if (!userId || typeof driverEnabled !== "boolean") {
        return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    try {
        const ref = adminDb.collection("users").doc(userId);
        const snap = await ref.get();
        if (!snap.exists) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
        if (snap.data()?.role !== "driver") {
            return NextResponse.json({ error: "ليس مندوباً" }, { status: 400 });
        }
        await ref.update({
            driverEnabled,
            updatedAt: FieldValue.serverTimestamp(),
        });
        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error("admin driver patch:", e);
        return NextResponse.json({ error: "تعذر التحديث" }, { status: 500 });
    }
}
