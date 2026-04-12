"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    DRIVER_CITY_OPTIONS,
    DRIVER_VEHICLE_OPTIONS,
    DRIVER_AGE_MIN,
    DRIVER_AGE_MAX,
} from "@/lib/admin/driverConstants";

const emptyForm = {
    firstName: "",
    nickname: "",
    age: "",
    phone: "",
    password: "",
    city: DRIVER_CITY_OPTIONS[0],
    vehicleType: DRIVER_VEHICLE_OPTIONS[0],
};

export default function AdminAddDriverPage() {
    const router = useRouter();
    const [form, setForm] = useState(emptyForm);
    const [creating, setCreating] = useState(false);
    const [msg, setMsg] = useState("");
    const [okMsg, setOkMsg] = useState("");

    async function handleCreateDriver(e) {
        e.preventDefault();
        setMsg("");
        setOkMsg("");
        const ageNum = Number(form.age);
        if (!Number.isFinite(ageNum) || ageNum < DRIVER_AGE_MIN || ageNum > DRIVER_AGE_MAX) {
            setMsg(`العمر يجب أن يكون بين ${DRIVER_AGE_MIN} و ${DRIVER_AGE_MAX}`);
            return;
        }
        setCreating(true);
        try {
            const res = await fetch("/api/admin/drivers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    firstName: form.firstName.trim(),
                    nickname: form.nickname.trim(),
                    age: ageNum,
                    phone: form.phone.trim(),
                    password: form.password,
                    city: form.city,
                    vehicleType: form.vehicleType,
                }),
            });
            const j = await res.json();
            if (!res.ok) {
                setMsg(j.error || "فشل الإنشاء");
                return;
            }
            const acc = typeof j.driverAccountNumber === "string" && j.driverAccountNumber ? j.driverAccountNumber : null;
            setOkMsg(
                acc
                    ? `تم إنشاء حساب المندوب بنجاح. رقم الحساب للاستعلام وشحن الرصيد: ${acc}`
                    : "تم إنشاء حساب المندوب بنجاح.",
            );
            setForm(emptyForm);
            setTimeout(() => router.push("/dashboard/drivers"), 900);
        } finally {
            setCreating(false);
        }
    }

    return (
        <div>
            <div style={{ marginBottom: "1rem" }}>
                <Link href="/dashboard/drivers" className="admin-btn ghost" style={{ textDecoration: "none", display: "inline-flex" }}>
                    ← العودة لقائمة المندوبين
                </Link>
            </div>

            <h1 className="admin-title">إضافة مندوب جديد</h1>
            <p style={{ color: "var(--adm-muted)", marginBottom: "1rem", fontSize: "0.92rem" }}>
                يُنشأ حساب دخول للتطبيق بنفس رقم الهاتف وكلمة السر التي تدخلها هنا.
            </p>

            {msg ? <p className="admin-error">{msg}</p> : null}
            {okMsg ? (
                <p style={{ color: "#059669", fontWeight: 700, marginBottom: "0.75rem" }}>
                    {okMsg}
                </p>
            ) : null}

            <div className="admin-card" style={{ maxWidth: 560 }}>
                <form onSubmit={handleCreateDriver} style={{ display: "grid", gap: "0.65rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
                        <div>
                            <label style={{ display: "block", fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.25rem" }}>الاسم</label>
                            <input
                                className="admin-input"
                                style={{ maxWidth: "100%" }}
                                value={form.firstName}
                                onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                                required
                            />
                        </div>
                        <div>
                            <label style={{ display: "block", fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.25rem" }}>الكنية</label>
                            <input
                                className="admin-input"
                                style={{ maxWidth: "100%" }}
                                value={form.nickname}
                                onChange={(e) => setForm((p) => ({ ...p, nickname: e.target.value }))}
                                required
                            />
                        </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
                        <div>
                            <label style={{ display: "block", fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.25rem" }}>
                                العمر ({DRIVER_AGE_MIN}–{DRIVER_AGE_MAX})
                            </label>
                            <input
                                className="admin-input"
                                type="number"
                                min={DRIVER_AGE_MIN}
                                max={DRIVER_AGE_MAX}
                                step={1}
                                style={{ maxWidth: "100%" }}
                                value={form.age}
                                onChange={(e) => setForm((p) => ({ ...p, age: e.target.value }))}
                                required
                            />
                        </div>
                        <div>
                            <label style={{ display: "block", fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.25rem" }}>رقم الهاتف</label>
                            <input
                                className="admin-input"
                                type="tel"
                                dir="ltr"
                                style={{ maxWidth: "100%", textAlign: "right" }}
                                value={form.phone}
                                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label style={{ display: "block", fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.25rem" }}>كلمة السر (للدخول للتطبيق)</label>
                        <input
                            className="admin-input"
                            type="password"
                            autoComplete="new-password"
                            style={{ maxWidth: "100%" }}
                            value={form.password}
                            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                            minLength={6}
                            required
                        />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
                        <div>
                            <label style={{ display: "block", fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.25rem" }}>المدينة</label>
                            <select
                                className="admin-select"
                                style={{ maxWidth: "100%" }}
                                value={form.city}
                                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                            >
                                {DRIVER_CITY_OPTIONS.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: "block", fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.25rem" }}>وسيلة التوصيل</label>
                            <select
                                className="admin-select"
                                style={{ maxWidth: "100%" }}
                                value={form.vehicleType}
                                onChange={(e) => setForm((p) => ({ ...p, vehicleType: e.target.value }))}
                            >
                                {DRIVER_VEHICLE_OPTIONS.map((v) => (
                                    <option key={v} value={v}>
                                        {v}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.35rem" }}>
                        <button type="submit" className="admin-btn" disabled={creating}>
                            {creating ? "جاري الإنشاء..." : "إنشاء المندوب"}
                        </button>
                        <Link href="/dashboard/drivers" className="admin-btn ghost" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                            إلغاء
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
