"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { STORE_CATEGORY_OPTIONS } from "@/lib/admin/storeConstants";
import { DRIVER_CITY_OPTIONS } from "@/lib/admin/driverConstants";

const emptyForm = {
    name: "",
    categoryId: STORE_CATEGORY_OPTIONS[0].id,
    city: DRIVER_CITY_OPTIONS[0],
    phone: "",
    locationDesc: "",
    shortDescription: "",
    featured: false,
    isOpenNow: true,
};

export default function AdminAddStorePage() {
    const router = useRouter();
    const [form, setForm] = useState(emptyForm);
    const [locationCoords, setLocationCoords] = useState(null);
    const [gpsLoading, setGpsLoading] = useState(false);
    const [gpsError, setGpsError] = useState("");
    const [gpsDone, setGpsDone] = useState(false);
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState("");
    const [okMsg, setOkMsg] = useState("");

    useEffect(() => {
        return () => {
            if (imagePreview) URL.revokeObjectURL(imagePreview);
        };
    }, [imagePreview]);

    function getLocation() {
        setGpsError("");
        if (!navigator.geolocation) {
            setGpsError("متصفحك لا يدعم تحديد الموقع");
            return;
        }
        setGpsLoading(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocationCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setGpsDone(true);
                setGpsLoading(false);
            },
            () => {
                setGpsError("تعذّر الحصول على الموقع. تأكد من منح الإذن للمتصفح.");
                setGpsLoading(false);
            },
            { enableHighAccuracy: true, timeout: 15000 },
        );
    }

    function onImagePick(e) {
        const f = e.target.files?.[0];
        if (!f) return;
        if (!f.type.startsWith("image/")) {
            setMsg("الملف يجب أن يكون صورة");
            return;
        }
        setMsg("");
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setImageFile(f);
        setImagePreview(URL.createObjectURL(f));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setMsg("");
        setOkMsg("");

        const name = form.name.trim();
        if (!name) {
            setMsg("أدخل اسم المتجر");
            return;
        }
        if (!gpsDone || !locationCoords) {
            setMsg("حدّد موقع المتجر على الخريطة (زر تحديد الموقع)");
            return;
        }
        if (!form.city.trim()) {
            setMsg("اختر المدينة");
            return;
        }
        if (!form.locationDesc.trim()) {
            setMsg("أدخل العنوان التفصيلي للموقع");
            return;
        }
        if (!form.phone.trim()) {
            setMsg("أدخل هاتف المتجر");
            return;
        }
        if (!imageFile) {
            setMsg("أرفق صورة للمتجر");
            return;
        }

        setSaving(true);
        try {
            const fd = new FormData();
            fd.append("file", imageFile);
            const upRes = await fetch("/api/admin/upload-imgbb", {
                method: "POST",
                body: fd,
                credentials: "include",
            });
            const upJson = await upRes.json();
            if (!upRes.ok) {
                setMsg(upJson.error || "فشل رفع الصورة");
                return;
            }
            const imageUrl = upJson.url;
            if (!imageUrl) {
                setMsg("لم يُرجع رابط الصورة");
                return;
            }

            const res = await fetch("/api/admin/stores", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    name,
                    categoryId: form.categoryId,
                    city: form.city.trim(),
                    locationDesc: form.locationDesc.trim(),
                    locationCoords,
                    phone: form.phone.trim(),
                    imageUrl,
                    shortDescription: form.shortDescription.trim(),
                    featured: form.featured === true,
                    isOpenNow: form.isOpenNow !== false,
                }),
            });
            const j = await res.json();
            if (!res.ok) {
                setMsg(j.error || "فشل الحفظ");
                return;
            }
            setOkMsg("تم تسجيل المتجر بنجاح.");
            setForm(emptyForm);
            setLocationCoords(null);
            setGpsDone(false);
            setImageFile(null);
            setImagePreview((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return null;
            });
            setTimeout(() => router.push("/dashboard/stores"), 800);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div>
            <div style={{ marginBottom: "1rem" }}>
                <Link href="/dashboard/stores" className="admin-btn ghost" style={{ textDecoration: "none", display: "inline-flex" }}>
                    ← العودة للمتاجر
                </Link>
            </div>

            <h1 className="admin-title">إضافة متجر</h1>
            <p style={{ color: "var(--adm-muted)", marginBottom: "1rem", fontSize: "0.92rem" }}>
                جميع الحقول إلزامية بما فيها تحديد الموقع وصورة المتجر (يُرفع عبر imgbb ويُحفظ رابط الصورة).
            </p>

            {msg ? <p className="admin-error">{msg}</p> : null}
            {okMsg ? (
                <p style={{ color: "#059669", fontWeight: 700, marginBottom: "0.75rem" }}>
                    {okMsg}
                </p>
            ) : null}

            <div className="admin-card" style={{ maxWidth: 560 }}>
                <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
                    <div>
                        <label style={{ display: "block", fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.25rem" }}>اسم المتجر</label>
                        <input
                            className="admin-input"
                            style={{ maxWidth: "100%" }}
                            value={form.name}
                            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                            required
                            maxLength={200}
                        />
                    </div>

                    <div>
                        <label style={{ display: "block", fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.25rem" }}>تصنيف المتجر</label>
                        <select
                            className="admin-input"
                            style={{ maxWidth: "100%" }}
                            value={form.categoryId}
                            onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}
                            required
                        >
                            {STORE_CATEGORY_OPTIONS.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: "block", fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.25rem" }}>هاتف المتجر</label>
                        <input
                            className="admin-input"
                            type="tel"
                            dir="ltr"
                            style={{ maxWidth: "100%", textAlign: "right" }}
                            value={form.phone}
                            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                            required
                            maxLength={32}
                        />
                    </div>

                    <div>
                        <label style={{ display: "block", fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.25rem" }}>صورة المتجر</label>
                        <input
                            className="admin-input"
                            type="file"
                            accept="image/*"
                            onChange={onImagePick}
                            style={{ maxWidth: "100%", padding: "0.4rem" }}
                        />
                        {imagePreview ? (
                            <img
                                src={imagePreview}
                                alt=""
                                style={{ marginTop: "0.5rem", maxWidth: "100%", maxHeight: 200, borderRadius: 8, objectFit: "cover" }}
                            />
                        ) : null}
                    </div>

                    {/* موقع المتجر — نفس منطق تسجيل الزبائن */}
                    <div
                        style={{
                            borderTop: "1px solid var(--adm-border, #e5e7eb)",
                            paddingTop: "1rem",
                            marginTop: "0.25rem",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.65rem", fontWeight: 800, fontSize: "0.95rem" }}>
                            <span aria-hidden>📍</span>
                            <span>موقع المتجر</span>
                        </div>

                        <button
                            type="button"
                            onClick={getLocation}
                            disabled={gpsLoading}
                            style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "10px",
                                padding: "12px",
                                borderRadius: "10px",
                                border: `2px dashed ${gpsDone ? "#059669" : "var(--adm-accent, #c2410c)"}`,
                                background: gpsDone ? "#ecfdf5" : "var(--adm-bg-muted, #fff8f6)",
                                color: gpsDone ? "#065f46" : "inherit",
                                fontFamily: "inherit",
                                fontWeight: 700,
                                fontSize: "0.95rem",
                                cursor: gpsLoading ? "wait" : "pointer",
                                marginBottom: "10px",
                            }}
                        >
                            {gpsLoading
                                ? "جاري تحديد الموقع..."
                                : gpsDone && locationCoords
                                  ? `تم تحديد الموقع (${locationCoords.lat.toFixed(4)}, ${locationCoords.lng.toFixed(4)})`
                                  : "تحديد موقع المتجر تلقائياً"}
                        </button>

                        {gpsError ? (
                            <div style={{ color: "#b91c1c", fontSize: "0.85rem", marginBottom: "10px", padding: "8px 12px", background: "#fef2f2", borderRadius: "8px" }}>
                                {gpsError}
                            </div>
                        ) : null}

                        {gpsDone ? (
                            <>
                                <p style={{ color: "var(--adm-muted)", fontSize: "0.85rem", margin: "0 0 10px", lineHeight: 1.5 }}>
                                    اختر المدينة ثم اكتب عنوان المتجر بالتفصيل (الحي، الشارع، معلم قريب).
                                </p>
                                <label style={{ display: "block", fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.25rem" }}>المدينة</label>
                                <select
                                    className="admin-input"
                                    style={{ maxWidth: "100%", marginBottom: "0.65rem" }}
                                    value={form.city}
                                    onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                                    required
                                >
                                    {DRIVER_CITY_OPTIONS.map((c) => (
                                        <option key={c} value={c}>
                                            {c}
                                        </option>
                                    ))}
                                </select>
                                <label style={{ display: "block", fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.25rem" }}>العنوان التفصيلي</label>
                                <textarea
                                    className="admin-input"
                                    style={{ minHeight: "88px", resize: "vertical", maxWidth: "100%" }}
                                    value={form.locationDesc}
                                    onChange={(e) => setForm((p) => ({ ...p, locationDesc: e.target.value }))}
                                    required
                                    maxLength={2000}
                                    placeholder="الحي، الشارع، بجانب أي معلم، رقم البناء..."
                                />
                            </>
                        ) : null}
                    </div>

                    <div>
                        <label style={{ display: "block", fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.25rem" }}>
                            وصف قصير للتطبيق (اختياري — يظهر في بطاقة المتجر)
                        </label>
                        <textarea
                            className="admin-input"
                            style={{ minHeight: "72px", maxWidth: "100%" }}
                            value={form.shortDescription}
                            onChange={(e) => setForm((p) => ({ ...p, shortDescription: e.target.value }))}
                            maxLength={280}
                            placeholder="مثال: توصيل سريع، عروض يومية..."
                        />
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600, fontSize: "0.88rem" }}>
                        <input
                            type="checkbox"
                            checked={form.featured}
                            onChange={(e) => setForm((p) => ({ ...p, featured: e.target.checked }))}
                        />
                        متجر مميز (يظهر في قسم «متاجر مميزة»)
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600, fontSize: "0.88rem" }}>
                        <input
                            type="checkbox"
                            checked={form.isOpenNow}
                            onChange={(e) => setForm((p) => ({ ...p, isOpenNow: e.target.checked }))}
                        />
                        يظهر كـ «مفتوح» في التطبيق
                    </label>

                    <button type="submit" className="admin-btn" style={{ marginTop: "0.35rem" }} disabled={saving}>
                        {saving ? "جاري الحفظ..." : "حفظ المتجر"}
                    </button>
                </form>
            </div>
        </div>
    );
}
