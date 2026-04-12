import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function GET(request) {
    const { error } = await requireAdmin(request);
    if (error) return error;

    try {
        const ordersSnap = await adminDb.collection("orders").select("customerUid").limit(3000).get();
        /** @type {Record<string, number>} */
        const orderCountByCustomer = {};
        ordersSnap.docs.forEach((doc) => {
            const uid = doc.data()?.customerUid;
            if (typeof uid === "string" && uid) {
                orderCountByCustomer[uid] = (orderCountByCustomer[uid] || 0) + 1;
            }
        });

        const usersSnap = await adminDb.collection("users").limit(500).get();
        const users = usersSnap.docs.map((docSnap) => {
            const d = docSnap.data();
            const verified =
                d.customerStatus === "verified" || d.customerVerified === true || d.isVerified === true;
            return {
                id: docSnap.id,
                name: d.name || "—",
                phone: d.phone || "—",
                role: d.role || "customer",
                ordersCount: orderCountByCustomer[docSnap.id] || 0,
                isVerified: Boolean(verified),
                banned: d.banned === true,
            };
        });

        users.sort((a, b) => a.name.localeCompare(b.name, "ar"));
        return NextResponse.json({ users });
    } catch (e) {
        console.error("admin users:", e);
        return NextResponse.json({ error: "تعذر تحميل المستخدمين" }, { status: 500 });
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
    const banned = body.banned;
    if (!userId || typeof banned !== "boolean") {
        return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    try {
        const ref = adminDb.collection("users").doc(userId);
        const snap = await ref.get();
        if (!snap.exists) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
        await ref.update({
            banned,
            updatedAt: FieldValue.serverTimestamp(),
        });
        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error("admin user ban:", e);
        return NextResponse.json({ error: "تعذر التحديث" }, { status: 500 });
    }
}
