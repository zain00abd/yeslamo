"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { auth, db } from "@/lib/firebase";
import { showAppAlert } from "@/lib/appAlert";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import "../driver.css";

const DRIVER_AREA_ID = "default";
const DRIVER_SETTINGS_DEFAULT = {
    name: "",
    phone: "",
    vehicleType: "",
    area: DRIVER_AREA_ID,
    isAvailable: true,
    soundAlerts: true,
    vibrationAlerts: true,
};

export default function DriverSettingsPage() {
    const [user, setUser] = useState(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [isDriver, setIsDriver] = useState(false);
    const [roleChecked, setRoleChecked] = useState(false);
    const [settings, setSettings] = useState(DRIVER_SETTINGS_DEFAULT);
    const [isSaving, setIsSaving] = useState(false);
    const [installPrompt, setInstallPrompt] = useState(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [walletBalanceSyp, setWalletBalanceSyp] = useState(null);
    /** رقم الحساب للاستعلام وشحن الرصيد (من الإدارة) */
    const [driverAccountNumber, setDriverAccountNumber] = useState(null);

    const settingsStorageKey = user ? `yaslamo_driver_settings_${user.uid}` : null;

    useEffect(() => {
        document.body.classList.add("driver-app");
        const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
            setUser(firebaseUser);
            setAuthChecked(true);
        });
        return () => {
            document.body.classList.remove("driver-app");
            unsubscribe();
        };
    }, []);

    useEffect(() => {
        const loadSettings = async () => {
            if (!user || !settingsStorageKey) return;

            let base = {
                ...DRIVER_SETTINGS_DEFAULT,
                name: user.displayName || "",
                phone: user.phoneNumber || "",
            };

            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    const profile = userDoc.data();
                    setIsDriver(profile?.role === "driver");
                    base = {
                        ...base,
                        name: profile?.name || base.name,
                        phone: profile?.phone || base.phone,
                        vehicleType: profile?.vehicleType || "",
                        area: profile?.area || profile?.city || base.area,
                    };
                }
            } catch (err) {
                console.error("load driver profile error:", err);
                setIsDriver(false);
            } finally {
                setRoleChecked(true);
            }

            try {
                const raw = localStorage.getItem(settingsStorageKey);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    setSettings({ ...base, ...parsed });
                    return;
                }
                setSettings(base);
                localStorage.setItem(settingsStorageKey, JSON.stringify(base));
            } catch (err) {
                console.error("load local driver settings error:", err);
                setSettings(base);
            }
        };

        loadSettings();
    }, [user, settingsStorageKey]);

    useEffect(() => {
        if (!user?.uid || !isDriver) {
            setWalletBalanceSyp(null);
            return;
        }
        const unsub = onSnapshot(
            doc(db, "users", user.uid),
            (snap) => {
                if (!snap.exists()) {
                    setWalletBalanceSyp(0);
                    return;
                }
                const data = snap.data();
                const w = data.walletBalanceSyp;
                setWalletBalanceSyp(typeof w === "number" && !Number.isNaN(w) ? w : 0);
                setDriverAccountNumber(typeof data.driverAccountNumber === "string" ? data.driverAccountNumber : "");
            },
            (err) => console.error("wallet snapshot:", err)
        );
        return () => unsub();
    }, [user, isDriver]);

    useEffect(() => {
        const standaloneMatch = window.matchMedia("(display-mode: standalone)").matches;
        const iosStandalone = window.navigator.standalone === true;
        if (standaloneMatch || iosStandalone) setIsInstalled(true);

        function onBeforeInstallPrompt(e) {
            e.preventDefault();
            setInstallPrompt(e);
        }

        function onInstalled() {
            setIsInstalled(true);
            setInstallPrompt(null);
        }

        window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
        window.addEventListener("appinstalled", onInstalled);
        return () => {
            window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
            window.removeEventListener("appinstalled", onInstalled);
        };
    }, []);

    const saveSettings = useCallback(() => {
        if (!settingsStorageKey) return;
        setIsSaving(true);
        try {
            const clean = {
                ...settings,
                name: String(settings.name || "").trim(),
                phone: String(settings.phone || "").trim(),
                vehicleType: String(settings.vehicleType || "").trim(),
                area: String(settings.area || "").trim() || DRIVER_AREA_ID,
            };
            setSettings(clean);
            localStorage.setItem(settingsStorageKey, JSON.stringify(clean));
            showAppAlert("تم حفظ الإعدادات بنجاح");
        } catch (err) {
            console.error("save local driver settings error:", err);
            showAppAlert("تعذر حفظ الإعدادات");
        } finally {
            setIsSaving(false);
        }
    }, [settings, settingsStorageKey]);

    async function handleInstallApp() {
        if (!installPrompt || isInstalled) return;
        installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        if (choice?.outcome === "accepted") {
            setInstallPrompt(null);
        }
    }

    if (!authChecked) {
        return (
            <div className="driver-layout" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
                <div style={{ color: "var(--driver-text-muted)" }}>...</div>
            </div>
        );
    }
    if (!user) {
        return (
            <div className="driver-layout" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "24px" }}>
                <div className="empty-state">
                    <div style={{ fontWeight: 800, marginBottom: "8px" }}>يجب تسجيل الدخول أولاً</div>
                    <Link href="/driver" className="order-details-btn" style={{ marginTop: "8px" }}>
                        العودة إلى صفحة المندوب
                    </Link>
                </div>
            </div>
        );
    }
    if (!roleChecked) {
        return (
            <div className="driver-layout" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
                <div style={{ color: "var(--driver-text-muted)" }}>...</div>
            </div>
        );
    }
    if (!isDriver) {
        return (
            <div className="driver-layout" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "24px" }}>
                <div className="empty-state">
                    <div style={{ fontWeight: 800, marginBottom: "8px" }}>غير مخول لدخول إعدادات المندوب</div>
                    <Link href="/" className="order-details-btn" style={{ marginTop: "8px" }}>
                        العودة للرئيسية
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="driver-layout">
            <header className="driver-header">
                <div className="driver-title">إعدادات المندوب</div>
                <div className="driver-settings-header-actions">
                    <Link href="/driver" className="driver-settings-back-link">
                        رجوع
                    </Link>
                </div>
            </header>

            <main className="driver-content">
                <div className="section-heading">رصيد المحفظة</div>
                <div className="accepted-card" style={{ padding: "16px", marginBottom: "14px" }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--driver-text-muted)", marginBottom: "6px" }}>الرصيد الحالي (ل.س جديدة)</div>
                    <div style={{ fontSize: "1.65rem", fontWeight: 900, color: "var(--driver-primary)", fontVariantNumeric: "tabular-nums" }}>
                        {walletBalanceSyp === null ? "…" : `${walletBalanceSyp} ل.س`}
                    </div>
                </div>

                <div className="section-heading">إعدادات الحساب</div>

                <div className="accepted-card" style={{ padding: "14px" }}>
                    <div className="driver-profile-card">
                        <div className="driver-profile-title">بيانات المندوب</div>
                        <div className="driver-profile-list">
                            <div className="driver-profile-item">
                                <span className="driver-profile-label">رقم حساب المندوب</span>
                                <span className="driver-profile-value" dir="ltr">{driverAccountNumber || "—"}</span>
                            </div>
                            <div className="driver-profile-item">
                                <span className="driver-profile-label">الاسم</span>
                                <span className="driver-profile-value">{settings.name || "—"}</span>
                            </div>
                            <div className="driver-profile-item">
                                <span className="driver-profile-label">رقم الهاتف</span>
                                <span className="driver-profile-value" dir="ltr">{settings.phone || "—"}</span>
                            </div>
                            <div className="driver-profile-item">
                                <span className="driver-profile-label">وسيلة النقل</span>
                                <span className="driver-profile-value">{settings.vehicleType || "—"}</span>
                            </div>
                            <div className="driver-profile-item">
                                <span className="driver-profile-label">المنطقة</span>
                                <span className="driver-profile-value">{settings.area || "—"}</span>
                            </div>
                        </div>
                    </div>

                    <div className="driver-settings-toggles">
                        <label className="driver-toggle-item">
                            <input
                                type="checkbox"
                                checked={settings.isAvailable}
                                onChange={(e) => setSettings((prev) => ({ ...prev, isAvailable: e.target.checked }))}
                            />
                            <span>متاح لاستقبال الطلبات</span>
                        </label>
                        <label className="driver-toggle-item">
                            <input
                                type="checkbox"
                                checked={settings.soundAlerts}
                                onChange={(e) => setSettings((prev) => ({ ...prev, soundAlerts: e.target.checked }))}
                            />
                            <span>تشغيل صوت التنبيهات</span>
                        </label>
                        <label className="driver-toggle-item">
                            <input
                                type="checkbox"
                                checked={settings.vibrationAlerts}
                                onChange={(e) => setSettings((prev) => ({ ...prev, vibrationAlerts: e.target.checked }))}
                            />
                            <span>تشغيل الاهتزاز عند التنبيه</span>
                        </label>
                    </div>

                    <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                        <button
                            onClick={saveSettings}
                            disabled={isSaving}
                            style={{ flex: 1, padding: "11px", borderRadius: "8px", border: "none", background: "var(--driver-primary)", color: "white", fontFamily: "inherit", fontWeight: 700, cursor: "pointer", opacity: isSaving ? 0.8 : 1 }}
                        >
                            {isSaving ? "جاري الحفظ..." : "حفظ الإعدادات"}
                        </button>
                    </div>
                </div>

                <div className="section-heading" style={{ marginTop: "16px" }}>تطبيق المندوب</div>
                <div className="accepted-card" style={{ padding: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                        <Image
                            src="/logo5.png"
                            alt="يسلمو Driver"
                            width={46}
                            height={46}
                            style={{ borderRadius: "10px", objectFit: "cover", border: "1px solid var(--driver-border)" }}
                        />
                        <div>
                            <div style={{ fontWeight: 900, color: "var(--driver-text)" }}>تثبيت تطبيق المندوب</div>
                            <div style={{ fontSize: "0.84rem", color: "var(--driver-text-muted)", fontWeight: 600 }}>
                                افتح التطبيق كشاشة مستقلة للوصول السريع.
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleInstallApp}
                        disabled={!installPrompt || isInstalled}
                        style={{
                            width: "100%",
                            padding: "12px",
                            borderRadius: "10px",
                            border: "none",
                            background: !installPrompt || isInstalled ? "rgba(148, 163, 184, 0.35)" : "var(--driver-primary)",
                            color: "white",
                            fontFamily: "inherit",
                            fontWeight: 800,
                            cursor: !installPrompt || isInstalled ? "not-allowed" : "pointer",
                        }}
                    >
                        {isInstalled ? "✅ التطبيق مثبت بالفعل" : "📲 تثبيت التطبيق"}
                    </button>

                    {!isInstalled && !installPrompt && (
                        <div style={{ marginTop: "8px", fontSize: "0.8rem", color: "var(--driver-text-muted)", fontWeight: 600 }}>
                            على iPhone: Safari ← زر المشاركة ← Add to Home Screen
                        </div>
                    )}
                </div>

                <button
                    type="button"
                    className="driver-logout-btn"
                    onClick={() => auth.signOut()}
                    style={{ width: "100%", marginTop: "16px", background: "#dc2626" }}
                >
                    تسجيل الخروج
                </button>
            </main>
        </div>
    );
}
