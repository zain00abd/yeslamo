"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    getCustomerNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    clearAllNotifications,
    notificationsEventName,
} from "@/lib/customerNotifications";

/* ───────── وقت قابل للقراءة ───────── */
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
    if (diffHr < 48) return "أمس";
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return `منذ ${diffDays} أيام`;
    return d.toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
}

/* ───────── تسمية التاريخ للمجموعة ───────── */
function dateGroupLabel(iso) {
    if (!iso) return "قديم";
    const d = new Date(iso);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 864e5);
    if (d >= startOfToday) return "اليوم";
    if (d >= startOfYesterday) return "أمس";
    return d.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" });
}

/* ───────── إعداد اللون والأيقونة حسب الحالة ───────── */
const STATUS_CONFIG = {
    pending:    { color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", label: "قيد الانتظار",  dot: "#f59e0b" },
    accepted:   { color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", label: "مقبول",          dot: "#2563eb" },
    on_the_way: { color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", label: "في الطريق",     dot: "#7c3aed" },
    delivered:  { color: "#059669", bg: "#ecfdf5", border: "#a7f3d0", label: "تم التوصيل",    dot: "#059669" },
    cancelled:  { color: "#dc2626", bg: "#fef2f2", border: "#fecaca", label: "ملغى",           dot: "#dc2626" },
};

function getStatusCfg(n) {
    return STATUS_CONFIG[n.status] || { color: "#ff6b35", bg: "#fff7f3", border: "#ffd4c0", label: "إشعار", dot: "#ff6b35" };
}

/* ───────── أيقونة SVG مبنية على الحالة ───────── */
function NotifIcon({ status, size = 22 }) {
    const cfg = STATUS_CONFIG[status] || { color: "#ff6b35" };
    const s = { width: size, height: size, display: "block" };
    const common = { fill: "none", stroke: cfg.color, strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" };

    if (status === "pending")
        return <svg viewBox="0 0 24 24" style={s} {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    if (status === "accepted")
        return <svg viewBox="0 0 24 24" style={s} {...common}><path d="M20 6 9 17l-5-5" /></svg>;
    if (status === "on_the_way")
        return <svg viewBox="0 0 24 24" style={s} {...common}><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3" /><rect x="9" y="11" width="14" height="10" rx="2" /><path d="M12 21a2 2 0 0 0 4 0" /><path d="M3 10h18" /></svg>;
    if (status === "delivered")
        return <svg viewBox="0 0 24 24" style={s} {...common}><path d="M21.5 12H16c-.7 2-2 3-4 3s-3.3-1-4-3H2.5" /><path d="M5.5 5.1L2 12v3c0 1.1.9 2 2 2h16a2 2 0 0 0 2-2v-3l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z" /></svg>;
    if (status === "cancelled")
        return <svg viewBox="0 0 24 24" style={s} {...common}><circle cx="12" cy="12" r="9" /><path d="m15 9-6 6M9 9l6 6" /></svg>;

    return (
        <svg viewBox="0 0 24 24" style={s} {...common}>
            <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22z" />
            <path d="M4 18h16l-1.6-2.4a4 4 0 0 1-.67-2.22V10a5.73 5.73 0 0 0-4.27-5.61V4a1.46 1.46 0 0 0-2.92 0v.39A5.73 5.73 0 0 0 6.27 10v3.38a4 4 0 0 1-.67 2.22L4 18Z" />
        </svg>
    );
}

/* ───────── بطاقة إشعار واحدة ───────── */
function NotifCard({ n, onMarkRead }) {
    const cfg = getStatusCfg(n);

    return (
        <div
            className={`notif-card${n.read ? " notif-card--read" : " notif-card--unread"}`}
            style={{
                "--notif-color": cfg.color,
                "--notif-bg": cfg.bg,
                "--notif-border": cfg.border,
            }}
        >
            <div className="notif-card-icon-wrap">
                <NotifIcon status={n.status} size={20} />
            </div>

            <div className="notif-card-body">
                <div className="notif-card-top">
                    <span className="notif-card-title">{n.title || "إشعار"}</span>
                    <span className="notif-card-when">{formatWhen(n.createdAt)}</span>
                </div>

                <p className="notif-card-msg">{n.body}</p>

                {(n.status || n.orderId) ? (
                    <div className="notif-card-footer">
                        {n.status ? (
                            <span
                                className="notif-card-status-pill"
                                style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                            >
                                {cfg.label}
                            </span>
                        ) : null}

                        {n.orderId ? (
                            <Link href="/track-order" className="notif-card-cta">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M15 18l-6-6 6-6" />
                                </svg>
                                تتبع الطلب
                                {n.orderNumber ? <span className="notif-card-order-num">#{n.orderNumber}</span> : null}
                            </Link>
                        ) : null}

                        {!n.read ? (
                            <button
                                type="button"
                                className="notif-card-read-btn"
                                onClick={() => onMarkRead(n.id)}
                                aria-label="تحديد كمقروء"
                            >
                                تحديد كمقروء
                            </button>
                        ) : null}
                    </div>
                ) : null}
            </div>

            {!n.read ? <span className="notif-card-dot" aria-label="غير مقروء" /> : null}
        </div>
    );
}

/* ───────── الصفحة الرئيسية ───────── */
export default function NotificationsPage() {
    const router = useRouter();
    const [loaded, setLoaded] = useState(false);
    const [items, setItems] = useState([]);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    useEffect(() => {
        try {
            const stored = localStorage.getItem("yaslamo_user");
            if (!stored) { router.replace("/login"); return; }
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

    const handleMarkRead = useCallback((id) => {
        markNotificationRead(id);
        setItems(getCustomerNotifications());
    }, []);

    const handleMarkAll = useCallback(() => {
        markAllNotificationsRead();
        setItems(getCustomerNotifications());
    }, []);

    const handleClearAll = useCallback(() => {
        clearAllNotifications();
        setItems([]);
        setShowClearConfirm(false);
    }, []);

    const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

    /* تجميع بحسب التاريخ */
    const groups = useMemo(() => {
        const map = new Map();
        for (const n of items) {
            const label = dateGroupLabel(n.createdAt);
            if (!map.has(label)) map.set(label, []);
            map.get(label).push(n);
        }
        return [...map.entries()];
    }, [items]);

    if (!loaded) return null;

    return (
        <div className="page-wrapper has-bottom-nav notif-page" dir="rtl">
            {/* ── هيدر ثابت ── */}
            <header className="notif-header">
                <div className="notif-header-inner">
                    <button
                        type="button"
                        className="notif-header-back"
                        onClick={() => router.back()}
                        aria-label="رجوع"
                    >
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 18l6-6-6-6" />
                        </svg>
                    </button>

                    <div className="notif-header-title-wrap">
                        <h1 className="notif-header-title">الإشعارات</h1>
                        {unreadCount > 0 ? (
                            <span className="notif-header-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
                        ) : null}
                    </div>

                    <div className="notif-header-actions">
                        {unreadCount > 0 ? (
                            <button type="button" className="notif-action-btn" onClick={handleMarkAll}>
                                قراءة الكل
                            </button>
                        ) : null}
                        {items.length > 0 ? (
                            <button
                                type="button"
                                className="notif-action-btn notif-action-btn--ghost"
                                onClick={() => setShowClearConfirm(true)}
                                aria-label="مسح الكل"
                            >
                                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                                </svg>
                            </button>
                        ) : null}
                    </div>
                </div>

                {/* شريط ملخص */}
                {items.length > 0 ? (
                    <div className="notif-header-summary">
                        <span>{items.length} إشعار</span>
                        {unreadCount > 0 ? (
                            <>
                                <span className="notif-summary-dot" />
                                <span className="notif-summary-unread">{unreadCount} غير مقروء</span>
                            </>
                        ) : (
                            <>
                                <span className="notif-summary-dot" />
                                <span className="notif-summary-all-read">الكل مقروء ✓</span>
                            </>
                        )}
                    </div>
                ) : null}
            </header>

            {/* ── المحتوى ── */}
            <main className="notif-main">
                {items.length === 0 ? (
                    /* حالة فارغة */
                    <div className="notif-empty">
                        <div className="notif-empty-icon" aria-hidden="true">
                            <svg viewBox="0 0 80 80" width="80" height="80" fill="none">
                                <circle cx="40" cy="40" r="38" fill="#fff7f3" stroke="#ffd4c0" strokeWidth="1.5" />
                                <path d="M40 56a3.5 3.5 0 0 0 3.43-3h-6.86A3.5 3.5 0 0 0 40 56Z" fill="#ff6b35" opacity=".8" />
                                <path d="M24 50h32l-2.4-3.6a6 6 0 0 1-1-3.33V37a14.6 14.6 0 0 0-11-14.22V22a2.6 2.6 0 0 0-5.2 0v.78A14.6 14.6 0 0 0 25.4 37v6.07a6 6 0 0 1-1 3.33L24 50Z" fill="#ff6b35" opacity=".15" stroke="#ff6b35" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                <circle cx="54" cy="26" r="8" fill="#ecfdf5" stroke="#a7f3d0" strokeWidth="1.5" />
                                <path d="M51 26l2 2 4-4" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <h2 className="notif-empty-title">لا توجد إشعارات</h2>
                        <p className="notif-empty-desc">ستظهر هنا التحديثات المتعلقة بطلباتك عند توفرها.</p>
                        <Link href="/" className="notif-empty-cta">العودة للرئيسية</Link>
                    </div>
                ) : (
                    <div className="notif-groups">
                        {groups.map(([label, groupItems]) => (
                            <section key={label} className="notif-group">
                                <h2 className="notif-group-label">{label}</h2>
                                <div className="notif-group-list">
                                    {groupItems.map((n) => (
                                        <NotifCard key={n.id} n={n} onMarkRead={handleMarkRead} />
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </main>

            {/* ── مودال تأكيد المسح ── */}
            {showClearConfirm ? (
                <div className="notif-modal-overlay" role="dialog" aria-modal="true" aria-label="تأكيد مسح الإشعارات">
                    <div className="notif-modal">
                        <div className="notif-modal-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                            </svg>
                        </div>
                        <h3 className="notif-modal-title">مسح جميع الإشعارات؟</h3>
                        <p className="notif-modal-desc">سيتم حذف {items.length} إشعار بشكل نهائي ولا يمكن التراجع عنه.</p>
                        <div className="notif-modal-btns">
                            <button type="button" className="notif-modal-btn notif-modal-btn--cancel" onClick={() => setShowClearConfirm(false)}>
                                إلغاء
                            </button>
                            <button type="button" className="notif-modal-btn notif-modal-btn--confirm" onClick={handleClearAll}>
                                مسح الكل
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
