"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { getCurrentUserIdToken } from "@/lib/clientAuth";
import { showAppAlert } from "@/lib/appAlert";
import { showAppConfirm } from "@/lib/appConfirm";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { getDeliveryFeeForOrder } from "@/lib/orderPricing";

// Status config — order from RIGHT to LEFT in the stepper (RTL)
const STEPS = [
    {
        key: "delivered",
        label: "تم التوصيل",
        icon: (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
        ),
    },
    {
        key: "on_the_way",
        label: "في الطريق",
        icon: (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M18 18.5c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-12 0c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm14-6.5v3h-2v-3h-3v-2h3V7h2v3h3v2h-3zm-16.5-2H6.5V7H4v4.5z" />
            </svg>
        ),
    },
    {
        key: "preparing",
        label: "قيد التحضير",
        icon: (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z" />
            </svg>
        ),
    },
];

// Map database status → step key
function getStepKey(status) {
    if (status === "delivered") return "delivered";
    if (status === "on_the_way") return "on_the_way";
    return "preparing"; // pending or accepted
}

function getStepIndex(status) {
    const key = getStepKey(status);
    return STEPS.findIndex((s) => s.key === key);
}

function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" }) +
        "  " + d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
}

export default function MyOrderPage() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [cancelling, setCancelling] = useState(false);
    const unsubRef = useRef(null);

    // انتظار جلسة Firebase Auth قبل مستمع Firestore (تجنّب permission-denied عند تحميل الصفحة)
    useEffect(() => {
        let cancelled = false;

        (async () => {
            await auth.authStateReady();
            if (cancelled) return;
            if (!auth.currentUser) {
                router.replace("/login");
                setLoading(false);
                return;
            }

            let uid;
            try {
                const stored = localStorage.getItem("yaslamo_user");
                if (!stored) {
                    router.replace("/login");
                    setLoading(false);
                    return;
                }
                const parsed = JSON.parse(stored);
                uid = parsed.id;
                if (parsed.id !== auth.currentUser.uid) {
                    router.replace("/login");
                    setLoading(false);
                    return;
                }
                setUser(parsed);
            } catch {
                router.replace("/login");
                setLoading(false);
                return;
            }

            try {
                const token = await getCurrentUserIdToken();
                if (!token) {
                    router.replace("/login");
                    if (!cancelled) setLoading(false);
                    return;
                }
                const res = await fetch(`/api/orders/my?uid=${encodeURIComponent(uid)}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (cancelled) return;
                if (data.order) {
                    setOrder(data.order);
                    startListener(data.order.id);
                }
            } catch (e) {
                console.error(e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
            if (unsubRef.current) unsubRef.current();
        };
    }, [router]);

    function startListener(orderId) {
        if (unsubRef.current) unsubRef.current();
        const unsub = onSnapshot(doc(db, "orders", orderId), (snap) => {
            if (!snap.exists()) return;
            const data = snap.data();
            setOrder((prev) => ({
                ...prev,
                ...data,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || prev?.createdAt,
                updatedAt: data.updatedAt?.toDate?.()?.toISOString() || prev?.updatedAt,
            }));
        });
        unsubRef.current = unsub;
    }

    async function handleCancel() {
        if (!order?.id) return;
        const ok = await showAppConfirm("هل أنت متأكد من إلغاء الطلب؟");
        if (!ok) return;
        setCancelling(true);
        try {
            await updateDoc(doc(db, "orders", order.id), { status: "cancelled" });
            setOrder((prev) => ({ ...prev, status: "cancelled" }));
        } catch (e) {
            showAppAlert("حدث خطأ أثناء إلغاء الطلب");
        } finally {
            setCancelling(false);
        }
    }

    if (loading) {
        return (
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
                <div style={{ width: 40, height: 40, border: "4px solid #ff6b35", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <div style={{ color: "#aaa", fontWeight: 700 }}>جاري التحميل...</div>
            </div>
        );
    }

    // No active order
    if (!order || order.status === "cancelled") {
        return (
            <div className="page-wrapper has-bottom-nav" style={{ minHeight: "100vh" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", textAlign: "center" }}>
                    <div style={{ fontSize: "4rem", marginBottom: 16 }}>📦</div>
                    <div style={{ fontWeight: 800, fontSize: "1.3rem", color: "#1a1a2e", marginBottom: 8 }}>لا يوجد طلب نشط</div>
                    <div style={{ color: "#888", fontSize: "0.95rem", marginBottom: 32 }}>
                        {order?.status === "cancelled" ? "تم إلغاء آخر طلب" : "لم تقم بأي طلب بعد"}
                    </div>
                    <Link href="/create-order">
                        <button style={{ padding: "14px 32px", borderRadius: "14px", border: "none", background: "#ff6b35", color: "white", fontFamily: "inherit", fontWeight: 800, fontSize: "1rem", cursor: "pointer", boxShadow: "0 6px 20px rgba(255,107,53,0.3)" }}>
                            ➕ إنشاء طلب جديد
                        </button>
                    </Link>
                </div>
            </div>
        );
    }

    const activeStepIndex = getStepIndex(order.status);
    const canCancel = order.status === "pending";

    // Status label config
    const STATUS_CONFIG = {
        pending:     { label: "⏳ يتم البحث عن مندوب...", bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
        accepted:    { label: "✅ تم قبول طلبك من قِبَل مندوب", bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
        on_the_way:  { label: "🚗 المندوب في طريقه إليك", bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
        delivered:   { label: "🎉 تم التوصيل!", bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
        cancelled:   { label: "❌ تم إلغاء الطلب", bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" },
    };
    const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;


    return (
        <div className="page-wrapper has-bottom-nav" dir="rtl">
            {/* Header */}
            <div style={{ width: "100%", background: "var(--surface)", padding: "20px 20px 16px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
                <div style={{ fontWeight: 800, fontSize: "1.15rem", color: "#1a1a2e" }}>تفاصيل الطلب</div>
                <div style={{ fontWeight: 700, fontSize: "1rem", color: "#ff6b35" }}>{order.orderNumber}</div>
            </div>

            {/* Status Banner */}
            <div style={{ width: "100%", padding: "12px 16px", background: statusCfg.bg, borderBottom: `1px solid ${statusCfg.border}`, borderLeft: `1px solid ${statusCfg.border}`, borderRight: `1px solid ${statusCfg.border}`, textAlign: "center", fontWeight: 800, fontSize: "0.95rem", color: statusCfg.color }}>
                {statusCfg.label}
            </div>

            <div style={{ width: "100%", maxWidth: 600, margin: "0 auto", padding: "16px 16px 24px" }}>

                {/* ── Status Stepper ── */}
                <div style={{ background: "var(--surface)", borderRadius: "20px", padding: "20px 16px", marginBottom: 12, boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative" }}>
                        {/* connecting line behind steps */}
                        <div style={{ position: "absolute", top: 22, right: "15%", left: "15%", height: 3, background: "#f0f0f0", zIndex: 0 }} />

                        {STEPS.map((step, i) => {
                            const done = i > activeStepIndex;  // RTL: higher index = earlier step
                            const active = i === activeStepIndex;
                            const color = done || active ? "#ff6b35" : "#d1d5db";
                            const bgColor = active ? "#ff6b35" : done ? "#fff3ed" : "#f5f5f5";
                            const iconColor = active ? "white" : done ? "#ff6b35" : "#bbb";

                            return (
                                <div key={step.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flex: 1, position: "relative", zIndex: 1 }}>
                                    <div style={{
                                        width: 46, height: 46, borderRadius: "50%",
                                        background: bgColor,
                                        border: `2px solid ${color}`,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        color: iconColor,
                                        transition: "all 0.3s ease",
                                        boxShadow: active ? "0 4px 16px rgba(255,107,53,0.35)" : "none",
                                    }}>
                                        {step.icon}
                                    </div>
                                    <div style={{ fontSize: "0.75rem", fontWeight: active ? 800 : 600, color: active ? "#ff6b35" : "#aaa", textAlign: "center", lineHeight: 1.3 }}>
                                        {step.label}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── Delivery Time ── */}
                <div style={{ background: "var(--surface)", borderRadius: "20px", padding: "18px 20px", marginBottom: 12, boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
                    <div style={{ fontSize: "0.78rem", color: "#aaa", fontWeight: 700, marginBottom: 4 }}>وقت التوصيل المتوقع</div>
                    <div style={{ fontWeight: 800, fontSize: "1.4rem", color: "#1a1a2e" }}>٣٠ - ٤٥ دقيقة</div>
                </div>

                {/* ── Order Info ── */}
                <div style={{ background: "var(--surface)", borderRadius: "20px", padding: "18px 20px", marginBottom: 12, boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                        <div>
                            <div style={{ fontSize: "0.78rem", color: "#aaa", fontWeight: 700 }}>رقم الطلب</div>
                            <div style={{ fontWeight: 800, color: "#1a1a2e", marginTop: 2 }}>#{order.orderNumber?.replace("ORD-", "")}</div>
                        </div>
                        <div style={{ textAlign: "start" }}>
                            <div style={{ fontSize: "0.78rem", color: "#aaa", fontWeight: 700 }}>تاريخ الطلب</div>
                            <div style={{ fontWeight: 700, color: "#555", marginTop: 2, fontSize: "0.85rem" }}>{formatDate(order.createdAt)}</div>
                        </div>
                    </div>
                </div>

                {/* ── Address ── */}
                <div style={{ background: "var(--surface)", borderRadius: "20px", padding: "18px 20px", marginBottom: 12, boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
                    <div style={{ fontSize: "0.78rem", color: "#aaa", fontWeight: 700, marginBottom: 6 }}>عنوان التوصيل</div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="#ff6b35" style={{ flexShrink: 0, marginTop: 2 }}>
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                        </svg>
                        <div style={{ fontWeight: 700, color: "#1a1a2e", fontSize: "0.95rem", lineHeight: 1.5 }}>{order.customerAddress}</div>
                    </div>
                </div>

                {/* ── Items Summary ── */}
                <div style={{ background: "var(--surface)", borderRadius: "20px", padding: "18px 20px", marginBottom: 12, boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
                    <div style={{ fontWeight: 800, fontSize: "1rem", color: "#1a1a2e", marginBottom: 14 }}>ملخص الطلب</div>
                    {order.items?.map((item, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < order.items.length - 1 ? "1px solid #f5f5f5" : "none" }}>
                            <span style={{ fontWeight: 700, color: "#ff6b35", fontSize: "0.9rem" }}>× {item.quantity}</span>
                            <span style={{ fontWeight: 600, color: "#333", fontSize: "0.95rem" }}>{item.name}</span>
                        </div>
                    ))}
                    {order.notes && (
                        <div style={{ marginTop: 12, padding: "10px 14px", background: "#fffbeb", borderRadius: "10px", border: "1px solid #fde68a", fontSize: "0.9rem", color: "#b45309", fontWeight: 600 }}>
                            📝 {order.notes}
                        </div>
                    )}
                </div>

                {/* ── السعر (بعد تسعير المندوب عند «في الطريق») ── */}
                {(order.status === "on_the_way" || order.status === "delivered") &&
                    typeof order.itemsPurchaseSyp === "number" && (
                        <div
                            style={{
                                background: "var(--surface)",
                                borderRadius: "20px",
                                padding: "18px 20px",
                                marginBottom: 12,
                                boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
                                border: "1px solid rgba(255, 107, 53, 0.2)",
                            }}
                        >
                            <div style={{ fontWeight: 800, fontSize: "1rem", color: "#1a1a2e", marginBottom: 14 }}>المبلغ المستحق</div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f0f0f0", fontSize: "0.95rem" }}>
                                <span style={{ color: "#666", fontWeight: 600 }}>مشتريات الطلب</span>
                                <span style={{ fontWeight: 800, color: "#1a1a2e", fontVariantNumeric: "tabular-nums" }}>{order.itemsPurchaseSyp} ل.س</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f0f0f0", fontSize: "0.95rem" }}>
                                <span style={{ color: "#666", fontWeight: 600 }}>رسوم التوصيل</span>
                                <span style={{ fontWeight: 800, color: "#1a1a2e", fontVariantNumeric: "tabular-nums" }}>{getDeliveryFeeForOrder(order)} ل.س</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, marginTop: 4 }}>
                                <span style={{ fontWeight: 900, fontSize: "1.05rem", color: "#1a1a2e" }}>الإجمالي</span>
                                <span style={{ fontWeight: 900, fontSize: "1.35rem", color: "#ea580c", fontVariantNumeric: "tabular-nums" }}>
                                    {typeof order.totalDueSyp === "number"
                                        ? order.totalDueSyp
                                        : order.itemsPurchaseSyp + getDeliveryFeeForOrder(order)}{" "}
                                    <span style={{ fontSize: "0.85rem", fontWeight: 800 }}>ل.س</span>
                                </span>
                            </div>
                        </div>
                    )}

                {/* ── Cancel Button ── */}
                {canCancel && (
                    <button
                        onClick={handleCancel}
                        disabled={cancelling}
                        style={{
                            width: "100%", padding: "16px", borderRadius: "16px",
                            border: "1.5px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.05)",
                            color: "#ef4444", fontFamily: "inherit", fontWeight: 800, fontSize: "1rem",
                            cursor: cancelling ? "wait" : "pointer", opacity: cancelling ? 0.7 : 1,
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        }}
                    >
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="#ef4444">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z" />
                        </svg>
                        {cancelling ? "جاري الإلغاء..." : "إلغاء الطلب"}
                    </button>
                )}
            </div>
        </div>
    );
}
