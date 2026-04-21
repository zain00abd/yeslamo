"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getCustomerNotifications, notificationsEventName } from "@/lib/customerNotifications";

/* الصفحات التي لا تظهر فيها التوست */
const BLOCKED_PATHS = ["/create-order", "/dashboard", "/driver", "/login", "/register"];

function shouldShow(pathname) {
    if (!pathname) return false;
    return !BLOCKED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "?") || pathname.startsWith(p + "/"));
}

/* لون ونمط كل حالة */
const STATUS_STYLE = {
    pending:    { accent: "#f59e0b", bg: "#fffbeb", icon: "⏳" },
    accepted:   { accent: "#2563eb", bg: "#eff6ff", icon: "✅" },
    on_the_way: { accent: "#7c3aed", bg: "#f5f3ff", icon: "🚗" },
    delivered:  { accent: "#059669", bg: "#ecfdf5", icon: "📦" },
    cancelled:  { accent: "#dc2626", bg: "#fef2f2", icon: "❌" },
};
const DEFAULT_STYLE = { accent: "#ff6b35", bg: "#fff7f3", icon: "🔔" };

function getStyle(n) {
    return STATUS_STYLE[n?.status] || DEFAULT_STYLE;
}

const TOAST_DURATION = 5500; // ms

export default function NotificationToastHost() {
    const pathname = usePathname();
    const [toast, setToast] = useState(null);
    const [exiting, setExiting] = useState(false);
    const [progress, setProgress] = useState(100);
    const hideTimerRef = useRef(null);
    const progressRef = useRef(null);
    const initializedRef = useRef(false);

    /* استمع لإشعارات جديدة */
    useEffect(() => {
        if (typeof window === "undefined") return;

        const initial = getCustomerNotifications();
        if (initial.length > 0) initializedRef.current = true;

        const onNotifications = () => {
            const list = getCustomerNotifications();
            const latest = list[0] || null;
            if (!latest) return;
            if (!initializedRef.current) { initializedRef.current = true; return; }
            if (latest.read) return;
            setExiting(false);
            setProgress(100);
            setToast(latest);
        };

        window.addEventListener(notificationsEventName(), onNotifications);
        window.addEventListener("storage", onNotifications);
        return () => {
            window.removeEventListener(notificationsEventName(), onNotifications);
            window.removeEventListener("storage", onNotifications);
        };
    }, []);

    /* مؤقت الإخفاء التلقائي + شريط التقدم */
    useEffect(() => {
        if (!toast) return;

        clearTimers();

        const startTime = Date.now();
        progressRef.current = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const pct = Math.max(0, 100 - (elapsed / TOAST_DURATION) * 100);
            setProgress(pct);
        }, 40);

        hideTimerRef.current = setTimeout(dismiss, TOAST_DURATION);

        return clearTimers;
    }, [toast]);

    function clearTimers() {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        if (progressRef.current) clearInterval(progressRef.current);
    }

    function dismiss() {
        setExiting(true);
        setTimeout(() => { setToast(null); setExiting(false); }, 280);
    }

    if (!toast || !shouldShow(pathname)) return null;

    const s = getStyle(toast);

    return (
        <div
            className={`nt-host${exiting ? " nt-host--exit" : ""}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
        >
            <div
                className="nt-card"
                style={{ "--nt-accent": s.accent, "--nt-bg": s.bg }}
            >
                {/* خط ملون جانبي */}
                <span className="nt-accent-bar" aria-hidden="true" />

                {/* أيقونة */}
                <span className="nt-icon" aria-hidden="true">{s.icon}</span>

                {/* النص */}
                <div className="nt-content">
                    <strong className="nt-title">{toast.title || "إشعار جديد"}</strong>
                    <p className="nt-body">{toast.body}</p>
                    {toast.orderId ? (
                        <Link href="/track-order" className="nt-link" onClick={dismiss}>
                            تتبع الطلب ←
                        </Link>
                    ) : null}
                </div>

                {/* زر الإغلاق */}
                <button
                    type="button"
                    className="nt-close"
                    onClick={dismiss}
                    aria-label="إغلاق الإشعار"
                >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                </button>

                {/* شريط التقدم */}
                <span
                    className="nt-progress"
                    style={{ width: `${progress}%` }}
                    aria-hidden="true"
                />
            </div>
        </div>
    );
}
