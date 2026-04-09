import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAuthUid } from "@/lib/serverAuth";

// GET /api/orders/my?uid=<customerUid>  — returns the latest active order for the customer
export async function GET(request) {
    try {
        const { uid: authUid, error: authError } = await requireAuthUid(request);
        if (authError) return authError;

        const { searchParams } = new URL(request.url);
        const uid = searchParams.get("uid");

        if (!uid) {
            return NextResponse.json({ error: "uid مطلوب" }, { status: 400 });
        }
        if (uid !== authUid) {
            return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
        }

        // Get the most recent non-cancelled order for this customer
        const snapshot = await adminDb
            .collection("orders")
            .where("customerUid", "==", uid)
            .orderBy("createdAt", "desc")
            .limit(10)
            .get();

        if (snapshot.empty) {
            return NextResponse.json({ order: null });
        }

        // Find the latest order that is active (not cancelled)
        // Priority: pending > accepted > on_the_way > delivered
        const PRIORITY = { pending: 4, accepted: 3, on_the_way: 2, delivered: 1 };
        let activeOrder = null;
        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            if (data.status === "cancelled") continue;
            if (!activeOrder) {
                activeOrder = { id: docSnap.id, ...data };
            } else if ((PRIORITY[data.status] || 0) > (PRIORITY[activeOrder.status] || 0)) {
                activeOrder = { id: docSnap.id, ...data };
            }
        }

        if (!activeOrder) {
            return NextResponse.json({ order: null });
        }

        return NextResponse.json({
            order: {
                ...activeOrder,
                createdAt: activeOrder.createdAt?.toDate?.()?.toISOString() || null,
                updatedAt: activeOrder.updatedAt?.toDate?.()?.toISOString() || null,
                expiresAt: activeOrder.expiresAt?.toDate?.()?.toISOString() || null,
            },
        });
    } catch (error) {
        console.error("fetch my order error:", error);
        return NextResponse.json({ error: "خطأ في جلب الطلب" }, { status: 500 });
    }
}
