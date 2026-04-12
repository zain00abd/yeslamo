"use client";

import { useEffect, useState } from "react";

function fmtTime(iso) {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleString("ar-SY", { dateStyle: "short", timeStyle: "short" });
    } catch {
        return "—";
    }
}

function fmtMoney(n) {
    if (typeof n !== "number" || Number.isNaN(n)) return "—";
    return n.toLocaleString("ar-SY", { maximumFractionDigits: 2 });
}

export default function DashboardHomePage() {
    const [data, setData] = useState(null);
    const [err, setErr] = useState("");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/admin/stats", { credentials: "include" });
                const j = await res.json();
                if (!res.ok) throw new Error(j.error || "خطأ");
                if (!cancelled) setData(j);
            } catch (e) {
                if (!cancelled) setErr(e.message || "خطأ");
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    if (err) {
        return (
            <div>
                <h1 className="admin-title">لوحة التحكم</h1>
                <p className="admin-error">{err}</p>
            </div>
        );
    }

    if (!data) {
        return (
            <div>
                <h1 className="admin-title">لوحة التحكم</h1>
                <p style={{ color: "var(--adm-muted)" }}>جاري التحميل...</p>
            </div>
        );
    }

    const t = data.totals;
    const c = t.commissions || {};
    const u = t.driverTopUps || {};

    return (
        <div>
            <h1 className="admin-title">لوحة التحكم</h1>

            <div className="admin-grid-stats">
                <div className="admin-stat-card">
                    <div className="admin-stat-label">طلبات اليوم</div>
                    <div className="admin-stat-value">{t.ordersToday}</div>
                </div>
                <div className="admin-stat-card">
                    <div className="admin-stat-label">طلبات الأسبوع</div>
                    <div className="admin-stat-value">{t.ordersWeek}</div>
                </div>
                <div className="admin-stat-card">
                    <div className="admin-stat-label">قيد الانتظار</div>
                    <div className="admin-stat-value">{t.pendingOrders}</div>
                </div>
                <div className="admin-stat-card">
                    <div className="admin-stat-label">مندوبون نشطون</div>
                    <div className="admin-stat-value">{t.activeDrivers}</div>
                </div>
                <div className="admin-stat-card">
                    <div className="admin-stat-label">إجمالي المستخدمين</div>
                    <div className="admin-stat-value">{t.totalUsers}</div>
                </div>
            </div>

            <div className="admin-card" style={{ marginBottom: "1.25rem" }}>
                <h2 style={{ fontSize: "1.05rem", fontWeight: 800, marginBottom: "0.65rem" }}>المالية (ل.س)</h2>
                <div className="admin-table-wrap">
                    <table className="admin-finance-table">
                        <thead>
                            <tr>
                                <th style={{ minWidth: 200 }}>البند</th>
                                <th>اليوم</th>
                                <th>الأسبوع</th>
                                <th>هذا الشهر</th>
                                <th>الشهر الماضي</th>
                                <th>الإجمالي</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>عمولات التوصيل (عند تسليم الطلبات)</td>
                                <td>{fmtMoney(c.day)}</td>
                                <td>{fmtMoney(c.week)}</td>
                                <td>{fmtMoney(c.month)}</td>
                                <td>{fmtMoney(c.lastMonth)}</td>
                                <td style={{ fontWeight: 900 }}>{fmtMoney(c.all)}</td>
                            </tr>
                            <tr>
                                <td>شحن رصيد المندوبين (من الإدارة)</td>
                                <td>{fmtMoney(u.day)}</td>
                                <td>{fmtMoney(u.week)}</td>
                                <td>{fmtMoney(u.month)}</td>
                                <td>{fmtMoney(u.lastMonth)}</td>
                                <td style={{ fontWeight: 900 }}>{fmtMoney(u.all)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p className="admin-finance-note">
                    «هذا الشهر» و«الشهر الماضي» تقويميان. عمولات التوصيل تُحسب حسب تاريخ آخر تحديث للطلب عند التسليم. شحن الرصيد يُسجَّل من لوحة الإدارة فقط (من تاريخ تفعيل التسجيل).
                </p>
            </div>

            <div className="admin-card">
                <h2>في انتظار مندوب</h2>
                <div className="admin-table-wrap">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>رقم الطلب</th>
                                <th>العميل</th>
                                <th>المنطقة</th>
                                <th>الوقت</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.waitingForDriver.length === 0 ? (
                                <tr>
                                    <td colSpan={4} style={{ color: "var(--adm-muted)" }}>
                                        لا يوجد
                                    </td>
                                </tr>
                            ) : (
                                data.waitingForDriver.map((o) => (
                                    <tr key={o.id}>
                                        <td>{o.orderNumber || o.id.slice(0, 8)}</td>
                                        <td>{o.customerName}</td>
                                        <td>{o.areaId || "—"}</td>
                                        <td>{fmtTime(o.createdAt)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="admin-card">
                <h2>أحدث الطلبات</h2>
                <div className="admin-table-wrap">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>رقم</th>
                                <th>الحالة</th>
                                <th>العميل</th>
                                <th>الوقت</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.latestOrders.map((o) => (
                                <tr key={o.id}>
                                    <td>{o.orderNumber || o.id.slice(0, 8)}</td>
                                    <td>
                                        <span className={`admin-badge ${o.status || "pending"}`}>{o.status}</span>
                                    </td>
                                    <td>{o.customerName}</td>
                                    <td>{fmtTime(o.createdAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
