"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { showAppConfirm } from "@/lib/appConfirm";

export default function AccountPage() {
    const [user, setUser] = useState(null);
    const [loaded, setLoaded] = useState(false);
    const [installPrompt, setInstallPrompt] = useState(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const router = useRouter();

    useEffect(() => {
        try {
            const stored = localStorage.getItem("yaslamo_user");
            if (stored) setUser(JSON.parse(stored));
            else router.replace("/login");
        } catch (e) {}
        setLoaded(true);
    }, []);

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

    async function handleLogout() {
        const ok = await showAppConfirm("هل تريد تسجيل الخروج؟");
        if (!ok) return;
        try {
            await signOut(auth);
        } catch (e) {
            console.error(e);
        }
        localStorage.removeItem("yaslamo_user");
        window.dispatchEvent(new Event("yaslamo_auth"));
        router.replace("/login");
    }

    async function handleInstall() {
        if (!installPrompt || isInstalled) return;
        installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        if (choice?.outcome === "accepted") {
            setInstallPrompt(null);
        }
    }

    if (!loaded) return null;
    if (!user) return null;

    const infoRows = [
        { icon: "👤", label: "الاسم", value: user.name },
        { icon: "📞", label: "رقم الهاتف", value: user.phone, dir: "ltr" },
        { icon: "📍", label: "المدينة", value: user.city || "—" },
        { icon: "🏠", label: "العنوان", value: user.locationDesc || user.address || "—" },
    ].filter(r => r.value);

    const actions = [
        { icon: "✏️", label: "تعديل بيانات الحساب", href: "/register", color: "#ff6b35" },
        { icon: "📦", label: "إنشاء طلب جديد", href: "/create-order", color: "#10b981" },
        { icon: "🔍", label: "تتبع طلب", href: "/track-order", color: "#6366f1" },
    ];

    return (
        <div className="page-wrapper has-bottom-nav">
            {/* Header */}
            <div style={{
                width: "100%", background: "var(--primary)",
                padding: "40px 20px 60px", textAlign: "center", position: "relative", overflow: "hidden",
            }}>
                {/* deco circles */}
                <div style={{ position: "absolute", top: -30, right: -30, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.07)", pointerEvents: "none" }} />
                <div style={{ position: "absolute", bottom: -20, left: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />

                {/* Avatar */}
                <div style={{
                    width: 80, height: 80, borderRadius: "50%",
                    background: "rgba(255,255,255,0.25)",
                    border: "3px solid rgba(255,255,255,0.5)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 14px", fontSize: "2.2rem",
                }}>
                    👤
                </div>
                <div style={{ color: "white", fontWeight: 800, fontSize: "1.4rem", marginBottom: "4px" }}>{user.name}</div>
                <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.9rem", fontWeight: 600 }} dir="ltr">{user.phone}</div>

                {/* Rounded bottom edge */}
                <div style={{ position: "absolute", bottom: -1, left: 0, right: 0, height: 32, background: "var(--bg-page)", borderRadius: "32px 32px 0 0" }} />
            </div>

            <div style={{ width: "100%", maxWidth: "600px", margin: "0 auto", padding: "0 16px" }}>

                {/* Info Card */}
                <div style={{
                    background: "white", borderRadius: "20px", overflow: "hidden",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.06)", border: "1px solid #f0f0f0",
                    marginTop: "12px", marginBottom: "16px",
                }}>
                    <div style={{ padding: "14px 20px", borderBottom: "1px solid #f5f5f5", fontSize: "0.78rem", fontWeight: 800, color: "#aaa", letterSpacing: "0.06em" }}>
                        معلومات الحساب
                    </div>
                    {infoRows.map((row, i) => (
                        <div key={i} style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "16px 20px",
                            borderBottom: i < infoRows.length - 1 ? "1px solid #f9f9f9" : "none",
                        }}>
                            <span style={{ color: "#888", fontSize: "0.9rem", fontWeight: 600 }}>{row.icon} {row.label}</span>
                            <span style={{ fontWeight: 700, color: "#1a1a2e", fontSize: "0.95rem", maxWidth: "55%", textAlign: "start" }} dir={row.dir || "rtl"}>{row.value}</span>
                        </div>
                    ))}
                </div>

                {/* Quick Actions */}
                <div style={{
                    background: "white", borderRadius: "20px", overflow: "hidden",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.06)", border: "1px solid #f0f0f0",
                    marginBottom: "16px",
                }}>
                    <div style={{ padding: "14px 20px", borderBottom: "1px solid #f5f5f5", fontSize: "0.78rem", fontWeight: 800, color: "#aaa", letterSpacing: "0.06em" }}>
                        الخدمات
                    </div>
                    {actions.map((action, i) => (
                        <Link key={i} href={action.href} style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "16px 20px", textDecoration: "none",
                            borderBottom: "1px solid #f9f9f9",
                        }}>
                            <span style={{ fontWeight: 700, color: "#1a1a2e", fontSize: "0.95rem" }}>
                                {action.icon} {action.label}
                            </span>
                            <svg viewBox="0 0 24 24" width="18" height="18" fill={action.color}>
                                <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z" />
                            </svg>
                        </Link>
                    ))}
                    <button
                        onClick={handleInstall}
                        disabled={!installPrompt || isInstalled}
                        style={{
                            width: "100%",
                            border: "none",
                            background: "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "16px 20px",
                            cursor: !installPrompt || isInstalled ? "not-allowed" : "pointer",
                            opacity: !installPrompt || isInstalled ? 0.55 : 1,
                            fontFamily: "inherit",
                        }}
                    >
                        <span style={{ fontWeight: 700, color: "#1a1a2e", fontSize: "0.95rem" }}>
                            📲 {isInstalled ? "التطبيق مثبت بالفعل" : "تثبيت التطبيق"}
                        </span>
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="#0f766e">
                            <path d="M5 20h14v-2H5v2zm7-18l-5.5 5.5 1.42 1.42L11 6.84V16h2V6.84l3.08 3.08 1.42-1.42L12 2z" />
                        </svg>
                    </button>
                </div>

                {/* Legal */}
                <div style={{
                    background: "white", borderRadius: "20px", overflow: "hidden",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.06)", border: "1px solid #f0f0f0",
                    marginBottom: "16px",
                }}>
                    {[
                        { label: "الشروط والأحكام", href: "/terms" },
                        { label: "سياسة الخصوصية", href: "/privacy" },
                    ].map((item, i) => (
                        <Link key={i} href={item.href} style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "16px 20px", textDecoration: "none",
                            borderBottom: i === 0 ? "1px solid #f9f9f9" : "none",
                        }}>
                            <span style={{ fontWeight: 700, color: "#1a1a2e", fontSize: "0.95rem" }}>📄 {item.label}</span>
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="#aaa">
                                <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z" />
                            </svg>
                        </Link>
                    ))}
                </div>

                {/* Logout */}
                <button
                    onClick={handleLogout}
                    style={{
                        width: "100%", padding: "16px", borderRadius: "16px",
                        border: "1.5px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.04)",
                        color: "#ef4444", fontFamily: "inherit", fontWeight: 800, fontSize: "1rem",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                        marginBottom: "24px",
                    }}
                >
                    🚪 تسجيل الخروج
                </button>
            </div>
        </div>
    );
}
