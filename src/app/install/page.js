"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function InstallPage() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent || "";
    const ios = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const standaloneMatch = window.matchMedia("(display-mode: standalone)").matches;
    const iosStandalone = window.navigator.standalone === true;

    setIsIOS(ios);
    setIsInstalled(standaloneMatch || iosStandalone);

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

  const canInstallDirectly = useMemo(
    () => Boolean(installPrompt) && !isInstalled,
    [installPrompt, isInstalled]
  );

  async function handleInstallClick() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice?.outcome === "accepted") {
      setInstallPrompt(null);
    }
  }

  return (
    <div className="page-wrapper" style={{ padding: "20px 16px 100px" }}>
      <div style={{ width: "100%", maxWidth: "560px", margin: "0 auto" }}>
        <div
          style={{
            background: "var(--surface)",
            borderRadius: "20px",
            border: "1px solid #f0f0f0",
            boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              background: "var(--primary)",
              color: "white",
              padding: "24px 18px 20px",
              textAlign: "center",
            }}
          >
            <Image src="/logo3.png" alt="يسلمو" width={72} height={72} style={{ borderRadius: 14 }} />
            <h1 style={{ marginTop: 10, fontSize: "1.25rem", fontWeight: 900 }}>تنزيل تطبيق يسلمو</h1>
            <p style={{ marginTop: 6, fontSize: "0.92rem", opacity: 0.95 }}>
              ثبّت التطبيق على جهازك للوصول السريع مثل أي تطبيق عادي.
            </p>
          </div>

          <div style={{ padding: "16px" }}>
            {isInstalled ? (
              <div
                style={{
                  background: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  color: "#065f46",
                  borderRadius: "12px",
                  padding: "12px 14px",
                  textAlign: "center",
                  fontWeight: 800,
                }}
              >
                ✅ التطبيق مثبت بالفعل على هذا الجهاز
              </div>
            ) : (
              <button
                onClick={handleInstallClick}
                disabled={!canInstallDirectly}
                style={{
                  width: "100%",
                  border: "none",
                  borderRadius: "14px",
                  padding: "14px",
                  background: canInstallDirectly ? "var(--primary)" : "#f3f4f6",
                  color: canInstallDirectly ? "white" : "#9ca3af",
                  fontFamily: "inherit",
                  fontWeight: 900,
                  fontSize: "1rem",
                  cursor: canInstallDirectly ? "pointer" : "not-allowed",
                }}
              >
                📲 تثبيت التطبيق الآن
              </button>
            )}

            {!isInstalled && !canInstallDirectly && !isIOS && (
              <p style={{ marginTop: 10, fontSize: "0.86rem", color: "#6b7280", textAlign: "center" }}>
                إذا لم يظهر زر التثبيت، افتح الرابط عبر Chrome أو Edge ثم أعد المحاولة.
              </p>
            )}

            {!isInstalled && isIOS && (
              <div
                style={{
                  marginTop: 14,
                  background: "#fff7ed",
                  border: "1px solid #fed7aa",
                  borderRadius: "12px",
                  padding: "12px 14px",
                }}
              >
                <div style={{ fontWeight: 900, color: "#9a3412", marginBottom: 6 }}>على iPhone (Safari):</div>
                <div style={{ fontSize: "0.9rem", color: "#7c2d12", lineHeight: 1.8 }}>
                  1) افتح هذه الصفحة من متصفح Safari
                  <br />
                  2) اضغط زر المشاركة
                  <br />
                  3) اختر <strong>Add to Home Screen</strong>
                </div>
              </div>
            )}

            <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
              <Link
                href="/"
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "11px 10px",
                  borderRadius: "12px",
                  border: "1px solid #e5e7eb",
                  fontWeight: 800,
                  color: "#374151",
                  background: "var(--surface)",
                }}
              >
                الصفحة الرئيسية
              </Link>
              <Link
                href="/login"
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "11px 10px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,107,53,0.25)",
                  fontWeight: 800,
                  color: "var(--primary)",
                  background: "#fff7ed",
                }}
              >
                تسجيل الدخول
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
