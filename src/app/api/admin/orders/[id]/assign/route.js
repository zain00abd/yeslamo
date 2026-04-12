import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
    DEFAULT_DELIVERY_FEE_SYP,
    DRIVER_DELIVERY_COMMISSION_RATE,
    DRIVER_MAX_ACTIVE_ORDERS_BEFORE_ACCEPT,
} from "@/lib/orderPricing";

/**
 * تعيين مندوب للطلب (نفس منطق قبول الطلب: خصم العمولة من محفظة المندوب).
 */
export async function POST(request, context) {
    const { error } = await requireAdmin(request);
    if (error) return error;

    const params = await context.params;
    const orderId = params.id;
    if (!orderId) return NextResponse.json({ error: "معرّف الطلب ناقص" }, { status: 400 });

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "جسم غير صالح" }, { status: 400 });
    }

    const driverId = typeof body.driverId === "string" ? body.driverId.trim() : "";
    if (!driverId) return NextResponse.json({ error: "معرّف المندوب مطلوب" }, { status: 400 });

    try {
        await adminDb.runTransaction(async (t) => {
            const orderRef = adminDb.collection("orders").doc(orderId);
            const driverRef = adminDb.collection("users").doc(driverId);

            const orderSnap = await t.get(orderRef);
            const driverSnap = await t.get(driverRef);

            if (!orderSnap.exists) throw new Error("ORDER_NOT_FOUND");
            if (!driverSnap.exists) throw new Error("DRIVER_NOT_FOUND");

            const order = orderSnap.data();
            const profile = driverSnap.data();

            if (profile.role !== "driver") throw new Error("NOT_DRIVER");
            if (profile.driverEnabled === false) throw new Error("DRIVER_DISABLED");
            if (order.status !== "pending") throw new Error("ORDER_NOT_PENDING");
            if (order.driverId && order.driverId !== "") throw new Error("ORDER_TAKEN");

            const activeOrdersQuery = adminDb
                .collection("orders")
                .where("driverId", "==", driverId)
                .where("status", "in", ["accepted", "on_the_way"]);
            const activeSnap = await t.get(activeOrdersQuery);
            if (activeSnap.size >= DRIVER_MAX_ACTIVE_ORDERS_BEFORE_ACCEPT) {
                throw new Error("DRIVER_ACTIVE_ORDER_LIMIT");
            }

            const deliveryFee =
                typeof order.deliveryFeeSyp === "number" && !Number.isNaN(order.deliveryFeeSyp) && order.deliveryFeeSyp >= 0
                    ? order.deliveryFeeSyp
                    : DEFAULT_DELIVERY_FEE_SYP;

            const commission = Math.round(deliveryFee * DRIVER_DELIVERY_COMMISSION_RATE * 100) / 100;
            const balanceRaw = profile.walletBalanceSyp;
            const balance = typeof balanceRaw === "number" && !Number.isNaN(balanceRaw) ? balanceRaw : 0;

            if (balance < commission) throw new Error("INSUFFICIENT_BALANCE");

            const newBalance = Math.round((balance - commission) * 100) / 100;

            t.update(orderRef, {
                status: "accepted",
                driverId,
                acceptCommissionSyp: commission,
                deliveryFeeAtAcceptSyp: deliveryFee,
                assignedByAdmin: true,
                updatedAt: FieldValue.serverTimestamp(),
            });

            t.update(driverRef, {
                walletBalanceSyp: newBalance,
                walletLastDeductionAt: FieldValue.serverTimestamp(),
            });
        });

        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error("admin assign:", e);
        const code = e?.message || "";
        const map = {
            INSUFFICIENT_BALANCE: { status: 402, msg: "رصيد المندوب غير كافٍ لهذا الطلب." },
            DRIVER_ACTIVE_ORDER_LIMIT: { status: 409, msg: "المندوب لديه الحد الأقصى من الطلبات النشطة." },
            ORDER_NOT_PENDING: { status: 409, msg: "الطلب غير قابل للتعيين." },
            ORDER_TAKEN: { status: 409, msg: "الطلب مُسند مسبقاً." },
            NOT_DRIVER: { status: 400, msg: "المستخدم ليس مندوباً." },
            DRIVER_DISABLED: { status: 400, msg: "المندوب معطّل." },
            ORDER_NOT_FOUND: { status: 404, msg: "الطلب غير موجود." },
            DRIVER_NOT_FOUND: { status: 404, msg: "المندوب غير موجود." },
        };
        if (map[code]) {
            return NextResponse.json({ error: map[code].msg }, { status: map[code].status });
        }
        return NextResponse.json({ error: "تعذر التعيين" }, { status: 500 });
    }
}
