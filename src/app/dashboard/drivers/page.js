"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminDriversPage() {
    const [drivers, setDrivers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [detail, setDetail] = useState(null);
    const [msg, setMsg] = useState("");
    const [okMsg, setOkMsg] = useState("");
    const [menuOpenId, setMenuOpenId] = useState(null);
    const [walletTarget, setWalletTarget] = useState(null);
    const [walletAmount, setWalletAmount] = useState("");
    const [walletLoading, setWalletLoading] = useState(false);
    /** بحث برقم الحساب (8 أرقام) — يُمرَّر كـ q للـ API */
    const [accountSearch, setAccountSearch] = useState("");
    const [searchMode, setSearchMode] = useState(null);

    /** @param {string} [qOverride] — عند تمريره يُستخدم بدل حقل البحث (مثلاً "" لعرض الكل) */
    async function load(qOverride) {
        // تجاهل غير النص (مثلاً إن وُضع onClick={load} بالخطأ فيُمرَّر حدث النقر)
        const q = typeof qOverride === "string" ? qOverride : accountSearch;
        const trimmed = String(q ?? "").trim();
        setLoading(true);
        setMsg("");
        const qs = trimmed ? `?q=${encodeURIComponent(trimmed)}` : "";
        const res = await fetch(`/api/admin/drivers${qs}`, { credentials: "include" });
        const j = await res.json();
        if (res.ok) {
            setDrivers(j.drivers || []);
            setSearchMode(j.searchMode || null);
        } else {
            setMsg(j.error || "خطأ");
            setSearchMode(null);
        }
        setLoading(false);
    }

    useEffect(() => {
        load();
    }, []);

    useEffect(() => {
        if (menuOpenId == null) return;
        const onDoc = (e) => {
            const wrap = e.target.closest?.(".admin-driver-menu-wrap");
            if (!wrap) setMenuOpenId(null);
        };
        document.addEventListener("click", onDoc);
        return () => document.removeEventListener("click", onDoc);
    }, [menuOpenId]);

    async function toggleEnabled(d) {
        setMsg("");
        setOkMsg("");
        const res = await fetch("/api/admin/drivers", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ userId: d.id, driverEnabled: !d.driverEnabled }),
        });
        const j = await res.json();
        if (!res.ok) {
            setMsg(j.error || "فشل");
            return;
        }
        load();
    }

    async function submitWallet(e) {
        e.preventDefault();
        if (!walletTarget) return;
        const amount = Number(walletAmount.replace(/,/g, "."));
        if (!Number.isFinite(amount) || amount <= 0) {
            setMsg("أدخل مبلغاً صالحاً");
            return;
        }
        setWalletLoading(true);
        setMsg("");
        setOkMsg("");
        try {
            const res = await fetch(`/api/admin/drivers/${walletTarget.id}/wallet`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ amountSyp: amount }),
            });
            const j = await res.json();
            if (!res.ok) {
                setMsg(j.error || "فشل الشحن");
                return;
            }
            setOkMsg(`تم شحن الرصيد. الرصيد الحالي: ${j.walletBalanceSyp} ل.س`);
            setWalletTarget(null);
            setWalletAmount("");
            load();
        } finally {
            setWalletLoading(false);
        }
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
                    المندوبون
                </h1>
                <Link href="/dashboard/drivers/add" className="admin-btn" style={{ textDecoration: "none" }}>
                    + إضافة مندوب
                </Link>
            </div>

            {msg ? <p className="admin-error">{msg}</p> : null}
            {okMsg ? (
                <p style={{ color: "#059669", fontWeight: 700, marginBottom: "0.75rem" }}>
                    {okMsg}
                </p>
            ) : null}

            <div className="admin-toolbar" style={{ flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", flex: "1 1 280px" }}>
                    <label style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--adm-muted)", whiteSpace: "nowrap" }}>
                        بحث برقم الحساب
                    </label>
                    <input
                        className="admin-input"
                        type="search"
                        dir="ltr"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="8 أرقام"
                        style={{ maxWidth: 160, fontVariantNumeric: "tabular-nums" }}
                        value={accountSearch}
                        onChange={(e) => setAccountSearch(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                load();
                            }
                        }}
                    />
                    <button type="button" className="admin-btn" onClick={() => load()}>
                        بحث
                    </button>
                    {accountSearch.trim() ? (
                        <button
                            type="button"
                            className="admin-btn ghost"
                            onClick={() => {
                                setAccountSearch("");
                                load("");
                            }}
                        >
                            عرض الكل
                        </button>
                    ) : null}
                </div>
                <button type="button" className="admin-btn ghost" onClick={() => load()}>
                    تحديث القائمة
                </button>
            </div>
            {searchMode === "account" ? (
                <p style={{ fontSize: "0.85rem", color: "var(--adm-muted)", marginBottom: "0.75rem", fontWeight: 600 }}>
                    عرض نتائج البحث برقم الحساب فقط.
                </p>
            ) : null}

            <div className="admin-card" style={{ padding: 0 }}>
                <div className="admin-table-wrap">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>الاسم</th>
                                <th>الكنية</th>
                                <th>العمر</th>
                                <th>الهاتف</th>
                                <th>المدينة</th>
                                <th>التوصيل</th>
                                <th>رقم الحساب</th>
                                <th>رصيد (ل.س)</th>
                                <th>متاح</th>
                                <th>طلبات</th>
                                <th>التفعيل</th>
                                <th style={{ width: 56 }}> </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={12}>...</td>
                                </tr>
                            ) : drivers.length === 0 ? (
                                <tr>
                                    <td colSpan={12} style={{ color: "var(--adm-muted)" }}>
                                        لا يوجد مندوبون —{" "}
                                        <Link href="/dashboard/drivers/add" style={{ color: "var(--adm-accent)", fontWeight: 700 }}>
                                            إضافة مندوب
                                        </Link>
                                    </td>
                                </tr>
                            ) : (
                                drivers.map((d) => (
                                    <tr key={d.id}>
                                        <td>{d.name}</td>
                                        <td>{d.nickname || "—"}</td>
                                        <td>{d.age != null ? d.age : "—"}</td>
                                        <td dir="ltr" style={{ textAlign: "right" }}>
                                            {d.phone}
                                        </td>
                                        <td>{d.city}</td>
                                        <td style={{ fontSize: "0.82rem", maxWidth: 120 }}>{d.vehicleType}</td>
                                        <td dir="ltr" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: "0.88rem" }}>
                                            {d.driverAccountNumber || "—"}
                                        </td>
                                        <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 800 }}>
                                            {typeof d.walletBalanceSyp === "number" ? d.walletBalanceSyp : 0}
                                        </td>
                                        <td>{d.isAvailable ? "نعم" : "لا"}</td>
                                        <td>{d.totalOrders}</td>
                                        <td>{d.driverEnabled ? "مفعّل" : "معطّل"}</td>
                                        <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                                            <div className="admin-driver-menu-wrap" style={{ position: "relative", display: "inline-block" }}>
                                                <button
                                                    type="button"
                                                    className="admin-menu-dots"
                                                    aria-expanded={menuOpenId === d.id}
                                                    aria-haspopup="menu"
                                                    aria-label="إجراءات المندوب"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setMenuOpenId((cur) => (cur === d.id ? null : d.id));
                                                    }}
                                                >
                                                    ⋯
                                                </button>
                                                {menuOpenId === d.id ? (
                                                    <div className="admin-driver-dropdown" role="menu">
                                                        <button
                                                            type="button"
                                                            role="menuitem"
                                                            className="admin-driver-dropdown-item"
                                                            onClick={() => {
                                                                setWalletTarget(d);
                                                                setWalletAmount("");
                                                                setMsg("");
                                                                setMenuOpenId(null);
                                                            }}
                                                        >
                                                            شحن رصيد
                                                        </button>
                                                        <button
                                                            type="button"
                                                            role="menuitem"
                                                            className="admin-driver-dropdown-item"
                                                            onClick={() => {
                                                                setDetail(d);
                                                                setMenuOpenId(null);
                                                            }}
                                                        >
                                                            تفاصيل
                                                        </button>
                                                        <button
                                                            type="button"
                                                            role="menuitem"
                                                            className={`admin-driver-dropdown-item${d.driverEnabled ? " danger" : ""}`}
                                                            onClick={() => {
                                                                toggleEnabled(d);
                                                                setMenuOpenId(null);
                                                            }}
                                                        >
                                                            {d.driverEnabled ? "تعطيل الحساب" : "تفعيل الحساب"}
                                                        </button>
                                                    </div>
                                                ) : null}
                                            </div>
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
                        <h3>
                            {detail.name} {detail.nickname ? detail.nickname : ""}
                        </h3>
                        <p>
                            <strong>الهاتف:</strong> <span dir="ltr">{detail.phone}</span>
                        </p>
                        <p>
                            <strong>العمر:</strong> {detail.age != null ? detail.age : "—"}
                        </p>
                        <p>
                            <strong>المدينة:</strong> {detail.city}
                        </p>
                        <p>
                            <strong>وسيلة التوصيل:</strong> {detail.vehicleType}
                        </p>
                        {detail.driverAccountNumber ? (
                            <p>
                                <strong>رقم الحساب (للاستعلام وشحن الرصيد):</strong>{" "}
                                <span dir="ltr" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 800 }}>
                                    {detail.driverAccountNumber}
                                </span>
                            </p>
                        ) : null}
                        <p>
                            <strong>رصيد المحفظة:</strong> {detail.walletBalanceSyp ?? 0} ل.س
                        </p>
                        <p>
                            <strong>متاح للطلبات:</strong> {detail.isAvailable ? "نعم" : "لا"}
                        </p>
                        <p>
                            <strong>إجمالي الطلبات:</strong> {detail.totalOrders}
                        </p>
                        <p>
                            <strong>حالة الحساب:</strong> {detail.driverEnabled ? "مفعّل" : "معطّل"}
                        </p>
                        <button type="button" className="admin-btn secondary" style={{ marginTop: "1rem", width: "100%" }} onClick={() => setDetail(null)}>
                            إغلاق
                        </button>
                    </div>
                </div>
            ) : null}

            {walletTarget ? (
                <div className="admin-modal-overlay" onClick={() => !walletLoading && setWalletTarget(null)}>
                    <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>شحن رصيد — {walletTarget.name}</h3>
                        <p style={{ fontSize: "0.88rem", color: "var(--adm-muted)" }}>
                            الرصيد الحالي: <strong>{walletTarget.walletBalanceSyp ?? 0}</strong> ل.س
                        </p>
                        <form onSubmit={submitWallet}>
                            <label style={{ display: "block", fontWeight: 700, marginBottom: "0.35rem" }}>المبلغ (ل.س جديدة)</label>
                            <input
                                className="admin-input"
                                type="number"
                                min={1}
                                step="any"
                                dir="ltr"
                                style={{ maxWidth: "100%", marginBottom: "1rem" }}
                                value={walletAmount}
                                onChange={(e) => setWalletAmount(e.target.value)}
                                autoFocus
                                required
                            />
                            <button type="submit" className="admin-btn" style={{ width: "100%" }} disabled={walletLoading}>
                                {walletLoading ? "جاري الشحن..." : "تأكيد الشحن"}
                            </button>
                            <button
                                type="button"
                                className="admin-btn ghost"
                                style={{ width: "100%", marginTop: "0.5rem" }}
                                disabled={walletLoading}
                                onClick={() => setWalletTarget(null)}
                            >
                                إلغاء
                            </button>
                        </form>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
