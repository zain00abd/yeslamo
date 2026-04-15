"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { signInWithEmailAndPassword, signOut, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

async function getDocWithRetry(ref, retries = 2, delayMs = 1200) {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            return await getDoc(ref);
        } catch (err) {
            const isOffline = err.code === "unavailable" || err.message?.includes("client is offline");
            if (!isOffline || attempt === retries - 1) throw err;
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }
}

export default function Login() {
    const router = useRouter();
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleLogin(e) {
        e.preventDefault();
        setError("");

        if (!phone.trim()) { setError("الرجاء إدخال رقم الهاتف"); return; }
        if (!password) { setError("الرجاء إدخال كلمة السر"); return; }

        setLoading(true);
        try {
            const rlRes = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: phone.trim() }),
            });
            if (!rlRes.ok) {
                const rlData = await rlRes.json().catch(() => ({}));
                setError(rlData.error || "حدث خطأ في تسجيل الدخول");
                setLoading(false);
                return;
            }

            const email = `${phone.trim().replace(/\s/g, "")}@yaslamo.app`;
            const cred = await signInWithEmailAndPassword(auth, email, password);

            const profileSnap = await getDocWithRetry(doc(db, "users", cred.user.uid));
            if (!profileSnap.exists()) {
                await signOut(auth);
                setError("الملف الشخصي غير موجود");
                setLoading(false);
                return;
            }

            const profile = profileSnap.data();
            localStorage.setItem("yaslamo_user", JSON.stringify({
                id: cred.user.uid,
                name: profile.name,
                phone: profile.phone,
                address: profile.address,
                email,
                city: profile.city || "",
                locationDesc: profile.locationDesc || "",
                locationCoords: profile.locationCoords || null,
                customerStatus: profile.customerStatus || null,
                role: profile.role || "customer",
            }));
            window.dispatchEvent(new Event("yaslamo_auth"));
            router.push("/home");
        } catch (err) {
            console.error(err);
            if (
                err.code === "auth/invalid-credential" ||
                err.code === "auth/wrong-password" ||
                err.code === "auth/user-not-found"
            ) {
                setError("رقم الهاتف أو كلمة السر غير صحيحة");
            } else if (err.code === "auth/too-many-requests") {
                setError("محاولات كثيرة. حاول مجدداً بعد قليل");
            } else if (err.code === "unavailable" || err.message?.includes("client is offline")) {
                setError("لا يوجد اتصال بالإنترنت. تحقق من اتصالك وحاول مجدداً.");
            } else if (err.name === "TypeError" && err.message?.includes("fetch")) {
                setError("تعذّر الوصول إلى الخادم. تحقق من اتصالك بالإنترنت.");
            } else {
                setError("حدث خطأ في تسجيل الدخول");
            }
            setLoading(false);
        }
    }

    async function handleGoogleLogin() {
        setError("");
        setGoogleLoading(true);
        try {
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({ prompt: "select_account" });
            const cred = await signInWithPopup(auth, provider);

            const profileSnap = await getDocWithRetry(doc(db, "users", cred.user.uid));

            if (profileSnap.exists()) {
                const profile = profileSnap.data();
                localStorage.setItem("yaslamo_user", JSON.stringify({
                    id: cred.user.uid,
                    name: profile.name,
                    phone: profile.phone || "",
                    address: profile.address || "",
                    email: cred.user.email,
                    city: profile.city || "",
                    locationDesc: profile.locationDesc || "",
                    locationCoords: profile.locationCoords || null,
                    customerStatus: profile.customerStatus || null,
                    role: profile.role || "customer",
                }));
                window.dispatchEvent(new Event("yaslamo_auth"));
                router.push("/home");
            } else {
                // New Google user — complete registration to fill in address/phone
                router.push("/register?mode=google");
            }
        } catch (err) {
            console.error(err);
            if (
                err.code === "auth/popup-closed-by-user" ||
                err.code === "auth/cancelled-popup-request"
            ) {
                // User closed the popup — no error message needed
            } else if (err.code === "auth/popup-blocked") {
                setError("تم حجب النافذة المنبثقة. يرجى السماح بها من إعدادات المتصفح.");
            } else if (err.code === "unavailable" || err.message?.includes("client is offline")) {
                setError("لا يوجد اتصال بالإنترنت. تحقق من اتصالك وحاول مجدداً.");
            } else {
                setError("حدث خطأ في تسجيل الدخول بحساب Google");
            }
        } finally {
            setGoogleLoading(false);
        }
    }

    return (
        <div className="page-wrapper">
            <div className="top-bar">
                <Link href="/" className="top-bar-logo">
                    <Image src="/logo1.jpg" alt="يسلمو" width={36} height={36} />
                    <span>تسجيل الدخول</span>
                </Link>
                <Link href="/" className="top-bar-back">← الرئيسية</Link>
            </div>

            <div className="content-area" style={{ paddingTop: "30px", paddingBottom: "30px" }}>
                <div style={{ textAlign: "center", marginBottom: "30px" }}>
                    <Image
                        src="/logo1.jpg"
                        alt="يسلمو"
                        width={80}
                        height={80}
                        style={{ borderRadius: "18px", marginBottom: "12px" }}
                    />
                    <h2 style={{ fontSize: "1.3rem", color: "#1a1a2e", fontWeight: "700" }}>
                        مرحباً بعودتك!
                    </h2>
                    <p style={{ color: "#777", fontSize: "0.9rem" }}>
                        سجّل دخولك للمتابعة
                    </p>
                </div>

                {error && (
                    <div style={{
                        background: "#fff0f0",
                        border: "1px solid #ffcdd2",
                        borderRadius: "12px",
                        padding: "12px 16px",
                        marginBottom: "20px",
                        color: "#c62828",
                        fontSize: "0.9rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                    }}>
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="#c62828">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                        </svg>
                        {error}
                    </div>
                )}

                {/* Google Sign-In */}
                <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={googleLoading || loading}
                    style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "10px",
                        padding: "13px 16px",
                        borderRadius: "12px",
                        border: "1.5px solid #dadce0",
                        background: "#fff",
                        color: "#3c4043",
                        fontFamily: "inherit",
                        fontWeight: 600,
                        fontSize: "0.97rem",
                        cursor: googleLoading ? "wait" : "pointer",
                        marginBottom: "18px",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                        transition: "box-shadow 0.15s, border-color 0.15s",
                        opacity: googleLoading || loading ? 0.7 : 1,
                    }}
                >
                    {googleLoading ? (
                        <span style={{ width: "20px", height: "20px", border: "2px solid #dadce0", borderTop: "2px solid #4285f4", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                    ) : (
                        <svg width="20" height="20" viewBox="0 0 48 48">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                            <path fill="none" d="M0 0h48v48H0z" />
                        </svg>
                    )}
                    {googleLoading ? "جاري الدخول..." : "متابعة مع Google"}
                </button>

                {/* Divider */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
                    <div style={{ flex: 1, height: "1px", background: "#e5e7eb" }} />
                    <span style={{ color: "#9ca3af", fontSize: "0.85rem", whiteSpace: "nowrap" }}>أو بالهاتف وكلمة السر</span>
                    <div style={{ flex: 1, height: "1px", background: "#e5e7eb" }} />
                </div>

                <form onSubmit={handleLogin}>
                    <div className="form-section">
                        <div className="section-title">
                            <svg viewBox="0 0 24 24">
                                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                            </svg>
                            <span>رقم الهاتف</span>
                        </div>
                        <input
                            type="tel"
                            className="form-input"
                            placeholder="أدخل رقم هاتفك"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            dir="ltr"
                            style={{ textAlign: "right" }}
                            autoComplete="tel"
                        />
                    </div>

                    <div className="form-section">
                        <div className="section-title">
                            <svg viewBox="0 0 24 24">
                                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z" />
                            </svg>
                            <span>كلمة السر</span>
                        </div>
                        <input
                            type="password"
                            className="form-input"
                            placeholder="أدخل كلمة السر"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                        />
                    </div>

                    <div style={{ paddingTop: "20px" }}>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ width: "100%", opacity: loading ? 0.7 : 1 }}
                            disabled={loading || googleLoading}
                        >
                            {loading ? (
                                "جاري تسجيل الدخول..."
                            ) : (
                                <>
                                    <svg viewBox="0 0 24 24" fill="white" width="20" height="20">
                                        <path d="M11 7L9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12H12v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z" />
                                    </svg>
                                    تسجيل الدخول
                                </>
                            )}
                        </button>
                    </div>

                    <div style={{ textAlign: "center", marginTop: "20px" }}>
                        <span style={{ color: "#777", fontSize: "0.9rem" }}>ليس لديك حساب؟ </span>
                        <Link href="/register" style={{ color: "#ff6b35", fontWeight: "600", fontSize: "0.9rem" }}>
                            إنشاء حساب جديد
                        </Link>
                    </div>
                </form>

                <style>{`
                    @keyframes spin { to { transform: rotate(360deg); } }
                `}</style>
            </div>
        </div>
    );
}
