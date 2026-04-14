"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    getCustomerNotifications,
    markAllNotificationsRead,
    notificationsEventName,
} from "@/lib/customerNotifications";

function formatWhen(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "الآن";
    if (diffMin < 60) return `منذ ${diffMin} د`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `منذ ${diffHr} س`;
    return d.toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
}

export default function NotificationsPage() {
    const router = useRouter();
    const [loaded, setLoaded] = useState(false);
    const [items, setItems] = useState([]);

    useEffect(() => {
        try {
            const stored = localStorage.getItem("yaslamo_user");
            if (!stored) {
                router.replace("/login");
                return;
            }
            setLoaded(true);
        } catch {
            router.replace("/login");
        }
    }, [router]);

    useEffect(() => {
        if (!loaded) return;
        const refresh = () => setItems(getCustomerNotifications());
        refresh();
        const ev = notificationsEventName();
        window.addEventListener(ev, refresh);
        window.addEventListener("storage", refresh);
        return () => {
            window.removeEventListener(ev, refresh);
            window.removeEventListener("storage", refresh);
        };
    }, [loaded]);

    const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

    if (!loaded) return null;

    return (
        <div className="page-wrapper has-bottom-nav" style={{ minHeight: "100vh", padding: "16px" }}>
            <div style={{ maxWidth: 620, margin: "0 auto" }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                        marginBottom: "14px",
                    }}
                >
                    <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 900 }}>مركز الإشعارات</h1>
                    <button
                        type="button"
                        onClick={markAllNotificationsRead}
                        style={{
                            padding: "8px 12px",
                            borderRadius: "10px",
                            border: "1px solid #e2e8f0",
                            background: "#fff",
                            fontFamily: "inherit",
                            fontWeight: 800,
                            fontSize: "0.82rem",
                            cursor: "pointer",
                            color: unreadCount > 0 ? "#ea580c" : "#94a3b8",
                        }}
                    >
                        تعليم الكل كمقروء
                    </button>
                </div>

                {items.length === 0 ? (
                    <div
                        style={{
                            padding: "26px 18px",
                            borderRadius: "16px",
                            background: "#fff",
                            border: "1px solid #e2e8f0",
                            textAlign: "center",
                            color: "#64748b",
                            fontWeight: 700,
                        }}
                    >
                        لا توجد إشعارات حالياً
                    </div>
                ) : (
                    <div style={{ display: "grid", gap: "10px" }}>
                        {items.map((n) => (
                            <div
                                key={n.id}
                                style={{
                                    padding: "12px 14px",
                                    borderRadius: "14px",
                                    background: "#fff",
                                    border: n.read ? "1px solid #e2e8f0" : "1px solid rgba(234,88,12,0.25)",
                                    boxShadow: n.read ? "none" : "0 4px 14px rgba(234,88,12,0.08)",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        gap: "10px",
                                        marginBottom: "6px",
                                    }}
                                >
                                    <div style={{ fontWeight: 900, fontSize: "0.9rem", color: "#1e293b" }}>{n.title || "إشعار"}</div>
                                    <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 700 }}>{formatWhen(n.createdAt)}</div>
                                </div>
                                <div style={{ fontSize: "0.86rem", lineHeight: 1.55, color: "#475569", fontWeight: 600 }}>{n.body}</div>
                                {n.orderId ? (
                                    <Link
                                        href="/track-order"
                                        style={{
                                            display: "inline-block",
                                            marginTop: "8px",
                                            color: "#2563eb",
                                            fontWeight: 800,
                                            fontSize: "0.8rem",
                                            textDecoration: "underline",
                                        }}
                                    >
                                        عرض تفاصيل الطلب
                                    </Link>
                                ) : null}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
