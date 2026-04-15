"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Footer from "./components/Footer";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

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

export default function Home() {
  const [loaded, setLoaded] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState("");
  const router = useRouter();

  useEffect(() => {
    try {
      const userData = localStorage.getItem("yaslamo_user");
      if (userData) {
        router.replace("/home");
        return;
      }
    } catch (e) {}
    setLoaded(true);
  }, []);

  async function handleGoogleLogin() {
    setGoogleError("");
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const cred = await signInWithPopup(auth, provider);

      const profileSnap = await getDocWithRetry(doc(db, "users", cred.user.uid));
      if (profileSnap.exists()) {
        const profile = profileSnap.data();
        localStorage.setItem(
          "yaslamo_user",
          JSON.stringify({
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
          }),
        );
        window.dispatchEvent(new Event("yaslamo_auth"));
        router.push("/home");
      } else {
        router.push("/register?mode=google");
      }
    } catch (err) {
      if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
        // user cancelled popup: keep silent
      } else if (err.code === "auth/popup-blocked") {
        setGoogleError("تم حجب النافذة المنبثقة. يرجى السماح بها من إعدادات المتصفح.");
      } else if (err.code === "unavailable" || err.message?.includes("client is offline")) {
        setGoogleError("لا يوجد اتصال بالإنترنت. تحقق من اتصالك وحاول مجدداً.");
      } else {
        setGoogleError("حدث خطأ في تسجيل الدخول بحساب Google");
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  if (!loaded) return null;

  return (
    <div className="page-wrapper">
      {/* Hero */}
      <div className="hero-section">
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", background: "rgba(255,255,255,0.07)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "10px", left: "-30px", width: "120px", height: "120px", borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />

        <Image src="/logo3.png" alt="يسلمو" width={130} height={130} className="hero-logo" priority />
        <h1 className="hero-title">توصيل كافة الطلبيات إلى المنازل</h1>
        <p className="hero-desc">نوصلك كل ما تحتاجه من متاجرك المفضلة إلى باب منزلك بسرعة وأمان</p>

        <Link
          href="/install"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(255,255,255,0.18)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: "50px",
            padding: "8px 20px",
            marginTop: "18px",
            color: "white",
            fontWeight: 700,
            fontSize: "0.9rem",
            animation: "slideUp 0.8s ease-out 0.6s both",
          }}
        >
          📲 ثبّت التطبيق على جهازك
        </Link>
      </div>

      {/* Stats removed */}

      {/* Guest CTAs */}
      <div className="cta-section">
        {googleError ? (
          <div
            style={{
              width: "100%",
              marginBottom: "10px",
              background: "#fff0f0",
              border: "1px solid #ffcdd2",
              borderRadius: "12px",
              padding: "10px 12px",
              color: "#c62828",
              fontSize: "0.86rem",
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            {googleError}
          </div>
        ) : null}
        <Link href="/login">
          <button className="btn-cta">
            <svg viewBox="0 0 24 24" fill="white"><path d="M11 7L9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12H12v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z" /></svg>
            تسجيل الدخول
          </button>
        </Link>
        <Link href="/register">
          <button className="btn-cta" style={{ animationDelay: "0.1s" }}>
            <svg viewBox="0 0 24 24" fill="white"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
            إنشاء حساب جديد
          </button>
        </Link>
        <div style={{ textAlign: "center", color: "#9ca3af", fontWeight: 700, fontSize: "0.9rem", margin: "2px 0" }}>
          أو
        </div>
        <div style={{ textAlign: "center", color: "#64748b", fontSize: "0.82rem", marginTop: "-4px" }}>
          يمكنك تسجيل الدخول من خلال حساب غوغل
        </div>
        <button
          type="button"
          className="btn-cta btn-cta-outline"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          style={{
            borderColor: "#dadce0",
            color: "#3c4043",
            background: "#fff",
            opacity: googleLoading ? 0.75 : 1,
          }}
        >
          {googleLoading ? (
            <span
              style={{
                width: 18,
                height: 18,
                border: "2px solid #dadce0",
                borderTop: "2px solid #4285f4",
                borderRadius: "50%",
                display: "inline-block",
                animation: "spin 0.7s linear infinite",
              }}
            />
          ) : (
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
          )}
          {googleLoading ? "جاري الدخول..." : "متابعة مع Google"}
        </button>
      </div>

      <Footer />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
