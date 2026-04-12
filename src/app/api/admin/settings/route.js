import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/auth/require-admin";

const DOC = { collection: "app_settings", id: "config" };

const DEFAULTS = {
    workingHoursStart: "08:00",
    workingHoursEnd: "22:00",
    maxOrdersPerDriver: 2,
    supportPhone: "",
};

export async function GET(request) {
    const { error } = await requireAdmin(request);
    if (error) return error;

    try {
        const ref = adminDb.collection(DOC.collection).doc(DOC.id);
        const snap = await ref.get();
        const data = snap.exists ? snap.data() : {};
        return NextResponse.json({
            settings: {
                ...DEFAULTS,
                ...data,
                workingHoursStart: data.workingHoursStart ?? DEFAULTS.workingHoursStart,
                workingHoursEnd: data.workingHoursEnd ?? DEFAULTS.workingHoursEnd,
                maxOrdersPerDriver: data.maxOrdersPerDriver ?? DEFAULTS.maxOrdersPerDriver,
                supportPhone: data.supportPhone ?? DEFAULTS.supportPhone,
            },
        });
    } catch (e) {
        console.error("admin settings get:", e);
        return NextResponse.json({ error: "تعذر التحميل" }, { status: 500 });
    }
}

export async function PUT(request) {
    const { error } = await requireAdmin(request);
    if (error) return error;

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "جسم غير صالح" }, { status: 400 });
    }

    const workingHoursStart = typeof body.workingHoursStart === "string" ? body.workingHoursStart.trim() : "";
    const workingHoursEnd = typeof body.workingHoursEnd === "string" ? body.workingHoursEnd.trim() : "";
    const maxOrdersPerDriver = Number(body.maxOrdersPerDriver);
    const supportPhone = typeof body.supportPhone === "string" ? body.supportPhone.trim() : "";

    if (!workingHoursStart || !workingHoursEnd) {
        return NextResponse.json({ error: "أوقات العمل مطلوبة" }, { status: 400 });
    }
    if (!Number.isFinite(maxOrdersPerDriver) || maxOrdersPerDriver < 1 || maxOrdersPerDriver > 50) {
        return NextResponse.json({ error: "حد الطلبات غير صالح" }, { status: 400 });
    }

    try {
        const ref = adminDb.collection(DOC.collection).doc(DOC.id);
        await ref.set(
            {
                workingHoursStart,
                workingHoursEnd,
                maxOrdersPerDriver: Math.floor(maxOrdersPerDriver),
                supportPhone,
                updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
        );
        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error("admin settings put:", e);
        return NextResponse.json({ error: "تعذر الحفظ" }, { status: 500 });
    }
}
