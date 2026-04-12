import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/auth/require-admin";
import { serializeDoc } from "@/lib/admin/firestoreSerialize";

const ALLOWED = new Set(["pending", "accepted", "on_the_way", "delivered", "cancelled"]);

export async function GET(request, context) {
    const { error } = await requireAdmin(request);
    if (error) return error;

    const params = await context.params;
    const id = params.id;
    if (!id) return NextResponse.json({ error: "معرّف ناقص" }, { status: 400 });

    try {
        const ref = adminDb.collection("orders").doc(id);
        const snap = await ref.get();
        if (!snap.exists) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
        const data = serializeDoc(snap.data());
        let driverName = null;
        if (data.driverId) {
            const du = await adminDb.collection("users").doc(data.driverId).get();
            driverName = du.exists ? du.data()?.name || null : null;
        }
        return NextResponse.json({ order: { id: snap.id, ...data, driverName } });
    } catch (e) {
        console.error("admin order get:", e);
        return NextResponse.json({ error: "خطأ" }, { status: 500 });
    }
}

export async function PATCH(request, context) {
    const { error } = await requireAdmin(request);
    if (error) return error;

    const params = await context.params;
    const id = params.id;
    if (!id) return NextResponse.json({ error: "معرّف ناقص" }, { status: 400 });

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "جسم غير صالح" }, { status: 400 });
    }

    const status = typeof body.status === "string" ? body.status.trim() : "";
    if (!status || !ALLOWED.has(status)) {
        return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
    }

    try {
        await adminDb.collection("orders").doc(id).update({
            status,
            updatedAt: FieldValue.serverTimestamp(),
        });
        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error("admin order patch:", e);
        return NextResponse.json({ error: "تعذر التحديث" }, { status: 500 });
    }
}
