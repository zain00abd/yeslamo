"use client";

import { useEffect, useState } from "react";

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
            <h1 className="admin-title">المتاجر</h1>
            <p style={{ color: "var(--adm-muted)", marginBottom: "1rem", fontSize: "0.9rem" }}>
                تُخزَّن المتاجر في مجموعة <code>stores</code> في Firestore. إن كانت فارغة، أضف مستندات يدوياً أو عبر سكربت.
            </p>
            {msg ? <p className="admin-error">{msg}</p> : null}

            <div className="admin-toolbar">
                <button type="button" className="admin-btn ghost" onClick={load}>
                    تحديث
                </button>
            </div>

            <div className="admin-card" style={{ padding: 0 }}>
                <div className="admin-table-wrap">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>الاسم</th>
                                <th>النوع</th>
                                <th>المنطقة</th>
                                <th>نشط</th>
                                <th>إجراء</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={5}>...</td>
                                </tr>
                            ) : stores.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ color: "var(--adm-muted)" }}>
                                        لا توجد متاجر مسجّلة
                                    </td>
                                </tr>
                            ) : (
                                stores.map((s) => (
                                    <tr key={s.id}>
                                        <td>{s.name || "—"}</td>
                                        <td>{s.type || "—"}</td>
                                        <td>{s.areaId || s.area || "—"}</td>
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
