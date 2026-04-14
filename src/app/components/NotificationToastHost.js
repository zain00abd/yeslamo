"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getCustomerNotifications, notificationsEventName } from "@/lib/customerNotifications";

function isCustomerArea(pathname) {
    if (!pathname) return false;
    if (pathname.startsWith("/dashboard")) return false;
    if (pathname.startsWith("/driver")) return false;
    if (pathname.startsWith("/login")) return false;
    if (pathname.startsWith("/register")) return false;
    return true;
}

export default function NotificationToastHost() {
    const [toast, setToast] = useState(null);
    const hideTimerRef = useRef(null);
    const initializedRef = useRef(false);

    const canShow = useMemo(() => {
        if (typeof window === "undefined") return false;
        const path = window.location.pathname || "";
        return isCustomerArea(path);
    }, [toast?.id]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const initial = getCustomerNotifications();
        const first = initial[0] || null;
        if (first) {
            // أول تحميل: لا نعرض توست قديم.
            initializedRef.current = true;
        }

        const onNotifications = () => {
            const list = getCustomerNotifications();
            const latest = list[0] || null;
            if (!latest) return;
            if (!initializedRef.current) {
                initializedRef.current = true;
                return;
            }
            // نعرض فقط الإشعار غير المقروء.
            if (latest.read) return;
            setToast(latest);
        };

        window.addEventListener(notificationsEventName(), onNotifications);
        window.addEventListener("storage", onNotifications);
        return () => {
            window.removeEventListener(notificationsEventName(), onNotifications);
            window.removeEventListener("storage", onNotifications);
        };
    }, []);

    useEffect(() => {
        if (!toast) return;
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
            setToast(null);
        }, 5000);
        return () => {
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        };
    }, [toast]);

    if (!toast || !canShow) return null;

    return (
        <div
            style={{
                position: "fixed",
                top: "max(12px, env(safe-area-inset-top, 0px))",
                left: 0,
                right: 0,
                zIndex: 3600,
                display: "flex",
                justifyContent: "center",
                pointerEvents: "none",
                padding: "0 12px",
            }}
        >
            <div
                role="status"
                aria-live="polite"
                style={{
                    width: "min(460px, 100%)",
                    borderRadius: "14px",
                    border: "1px solid rgba(14, 116, 144, 0.22)",
                    background: "rgba(255,255,255,0.96)",
                    boxShadow: "0 12px 32px rgba(15, 23, 42, 0.22)",
                    backdropFilter: "blur(10px)",
                    WebkitBackdropFilter: "blur(10px)",
                    overflow: "hidden",
                    pointerEvents: "auto",
                    animation: "yaslamoToastIn 220ms ease-out",
                }}
            >
                <div style={{ padding: "10px 12px 4px", fontWeight: 900, fontSize: "0.83rem", color: "#0f172a" }}>
                    {toast.title || "إشعار جديد"}
                </div>
                <div style={{ padding: "0 12px 10px", fontWeight: 700, lineHeight: 1.5, fontSize: "0.86rem", color: "#334155" }}>
                    {toast.body}
                </div>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        borderTop: "1px solid #e2e8f0",
                        padding: "8px 10px",
                    }}
                >
                    <Link href="/notifications" style={{ fontSize: "0.78rem", fontWeight: 800, color: "#0369a1", textDecoration: "underline" }}>
                        فتح مركز الإشعارات
                    </Link>
                    {toast.orderId ? (
                        <Link href="/track-order" style={{ fontSize: "0.78rem", fontWeight: 800, color: "#2563eb", textDecoration: "underline" }}>
                            عرض الطلب
                        </Link>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setToast(null)}
                            style={{
                                border: "none",
                                background: "transparent",
                                color: "#64748b",
                                fontFamily: "inherit",
                                fontWeight: 800,
                                fontSize: "0.78rem",
                                cursor: "pointer",
                            }}
                        >
                            إخفاء
                        </button>
                    )}
                </div>
            </div>
            <style>{`@keyframes yaslamoToastIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </div>
    );
}
