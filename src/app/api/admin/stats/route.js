import { NextResponse } from "next/server";
import { FieldPath, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { toIso } from "@/lib/admin/firestoreSerialize";

function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function startOfWeek(d) {
    const x = startOfDay(d);
    const day = x.getDay();
    const diff = (day + 6) % 7;
    x.setDate(x.getDate() - diff);
    return x;
}

function startOfMonth(d) {
    const x = new Date(d);
    x.setDate(1);
    x.setHours(0, 0, 0, 0);
    return x;
}

/** أول يوم من الشهر التقويمي السابق */
function startOfPreviousMonth(now) {
    const som = startOfMonth(now);
    return new Date(som.getFullYear(), som.getMonth() - 1, 1, 0, 0, 0, 0);
}

/** مجموع عمولات التوصيل لكل الطلبات المُسلَّمة (قد يتطلب فهرساً مركّباً status + __name__) */
async function sumAllDeliveredCommissions() {
    let sum = 0;
    let lastDoc = null;
    const page = 400;
    for (;;) {
        let q = adminDb.collection("orders").where("status", "==", "delivered").orderBy(FieldPath.documentId()).limit(page);
        if (lastDoc) q = q.startAfter(lastDoc);
        const snap = await q.get();
        if (snap.empty) break;
        snap.docs.forEach((doc) => {
            const v = doc.data().acceptCommissionSyp;
            if (typeof v === "number" && !Number.isNaN(v)) sum += v;
        });
        if (snap.docs.length < page) break;
        lastDoc = snap.docs[snap.docs.length - 1];
    }
    return Math.round(sum * 100) / 100;
}

export async function GET(request) {
    const { error } = await requireAdmin(request);
    if (error) return error;

    try {
        const now = new Date();
        const sod = startOfDay(now);
        const sow = startOfWeek(now);
        const som = startOfMonth(now);
        const lastMonthStart = startOfPreviousMonth(now);
        const sowTs = Timestamp.fromDate(sow);
        const somTs = Timestamp.fromDate(som);
        const lastMonthStartTs = Timestamp.fromDate(lastMonthStart);

        const ordersSnap = await adminDb.collection("orders").orderBy("createdAt", "desc").limit(2500).get();

        let today = 0;
        let week = 0;
        let pending = 0;

        /** @type {Array<{ id: string, orderNumber?: string, status?: string, customerName?: string, createdAt: string | null }>} */
        const latest = [];
        /** @type {Array<{ id: string, orderNumber?: string, customerName?: string, areaId?: string, createdAt: string | null }>} */
        const waiting = [];

        ordersSnap.docs.forEach((docSnap, i) => {
            const d = docSnap.data();
            const created = d.createdAt?.toDate?.() || null;
            const iso = toIso(d.createdAt);

            if (created) {
                if (created >= sod) today += 1;
                if (created >= sow) week += 1;
            }

            if (d.status === "pending") {
                pending += 1;
                if (waiting.length < 15 && (!d.driverId || d.driverId === "")) {
                    waiting.push({
                        id: docSnap.id,
                        orderNumber: d.orderNumber,
                        customerName: d.customerName,
                        areaId: d.areaId,
                        createdAt: iso,
                    });
                }
            }

            if (i < 12) {
                latest.push({
                    id: docSnap.id,
                    orderNumber: d.orderNumber,
                    status: d.status,
                    customerName: d.customerName,
                    createdAt: iso,
                });
            }
        });

        /** عمولات التوصيل حسب تاريخ آخر تحديث للطلب (تسليم) */
        let commissionsDay = 0;
        let commissionsWeek = 0;
        let commissionsMonth = 0;
        let commissionsLastMonth = 0;
        const ordersUpdatedSnap = await adminDb.collection("orders").orderBy("updatedAt", "desc").limit(6000).get();
        ordersUpdatedSnap.docs.forEach((docSnap) => {
            const d = docSnap.data();
            if (d.status !== "delivered" || typeof d.acceptCommissionSyp !== "number") return;
            const u = d.updatedAt?.toDate?.();
            if (!u) return;
            const v = d.acceptCommissionSyp;
            if (u >= sod) commissionsDay += v;
            if (u >= sow) commissionsWeek += v;
            if (u >= som) commissionsMonth += v;
            if (u >= lastMonthStart && u < som) commissionsLastMonth += v;
        });
        commissionsDay = Math.round(commissionsDay * 100) / 100;
        commissionsWeek = Math.round(commissionsWeek * 100) / 100;
        commissionsMonth = Math.round(commissionsMonth * 100) / 100;
        commissionsLastMonth = Math.round(commissionsLastMonth * 100) / 100;

        let commissionsAll = 0;
        try {
            commissionsAll = await sumAllDeliveredCommissions();
        } catch (e) {
            console.warn("admin stats: sumAllDeliveredCommissions fallback:", e);
            commissionsAll = commissionsMonth;
        }

        /** شحن رصيد من الإدارة — سجلات wallet_topups */
        const [weekTopSnap, monthTopSnap, lastMonthTopSnap, cfgSnap] = await Promise.all([
            adminDb.collection("wallet_topups").where("createdAt", ">=", sowTs).get(),
            adminDb.collection("wallet_topups").where("createdAt", ">=", somTs).get(),
            adminDb
                .collection("wallet_topups")
                .where("createdAt", ">=", lastMonthStartTs)
                .where("createdAt", "<", somTs)
                .get(),
            adminDb.collection("app_settings").doc("config").get(),
        ]);

        let driverTopUpsDay = 0;
        let driverTopUpsWeek = 0;
        weekTopSnap.docs.forEach((doc) => {
            const a = doc.data().amountSyp;
            const t = doc.data().createdAt?.toDate?.();
            if (typeof a !== "number" || !t) return;
            if (t >= sod) driverTopUpsDay += a;
            driverTopUpsWeek += a;
        });
        let driverTopUpsMonth = 0;
        monthTopSnap.docs.forEach((doc) => {
            const a = doc.data().amountSyp;
            if (typeof a === "number") driverTopUpsMonth += a;
        });
        let driverTopUpsLastMonth = 0;
        lastMonthTopSnap.docs.forEach((doc) => {
            const a = doc.data().amountSyp;
            if (typeof a === "number") driverTopUpsLastMonth += a;
        });
        driverTopUpsDay = Math.round(driverTopUpsDay * 100) / 100;
        driverTopUpsWeek = Math.round(driverTopUpsWeek * 100) / 100;
        driverTopUpsMonth = Math.round(driverTopUpsMonth * 100) / 100;
        driverTopUpsLastMonth = Math.round(driverTopUpsLastMonth * 100) / 100;

        const cfg = cfgSnap.exists ? cfgSnap.data() : {};
        let driverTopUpsAll =
            typeof cfg?.statsTotalDriverTopUpsSyp === "number" && !Number.isNaN(cfg.statsTotalDriverTopUpsSyp)
                ? cfg.statsTotalDriverTopUpsSyp
                : driverTopUpsMonth;

        const usersSnap = await adminDb.collection("users").get();
        let totalUsers = 0;
        let activeDrivers = 0;
        usersSnap.docs.forEach((u) => {
            const data = u.data();
            totalUsers += 1;
            if (data.role === "driver" && data.driverEnabled !== false) {
                if (data.driverAvailable !== false) activeDrivers += 1;
            }
        });

        return NextResponse.json({
            totals: {
                ordersToday: today,
                ordersWeek: week,
                pendingOrders: pending,
                activeDrivers,
                totalUsers,
                /** @deprecated استخدم commissions.all */
                earningsSyp: commissionsAll,
                commissions: {
                    label:
                        "عمولات التوصيل المقتطَة عند التسليم (ليست شحناً للمندوبين)",
                    day: commissionsDay,
                    week: commissionsWeek,
                    month: commissionsMonth,
                    lastMonth: commissionsLastMonth,
                    all: commissionsAll,
                },
                driverTopUps: {
                    label: "ما تم شحنه لأرصدة المندوبين من لوحة الإدارة",
                    day: driverTopUpsDay,
                    week: driverTopUpsWeek,
                    month: driverTopUpsMonth,
                    lastMonth: driverTopUpsLastMonth,
                    all: Math.round(driverTopUpsAll * 100) / 100,
                },
            },
            latestOrders: latest,
            waitingForDriver: waiting,
        });
    } catch (e) {
        console.error("admin stats:", e);
        return NextResponse.json({ error: "تعذر تحميل الإحصائيات" }, { status: 500 });
    }
}
