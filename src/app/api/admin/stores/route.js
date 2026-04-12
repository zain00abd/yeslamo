import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/auth/require-admin";
import { serializeDoc } from "@/lib/admin/firestoreSerialize";

export async function GET(request) {
    const { error } = await requireAdmin(request);
    if (error) return error;

    try {
        const snap = await adminDb.collection("stores").limit(200).get();
        const stores = snap.docs
            .map((docSnap) => ({
                id: docSnap.id,
                ...serializeDoc(docSnap.data()),
            }))
            .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
        return NextResponse.json({ stores });
    } catch (e) {
        console.error("admin stores:", e);
        return NextResponse.json({ error: "تعذر تحميل المتاجر" }, { status: 500 });
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

    const storeId = typeof body.storeId === "string" ? body.storeId.trim() : "";
    const isActive = body.isActive;
    if (!storeId || typeof isActive !== "boolean") {
        return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    try {
        await adminDb
            .collection("stores")
            .doc(storeId)
            .update({ isActive, updatedAt: FieldValue.serverTimestamp() });
        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error("admin store patch:", e);
        return NextResponse.json({ error: "تعذر التحديث" }, { status: 500 });
    }
}
