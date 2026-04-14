"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminStoresPage() {
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState("");

    async function load() {
        setLoading(true);
        const res = await fetch("/api/admin/stores", { credentials: "include" });
        const j = await res.json();
        if (res.ok) setStores(j.stores || []);
        else setMsg(j.error || "خطأ");
        setLoading(false);
    }

    useEffect(() => {
        load();
    }, []);

    async function toggle(s) {
        setMsg("");
        const res = await fetch("/api/admin/stores", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ storeId: s.id, isActive: !s.isActive }),
        });
        const j = await res.json();
        if (!res.ok) {
            setMsg(j.error || "فشل");
            return;
        }
        load();
    }

    return (
        <div>
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    marginBottom: "1rem",
                }}
            >
                <h1 className="admin-title" style={{ marginBottom: 0 }}>
                    المتاجر
                </h1>
                <Link href="/dashboard/stores/add" className="admin-btn" style={{ textDecoration: "none" }}>
                    + إضافة متجر
                </Link>
            </div>
            <p style={{ color: "var(--adm-muted)", marginBottom: "1rem", fontSize: "0.9rem" }}>
                تُخزَّن المتاجر في مجموعة <code>stores</code> في Firestore. يمكنك إضافة متجر جديد من النموذج أو إدارة التفعيل من الجدول.
            </p>
            {msg ? <p className="admin-error">{msg}</p> : null}

            <div className="admin-toolbar">
                <button type="button" className="admin-btn ghost" onClick={() => load()}>
                    تحديث
                </button>
            </div>

            <div className="admin-card" style={{ padding: 0 }}>
                <div className="admin-table-wrap">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th style={{ width: 56 }}>صورة</th>
                                <th>الاسم</th>
                                <th>النوع</th>
                                <th>المدينة</th>
                                <th>نشط</th>
                                <th>إجراء</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6}>...</td>
                                </tr>
                            ) : stores.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ color: "var(--adm-muted)" }}>
                                        لا توجد متاجر مسجّلة —{" "}
                                        <Link href="/dashboard/stores/add" style={{ color: "var(--adm-accent)", fontWeight: 700 }}>
                                            إضافة متجر
                                        </Link>
                                    </td>
                                </tr>
                            ) : (
                                stores.map((s) => (
                                    <tr key={s.id}>
                                        <td style={{ verticalAlign: "middle" }}>
                                            {s.imageUrl ? (
                                                <img
                                                    src={s.imageUrl}
                                                    alt=""
                                                    width={44}
                                                    height={44}
                                                    style={{
                                                        width: 44,
                                                        height: 44,
                                                        objectFit: "cover",
                                                        borderRadius: 8,
                                                        display: "block",
                                                    }}
                                                />
                                            ) : (
                                                <span style={{ color: "var(--adm-muted)", fontSize: "0.75rem" }}>—</span>
                                            )}
                                        </td>
                                        <td>{s.name || "—"}</td>
                                        <td>{s.type || "—"}</td>
                                        <td>{s.city || s.area || (s.areaId && s.areaId !== "default" ? s.areaId : "—")}</td>
                                        <td>{s.isActive !== false ? "نعم" : "لا"}</td>
                                        <td>
                                            <button type="button" className="admin-btn ghost" onClick={() => toggle(s)}>
                                                {s.isActive !== false ? "إيقاف" : "تشغيل"}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
