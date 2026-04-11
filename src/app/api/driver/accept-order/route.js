import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireAuthUid } from "@/lib/serverAuth";
import {
    DEFAULT_DELIVERY_FEE_SYP,
    DRIVER_DELIVERY_COMMISSION_RATE,
    DRIVER_MAX_ACTIVE_ORDERS_BEFORE_ACCEPT,
} from "@/lib/orderPricing";

/**
 * قبول طلب من المندوب: خصم 20% من رسوم التوصيل من رصيد المحفظة (آمن عبر Admin SDK).
 */
export async function POST(request) {
    const { uid, error: authError } = await requireAuthUid(request);
    if (authError) return authError;

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
    }

    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    if (!orderId) {
        return NextResponse.json({ error: "معرّف الطلب مطلوب" }, { status: 400 });
    }

    try {
        await adminDb.runTransaction(async (t) => {
            const orderRef = adminDb.collection("orders").doc(orderId);
            const userRef = adminDb.collection("users").doc(uid);

            const orderSnap = await t.get(orderRef);
            const userSnap = await t.get(userRef);

            if (!orderSnap.exists) {
                throw new Error("ORDER_NOT_FOUND");
            }
            if (!userSnap.exists) {
                throw new Error("USER_NOT_FOUND");
            }

            const order = orderSnap.data();
            const profile = userSnap.data();

            if (profile.role !== "driver") {
                throw new Error("NOT_DRIVER");
            }
            if (order.status !== "pending") {
                throw new Error("ORDER_NOT_PENDING");
            }
            if (order.areaId !== "default") {
                throw new Error("ORDER_AREA");
            }
            if (order.driverId != null && order.driverId !== "") {
                throw new Error("ORDER_TAKEN");
            }

            const activeOrdersQuery = adminDb
                .collection("orders")
                .where("driverId", "==", uid)
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
            const balance =
                typeof balanceRaw === "number" && !Number.isNaN(balanceRaw) ? balanceRaw : 0;

            if (balance < commission) {
                throw new Error("INSUFFICIENT_BALANCE");
            }

            const newBalance = Math.round((balance - commission) * 100) / 100;

            t.update(orderRef, {
                status: "accepted",
                driverId: uid,
                acceptCommissionSyp: commission,
                deliveryFeeAtAcceptSyp: deliveryFee,
                updatedAt: FieldValue.serverTimestamp(),
            });

            t.update(userRef, {
                walletBalanceSyp: newBalance,
                walletLastDeductionAt: FieldValue.serverTimestamp(),
            });
        });

        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error("accept-order:", e);
        const code = e?.message || "";
        if (code === "INSUFFICIENT_BALANCE") {
            return NextResponse.json(
                {
                    error: "رصيدك غير كافٍ لقبول هذا الطلب. يُخصم 20% من رسوم التوصيل عند كل قبول. تواصل مع الإدارة لشحن الرصيد.",
                    code: "INSUFFICIENT_BALANCE",
                },
                { status: 402 }
            );
        }
        if (code === "DRIVER_ACTIVE_ORDER_LIMIT") {
            return NextResponse.json(
                {
                    error: `لديك ${DRIVER_MAX_ACTIVE_ORDERS_BEFORE_ACCEPT} طلبات لم تُسلَّم بعد. أنهِ أحدها قبل قبول طلب جديد.`,
                    code: "DRIVER_ACTIVE_ORDER_LIMIT",
                },
                { status: 409 }
            );
        }
        if (code === "ORDER_NOT_PENDING" || code === "ORDER_TAKEN") {
            return NextResponse.json(
                { error: "الطلب غير متاح (تم قبوله أو إلغاؤه)." },
                { status: 409 }
            );
        }
        if (code === "NOT_DRIVER") {
            return NextResponse.json({ error: "هذا الحساب ليس مندوباً." }, { status: 403 });
        }
        if (code === "ORDER_NOT_FOUND" || code === "USER_NOT_FOUND") {
            return NextResponse.json({ error: "البيانات غير موجودة." }, { status: 404 });
        }
        return NextResponse.json({ error: "تعذر قبول الطلب. حاول مرة أخرى." }, { status: 500 });
    }
}
