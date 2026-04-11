import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireAuthUid } from "@/lib/serverAuth";
import { DEFAULT_DELIVERY_FEE_SYP } from "@/lib/orderPricing";

function generateOrderNumber() {
    const num = Math.floor(1000 + Math.random() * 9000);
    return `ORD-${num}`;
}

export async function POST(request) {
    try {
        const { uid: authUid, error: authError } = await requireAuthUid(request);
        if (authError) return authError;

        const body = await request.json();
        const { customerName, customerPhone, customerAddress, customerUid, items, notes, areaId, locationCoords, locationDesc } = body;

        if (!customerName || !customerPhone || !customerAddress || !items || items.length === 0) {
            return NextResponse.json(
                { error: "جميع المعلومات المطلوبة (الاسم، الهاتف، العنوان، الطلبات) يجب توفرها" },
                { status: 400 }
            );
        }
        if (customerUid && customerUid !== authUid) {
            return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
        }

        const orderNumber = generateOrderNumber();

        // Calculate optional expiresAt (30 minutes from now)
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

        // Always read customerStatus from Firestore (source of truth)
        // This ensures driver-verified customers are recognized immediately
        let customerStatus = null;
        if (customerUid) {
            try {
                const userDoc = await adminDb.collection("users").doc(customerUid).get();
                if (userDoc.exists) {
                    customerStatus = userDoc.data().customerStatus || null;
                }
            } catch (_) {}
        }

        const orderData = {
            orderNumber,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            customerAddress: customerAddress.trim(),
            customerUid: customerUid || authUid,
            customerStatus,
            items,
            notes: notes?.trim() || "",
            status: "pending",
            areaId: areaId || "default",
            driverId: null,
            locationCoords: locationCoords || null,
            locationDesc: locationDesc?.trim() || "",
            deliveryFeeSyp: DEFAULT_DELIVERY_FEE_SYP,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            expiresAt,
        };

        const docRef = await adminDb.collection("orders").add(orderData);


        return NextResponse.json(
            {
                message: "تم تسجيل الطلب بنجاح",
                order: {
                    id: docRef.id,
                    orderNumber,
                    ...orderData,
                    createdAt: new Date().toISOString(), // return a serializable timestamp
                    updatedAt: new Date().toISOString(),
                    expiresAt: expiresAt.toISOString(),
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Create order error:", error);
        return NextResponse.json({ error: "حدث خطأ أثناء حفظ الطلب" }, { status: 500 });
    }
}

// Order tracking by order number
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const orderNumber = searchParams.get("orderNumber");

        if (!orderNumber) {
            return NextResponse.json({ error: "رقم الطلب مطلوب" }, { status: 400 });
        }

        const snapshot = await adminDb
            .collection("orders")
            .where("orderNumber", "==", orderNumber)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
        }

        const doc = snapshot.docs[0];
        const data = doc.data();

        return NextResponse.json({
            order: {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
                updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
                expiresAt: data.expiresAt?.toDate?.()?.toISOString() || null,
            },
        });
    } catch (error) {
        return NextResponse.json({ error: "خطأ في جلب الطلب" }, { status: 500 });
    }
}
