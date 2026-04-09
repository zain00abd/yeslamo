import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAuthUid } from "@/lib/serverAuth";

// GET /api/orders/recent?uid=<customerUid> — أحدث طلب (أي حالة) لعرض ملخص خفيف في الواجهة
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

        const snapshot = await adminDb
            .collection("orders")
            .where("customerUid", "==", uid)
            .orderBy("createdAt", "desc")
            .limit(1)
            .get();

        if (snapshot.empty) {
            return NextResponse.json({ order: null });
        }

        const docSnap = snapshot.docs[0];
        const data = docSnap.data();
        const items = Array.isArray(data.items) ? data.items : [];
        const names = items.map((i) => (i.name || "").trim()).filter(Boolean);
        const preview =
            names.length === 0
                ? ""
                : names.length <= 2
                  ? names.join("، ")
                  : `${names.slice(0, 2).join("، ")} +${names.length - 2}`;

        return NextResponse.json({
            order: {
                id: docSnap.id,
                orderNumber: data.orderNumber || "",
                status: data.status || "",
                createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
                itemsCount: items.length,
                itemsPreview: preview,
            },
        });
    } catch (error) {
        console.error("fetch recent order error:", error);
        return NextResponse.json({ error: "خطأ في جلب الطلب" }, { status: 500 });
    }
}
