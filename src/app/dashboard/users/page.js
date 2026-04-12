"use client";

import { useEffect, useState } from "react";

export default function AdminUsersPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState("");

    async function load() {
        setLoading(true);
        const res = await fetch("/api/admin/users", { credentials: "include" });
        const j = await res.json();
        if (res.ok) setUsers(j.users || []);
        else setMsg(j.error || "خطأ");
        setLoading(false);
    }

    useEffect(() => {
        load();
    }, []);

    async function toggleBan(u) {
        setMsg("");
        const res = await fetch("/api/admin/users", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ userId: u.id, banned: !u.banned }),
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
            <h1 className="admin-title">المستخدمون</h1>
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
                                <th>الهاتف</th>
                                <th>الدور</th>
                                <th>طلبات</th>
                                <th>موثّق</th>
                                <th>الحظر</th>
                                <th>إجراء</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7}>...</td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ color: "var(--adm-muted)" }}>
                                        لا يوجد مستخدمون
                                    </td>
                                </tr>
                            ) : (
                                users.map((u) => (
                                    <tr key={u.id}>
                                        <td>{u.name}</td>
                                        <td dir="ltr" style={{ textAlign: "right" }}>
                                            {u.phone}
                                        </td>
                                        <td>{u.role}</td>
                                        <td>{u.ordersCount}</td>
                                        <td>{u.isVerified ? "✓" : "—"}</td>
                                        <td>{u.banned ? "محظور" : "—"}</td>
                                        <td>
                                            <button type="button" className={u.banned ? "admin-btn" : "admin-btn danger"} onClick={() => toggleBan(u)}>
                                                {u.banned ? "إلغاء الحظر" : "حظر"}
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
