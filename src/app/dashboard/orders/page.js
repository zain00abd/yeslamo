"use client";

import { useEffect, useState } from "react";

const STATUSES = ["", "pending", "accepted", "on_the_way", "delivered", "cancelled"];
const AREAS = ["", "default"];

function statusLabel(s) {
    const m = {
        pending: "معلق",
        accepted: "مقبول",
        on_the_way: "في الطريق",
        delivered: "مُسلَّم",
        cancelled: "ملغى",
    };
    return m[s] || s || "—";
}

export default function AdminOrdersPage() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState("");
    const [area, setArea] = useState("");
    const [detail, setDetail] = useState(null);
    const [drivers, setDrivers] = useState([]);
    const [assignOrderId, setAssignOrderId] = useState(null);
    const [assignDriverId, setAssignDriverId] = useState("");
    const [msg, setMsg] = useState("");

    async function load() {
        setLoading(true);
        const q = new URLSearchParams();
        if (status) q.set("status", status);
        if (area) q.set("area", area);
        const res = await fetch(`/api/admin/orders?${q.toString()}`, { credentials: "include" });
        const j = await res.json();
        if (res.ok) setOrders(j.orders || []);
        setLoading(false);
    }

    useEffect(() => {
        load();
    }, [status, area]);

    useEffect(() => {
        (async () => {
            const res = await fetch("/api/admin/drivers", { credentials: "include" });
            const j = await res.json();
            if (res.ok) setDrivers(j.drivers || []);
        })();
    }, []);

    async function openDetail(id) {
        setMsg("");
        const res = await fetch(`/api/admin/orders/${id}`, { credentials: "include" });
        const j = await res.json();
        if (res.ok) setDetail(j.order);
        else setMsg(j.error || "خطأ");
    }

    async function changeStatus(id, newStatus) {
        setMsg("");
        const res = await fetch(`/api/admin/orders/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ status: newStatus }),
        });
        const j = await res.json();
        if (!res.ok) {
            setMsg(j.error || "فشل");
            return;
        }
        setDetail(null);
        load();
    }

    async function assign() {
        if (!assignOrderId || !assignDriverId) return;
        setMsg("");
        const res = await fetch(`/api/admin/orders/${assignOrderId}/assign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ driverId: assignDriverId }),
        });
        const j = await res.json();
        if (!res.ok) {
            setMsg(j.error || "فشل التعيين");
            return;
        }
        setAssignOrderId(null);
        setAssignDriverId("");
        load();
    }

    return (
        <div>
            <h1 className="admin-title">الطلبات</h1>
            {msg ? <p className="admin-error">{msg}</p> : null}

            <div className="admin-toolbar">
                <select className="admin-select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 160 }}>
                    {STATUSES.map((s) => (
                        <option key={s || "all"} value={s}>
                            {s ? statusLabel(s) : "كل الحالات"}
                        </option>
                    ))}
                </select>
                <select className="admin-select" value={area} onChange={(e) => setArea(e.target.value)} style={{ maxWidth: 160 }}>
                    {AREAS.map((a) => (
                        <option key={a || "all"} value={a}>
                            {a || "كل المناطق"}
                        </option>
                    ))}
                </select>
                <button type="button" className="admin-btn ghost" onClick={load}>
                    تحديث
                </button>
            </div>

            <div className="admin-card" style={{ padding: 0 }}>
                <div className="admin-table-wrap">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>المعرّف</th>
                                <th>النوع</th>
                                <th>العميل</th>
                                <th>المندوب</th>
                                <th>الحالة</th>
                                <th>المنطقة</th>
                                <th>التاريخ</th>
                                <th>إجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={8}>...</td>
                                </tr>
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan={8} style={{ color: "var(--adm-muted)" }}>
                                        لا توجد نتائج
                                    </td>
                                </tr>
                            ) : (
                                orders.map((o) => (
                                    <tr key={o.id}>
                                        <td style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{o.orderNumber || o.id.slice(0, 10)}</td>
                                        <td>{o.orderType === "store" ? "متجر" : "زبون"}</td>
                                        <td>{o.customerName}</td>
                                        <td>{o.driverName || "—"}</td>
                                        <td>
                                            <span className={`admin-badge ${o.status || "pending"}`}>{statusLabel(o.status)}</span>
                                        </td>
                                        <td>{o.areaId || "—"}</td>
                                        <td style={{ whiteSpace: "nowrap", fontSize: "0.8rem" }}>
                                            {o.createdAt
                                                ? new Date(o.createdAt).toLocaleString("ar-SY", { dateStyle: "short", timeStyle: "short" })
                                                : "—"}
                                        </td>
                                        <td style={{ whiteSpace: "nowrap" }}>
                                            <button type="button" className="admin-btn ghost" style={{ padding: "0.35rem 0.5rem" }} onClick={() => openDetail(o.id)}>
                                                تفاصيل
                                            </button>
                                            {o.status === "pending" ? (
                                                <button
                                                    type="button"
                                                    className="admin-btn"
                                                    style={{ padding: "0.35rem 0.5rem", marginInlineStart: "4px" }}
                                                    onClick={() => {
                                                        setAssignOrderId(o.id);
                                                        setAssignDriverId("");
                                                    }}
                                                >
                                                    تعيين
                                                </button>
                                            ) : null}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {detail ? (
                <div className="admin-modal-overlay" onClick={() => setDetail(null)}>
                    <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>طلب #{detail.orderNumber || detail.id}</h3>
                        <p>
                            <strong>الحالة:</strong> {statusLabel(detail.status)}
                        </p>
                        <p>
                            <strong>العميل:</strong> {detail.customerName}
                        </p>
                        <p>
                            <strong>العنوان:</strong> {detail.customerAddress}
                        </p>
                        <p>
                            <strong>المندوب:</strong> {detail.driverName || "—"}
                        </p>
                        <div style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                            <span>تغيير الحالة:</span>
                            {STATUSES.filter(Boolean).map((s) => (
                                <button key={s} type="button" className="admin-btn ghost" style={{ padding: "0.35rem 0.55rem" }} onClick={() => changeStatus(detail.id, s)}>
                                    {statusLabel(s)}
                                </button>
                            ))}
                        </div>
                        <button type="button" className="admin-btn secondary" style={{ marginTop: "1rem", width: "100%" }} onClick={() => setDetail(null)}>
                            إغلاق
                        </button>
                    </div>
                </div>
            ) : null}

            {assignOrderId ? (
                <div className="admin-modal-overlay" onClick={() => setAssignOrderId(null)}>
                    <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>تعيين مندوب</h3>
                        <p style={{ fontSize: "0.88rem", color: "var(--adm-muted)" }}>يُخصم من رصيد المندوب كما في قبول الطلب من التطبيق.</p>
                        <select className="admin-select" value={assignDriverId} onChange={(e) => setAssignDriverId(e.target.value)} style={{ maxWidth: "100%", marginBottom: "0.75rem" }}>
                            <option value="">— اختر مندوباً —</option>
                            {drivers.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.name} — {d.phone}
                                </option>
                            ))}
                        </select>
                        <button type="button" className="admin-btn" style={{ width: "100%" }} onClick={assign} disabled={!assignDriverId}>
                            تأكيد التعيين
                        </button>
                        <button type="button" className="admin-btn ghost" style={{ width: "100%", marginTop: "0.5rem" }} onClick={() => setAssignOrderId(null)}>
                            إلغاء
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
