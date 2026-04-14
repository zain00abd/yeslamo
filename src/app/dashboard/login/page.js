"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function AdminLoginPage() {
    const router = useRouter();
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        if (!phone.trim() || !password) {
            setError("أدخل رقم الهاتف وكلمة السر");
            return;
        }
        setLoading(true);
        try {
            // Pre-check rate limit on server before attempting Firebase Auth
            const rlRes = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: phone.trim() }),
            });
            if (!rlRes.ok) {
                const rlData = await rlRes.json().catch(() => ({}));
                setError(rlData.error || "حدث خطأ");
                setLoading(false);
                return;
            }

            const email = `${phone.trim().replace(/\s/g, "")}@yaslamo.app`;
            const cred = await signInWithEmailAndPassword(auth, email, password);
            const profileSnap = await getDoc(doc(db, "users", cred.user.uid));
            if (!profileSnap.exists()) {
                setError("الملف غير موجود");
                setLoading(false);
                return;
            }
            if (profileSnap.data()?.role !== "admin") {
                await auth.signOut();
                setError("هذا الحساب ليس مسؤولاً. سيتم توجيهك للصفحة الرئيسية.");
                setLoading(false);
                setTimeout(() => router.replace("/"), 1600);
                return;
            }
            const idToken = await cred.user.getIdToken();
            const res = await fetch("/api/admin/auth/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ idToken }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                await auth.signOut();
                setError(data.error || "فشل إنشاء الجلسة");
                setLoading(false);
                return;
            }
            router.replace("/dashboard");
            router.refresh();
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
            } else {
                setError("حدث خطأ في تسجيل الدخول");
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="admin-login-page">
            <div className="admin-login-card">
                <h1>لوحة الإدارة</h1>
                <p>تسجيل دخول المسؤولين فقط — حسابك يجب أن يكون role = admin في Firestore.</p>
                {error ? <div className="admin-error">{error}</div> : null}
                <form onSubmit={handleSubmit}>
                    <label htmlFor="admin-phone">رقم الهاتف</label>
                    <input
                        id="admin-phone"
                        type="tel"
                        autoComplete="username"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        dir="ltr"
                        style={{ textAlign: "right" }}
                    />
                    <label htmlFor="admin-pass">كلمة السر</label>
                    <input
                        id="admin-pass"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <button type="submit" className="admin-btn" style={{ width: "100%", marginTop: "0.5rem" }} disabled={loading}>
                        {loading ? "جاري الدخول..." : "دخول"}
                    </button>
                </form>
                <p style={{ marginTop: "1rem", textAlign: "center", fontSize: "0.85rem" }}>
                    <Link href="/" style={{ color: "#ea580c", fontWeight: 700 }}>
                        الصفحة الرئيسية للموقع
                    </Link>
                </p>
            </div>
        </div>
    );
}
