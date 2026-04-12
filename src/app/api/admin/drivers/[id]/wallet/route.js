import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/auth/require-admin";

const SETTINGS_CONFIG = "config";
const SETTINGS_COLLECTION = "app_settings";

/** شحن رصيد المندوب (ل.س) — قيمة موجبة فقط */
export async function POST(request, context) {
    const { error } = await requireAdmin(request);
    if (error) return error;

    const params = await context.params;
    const userId = params.id;
    if (!userId) return NextResponse.json({ error: "معرّف ناقص" }, { status: 400 });

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "جسم غير صالح" }, { status: 400 });
    }

    const raw = body.amountSyp;
    const amount = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: "المبلغ يجب أن يكون أكبر من صفر" }, { status: 400 });
    }
    const rounded = Math.round(amount * 100) / 100;
    if (rounded > 50_000_000) {
        return NextResponse.json({ error: "المبلغ كبير جداً" }, { status: 400 });
    }

    try {
        const ref = adminDb.collection("users").doc(userId);
        await adminDb.runTransaction(async (t) => {
            const snap = await t.get(ref);
            if (!snap.exists) throw new Error("NOT_FOUND");
            const data = snap.data();
            if (data.role !== "driver") throw new Error("NOT_DRIVER");
            const balRaw = data.walletBalanceSyp;
            const bal = typeof balRaw === "number" && !Number.isNaN(balRaw) ? balRaw : 0;
            const next = Math.round((bal + rounded) * 100) / 100;
            t.update(ref, {
                walletBalanceSyp: next,
                walletLastTopUpAt: FieldValue.serverTimestamp(),
                walletLastTopUpAmountSyp: rounded,
                updatedAt: FieldValue.serverTimestamp(),
            });
        });

        const after = await ref.get();
        const w = after.data()?.walletBalanceSyp ?? 0;

        const batch = adminDb.batch();
        const topupRef = adminDb.collection("wallet_topups").doc();
        batch.set(topupRef, {
            driverId: userId,
            amountSyp: rounded,
            createdAt: FieldValue.serverTimestamp(),
        });
        batch.set(
            adminDb.collection(SETTINGS_COLLECTION).doc(SETTINGS_CONFIG),
            {
                statsTotalDriverTopUpsSyp: FieldValue.increment(rounded),
                updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
        );
        await batch.commit();

        return NextResponse.json({ ok: true, walletBalanceSyp: w });
    } catch (e) {
        console.error("admin wallet top-up:", e);
        const code = e?.message || "";
        if (code === "NOT_FOUND") return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
        if (code === "NOT_DRIVER") return NextResponse.json({ error: "ليس مندوباً" }, { status: 400 });
        return NextResponse.json({ error: "تعذر شحن الرصيد" }, { status: 500 });
    }
}
