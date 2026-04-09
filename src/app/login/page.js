"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function Login() {
    const router = useRouter();
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleLogin(e) {
        e.preventDefault();
        setError("");

        if (!phone.trim()) { setError("الرجاء إدخال رقم الهاتف"); return; }
        if (!password) { setError("الرجاء إدخال كلمة السر"); return; }

        setLoading(true);
        try {
            // 1. Sign in via Firebase Auth (single network call)
            const email = `${phone.trim().replace(/\s/g, "")}@yaslamo.app`;
            const cred = await signInWithEmailAndPassword(auth, email, password);

            // 2. Fetch profile directly from Firestore client-side (fast, no API roundtrip)
            const profileSnap = await getDoc(doc(db, "users", cred.user.uid));

            if (!profileSnap.exists()) {
                setError("الملف الشخصي غير موجود");
                setLoading(false);
                return;
            }

            const profile = profileSnap.data();

            // Save app session to localStorage
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
            router.push("/home");
        } catch (err) {
            console.error(err);
            if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
                setError("رقم الهاتف أو كلمة السر غير صحيحة");
            } else if (err.code === "auth/user-not-found") {
                setError("رقم الهاتف غير مسجل");
            } else {
                setError("حدث خطأ في تسجيل الدخول");
            }
            setLoading(false);
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
                            disabled={loading}
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
            </div>
        </div>
    );
}
