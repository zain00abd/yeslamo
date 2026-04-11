"use client";

import { useEffect, useState } from "react";

export default function AppAlertHost() {
    const [alertState, setAlertState] = useState({ open: false, title: "", message: "" });
    const [confirmState, setConfirmState] = useState({
        open: false,
        title: "",
        message: "",
        onResult: null,
    });

    useEffect(() => {
        const handler = (event) => {
            const detail = event?.detail || {};
            setAlertState({
                open: true,
                title: detail.title || "تنبيه",
                message: detail.message || "",
            });
        };
        window.addEventListener("yaslamo:alert", handler);
        return () => window.removeEventListener("yaslamo:alert", handler);
    }, []);

    useEffect(() => {
        const handler = (event) => {
            const detail = event?.detail || {};
            setConfirmState({
                open: true,
                title: detail.title || "تأكيد",
                message: detail.message || "",
                onResult: typeof detail.onResult === "function" ? detail.onResult : null,
            });
        };
        window.addEventListener("yaslamo:confirm", handler);
        return () => window.removeEventListener("yaslamo:confirm", handler);
    }, []);

    useEffect(() => {
        if (!alertState.open) return;
        const onKeyDown = (e) => {
            if (e.key === "Escape") {
                setAlertState((prev) => ({ ...prev, open: false }));
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [alertState.open]);

    if (!alertState.open && !confirmState.open) return null;

    return (
        <div
            onClick={() => {
                if (alertState.open) setAlertState((prev) => ({ ...prev, open: false }));
                if (confirmState.open) {
                    confirmState.onResult?.(false);
                    setConfirmState((prev) => ({ ...prev, open: false, onResult: null }));
                }
            }}
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(15, 23, 42, 0.48)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 4000,
                padding: "16px",
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: "100%",
                    maxWidth: "420px",
                    background: "var(--surface)",
                    borderRadius: "14px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 16px 42px rgba(2, 6, 23, 0.24)",
                    padding: "14px",
                }}
            >
                <div style={{ fontWeight: 900, fontSize: "1.02rem", color: "#0f172a", marginBottom: "8px" }}>
                    {alertState.open ? alertState.title : confirmState.title}
                </div>
                <div style={{ color: "#334155", fontWeight: 700, lineHeight: 1.6, marginBottom: "14px" }}>
                    {alertState.open ? alertState.message : confirmState.message}
                </div>
                {alertState.open ? (
                    <button
                        onClick={() => setAlertState((prev) => ({ ...prev, open: false }))}
                        style={{
                            width: "100%",
                            border: "none",
                            borderRadius: "10px",
                            background: "#1e3a5f",
                            color: "white",
                            padding: "11px 12px",
                            fontFamily: "inherit",
                            fontWeight: 800,
                            cursor: "pointer",
                        }}
                    >
                        حسناً
                    </button>
                ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <button
                            onClick={() => {
                                confirmState.onResult?.(false);
                                setConfirmState((prev) => ({ ...prev, open: false, onResult: null }));
                            }}
                            style={{
                                border: "1px solid #cbd5e1",
                                borderRadius: "10px",
                                background: "var(--surface)",
                                color: "#334155",
                                padding: "11px 12px",
                                fontFamily: "inherit",
                                fontWeight: 800,
                                cursor: "pointer",
                            }}
                        >
                            إلغاء
                        </button>
                        <button
                            onClick={() => {
                                confirmState.onResult?.(true);
                                setConfirmState((prev) => ({ ...prev, open: false, onResult: null }));
                            }}
                            style={{
                                border: "none",
                                borderRadius: "10px",
                                background: "#1e3a5f",
                                color: "white",
                                padding: "11px 12px",
                                fontFamily: "inherit",
                                fontWeight: 800,
                                cursor: "pointer",
                            }}
                        >
                            تأكيد
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

