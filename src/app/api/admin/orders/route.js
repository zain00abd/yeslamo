import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { toIso, serializeDoc } from "@/lib/admin/firestoreSerialize";

export async function GET(request) {
    const { error } = await requireAdmin(request);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const area = searchParams.get("area") || "";

    try {
        const snap = await adminDb.collection("orders").orderBy("createdAt", "desc").limit(600).get();
        let rows = snap.docs.map((docSnap) => {
            const data = serializeDoc(docSnap.data());
            return { id: docSnap.id, ...data };
        });

        if (status) rows = rows.filter((r) => r.status === status);
        if (area) rows = rows.filter((r) => (r.areaId || "") === area);

        const driverIds = [...new Set(rows.map((r) => r.driverId).filter(Boolean))];
        const names = {};
        await Promise.all(
            driverIds.slice(0, 80).map(async (uid) => {
                const u = await adminDb.collection("users").doc(uid).get();
                if (u.exists) names[uid] = u.data()?.name || uid;
                else names[uid] = "—";
            })
        );

        const enriched = rows.map((r) => ({
            ...r,
            driverName: r.driverId ? names[r.driverId] || "—" : "—",
            createdAt: toIso(r.createdAt) || r.createdAt,
        }));

        return NextResponse.json({ orders: enriched });
    } catch (e) {
        console.error("admin orders list:", e);
        return NextResponse.json({ error: "تعذر تحميل الطلبات" }, { status: 500 });
    }
}
