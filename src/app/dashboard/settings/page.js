"use client";

import { useEffect, useState } from "react";

export default function AdminSettingsPage() {
    const [s, setS] = useState({
        workingHoursStart: "08:00",
        workingHoursEnd: "22:00",
        maxOrdersPerDriver: 2,
        supportPhone: "",
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState("");

    useEffect(() => {
        (async () => {
            const res = await fetch("/api/admin/settings", { credentials: "include" });
            const j = await res.json();
            if (res.ok && j.settings) {
                setS({
                    workingHoursStart: j.settings.workingHoursStart,
                    workingHoursEnd: j.settings.workingHoursEnd,
                    maxOrdersPerDriver: j.settings.maxOrdersPerDriver,
                    supportPhone: j.settings.supportPhone || "",
                });
            }
            setLoading(false);
        })();
    }, []);

    async function save(e) {
        e.preventDefault();
        setSaving(true);
        setMsg("");
        const res = await fetch("/api/admin/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(s),
        });
        const j = await res.json();
        setSaving(false);
        if (!res.ok) {
            setMsg(j.error || "فشل الحفظ");
            return;
        }
        setMsg("تم الحفظ");
    }

    if (loading) {
        return (
            <div>
                <h1 className="admin-title">الإعدادات</h1>
                <p>جاري التحميل...</p>
            </div>
        );
    }

    return (
        <div>
            <h1 className="admin-title">إعدادات التطبيق</h1>
            <p style={{ color: "var(--adm-muted)", marginBottom: "1rem", fontSize: "0.9rem" }}>
                تُحفظ في Firestore: <code>app_settings/config</code>. يمكن ربطها لاحقاً بواجهة الزبائن والمندوبين.
            </p>
            {msg ? (
                <p style={{ color: msg.includes("فشل") ? "#dc2626" : "#059669", fontWeight: 700 }}>{msg}</p>
            ) : null}

            <form className="admin-card" onSubmit={save} style={{ maxWidth: 420 }}>
                <label style={{ display: "block", fontWeight: 700, marginBottom: "0.35rem" }}>بداية الدوام</label>
                <input
                    className="admin-input"
                    type="time"
                    value={s.workingHoursStart}
                    onChange={(e) => setS((p) => ({ ...p, workingHoursStart: e.target.value }))}
                    style={{ marginBottom: "0.85rem", maxWidth: "100%" }}
                />
                <label style={{ display: "block", fontWeight: 700, marginBottom: "0.35rem" }}>نهاية الدوام</label>
                <input
                    className="admin-input"
                    type="time"
                    value={s.workingHoursEnd}
                    onChange={(e) => setS((p) => ({ ...p, workingHoursEnd: e.target.value }))}
                    style={{ marginBottom: "0.85rem", maxWidth: "100%" }}
                />
                <label style={{ display: "block", fontWeight: 700, marginBottom: "0.35rem" }}>أقصى طلبات نشطة لكل مندوب</label>
                <input
                    className="admin-input"
                    type="number"
                    min={1}
                    max={50}
                    value={s.maxOrdersPerDriver}
                    onChange={(e) => setS((p) => ({ ...p, maxOrdersPerDriver: Number(e.target.value) }))}
                    style={{ marginBottom: "0.85rem", maxWidth: "100%" }}
                />
                <label style={{ display: "block", fontWeight: 700, marginBottom: "0.35rem" }}>هاتف الدعم (اختياري)</label>
                <input
                    className="admin-input"
                    type="tel"
                    value={s.supportPhone}
                    onChange={(e) => setS((p) => ({ ...p, supportPhone: e.target.value }))}
                    style={{ marginBottom: "1rem", maxWidth: "100%" }}
                    dir="ltr"
                />
                <button type="submit" className="admin-btn" disabled={saving}>
                    {saving ? "جاري الحفظ..." : "حفظ"}
                </button>
            </form>
        </div>
    );
}
