"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { getCurrentUserIdToken } from "@/lib/clientAuth";
import { showAppAlert } from "@/lib/appAlert";
import { showAppConfirm } from "@/lib/appConfirm";
import { doc, onSnapshot, collection, query, where, limit, getDocs, updateDoc } from "firebase/firestore";
import { DEFAULT_DELIVERY_FEE_SYP } from "@/lib/orderPricing";

const CITY_OPTIONS = ["عربين", "زملكا", "حرستا", "حمورية"];

function CreateOrderContent() {
    const [userName, setUserName] = useState("");
    const [userPhone, setUserPhone] = useState("");
    const [address, setAddress] = useState("");
    const [orders, setOrders] = useState("");
    const [notes, setNotes] = useState("");
    const [itemsCount, setItemsCount] = useState(0);
    const [hasAccount, setHasAccount] = useState(false);
    const [userUid, setUserUid] = useState("");
    const [customerStatus, setCustomerStatus] = useState(null);

    const searchParams = useSearchParams();
    const isCallMode = searchParams?.get("mode") === "call";

    // Account location
    const [acctCoords, setAcctCoords] = useState(null);
    const [acctCity, setAcctCity] = useState("");
    const [acctLocationDesc, setAcctLocationDesc] = useState("");

    // Different-location modal
    const [showLocModal, setShowLocModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [useCustomLoc, setUseCustomLoc] = useState(false);
    const [modalCoords, setModalCoords] = useState(null);
    const [modalCity, setModalCity] = useState("");
    const [modalDesc, setModalDesc] = useState("");
    const [modalGpsLoading, setModalGpsLoading] = useState(false);
    const [modalGpsError, setModalGpsError] = useState("");
    const [modalGpsDone, setModalGpsDone] = useState(false);

    // ── Real-time tracking state ─────────────────────────────
    // "idle" | "pending" | "accepted"
    const [trackingStatus, setTrackingStatus] = useState("idle");
    const [orderNumber, setOrderNumber] = useState("");
    const [orderId, setOrderId] = useState("");       // Firestore doc ID
    const [orderItems, setOrderItems] = useState([]); // for summary display
    const [driverInfo, setDriverInfo] = useState(null); // { name, phone }
    const unsubscribeRef = useRef(null);

    useEffect(() => {
        try {
            const userData = localStorage.getItem("yaslamo_user");
            if (userData) {
                const parsed = JSON.parse(userData);
                setUserName(parsed.name || "");
                setUserPhone(parsed.phone || "");
                setAddress(parsed.address || "");
                setAcctCoords(parsed.locationCoords || null);
                setAcctCity(parsed.city || "");
                setAcctLocationDesc(parsed.locationDesc || "");
                if (parsed.id) setUserUid(parsed.id);
                setCustomerStatus(parsed.customerStatus || null);
                setHasAccount(true);
            }
        } catch (e) { }
    }, []);

    // Cleanup listener on unmount
    useEffect(() => () => { if (unsubscribeRef.current) unsubscribeRef.current(); }, []);

    useEffect(() => {
        if (isCallMode) {
            setItemsCount(1);
            return;
        }
        const lines = orders.split("\n").filter((line) => line.trim() !== "");
        setItemsCount(lines.length);
    }, [orders, isCallMode]);

    function getItemsCountText() {
        if (isCallMode) return "طلب تواصل";
        if (itemsCount === 0) return "لا توجد أصناف";
        if (itemsCount === 1) return "صنف واحد";
        if (itemsCount === 2) return "صنفان";
        return `${itemsCount} أصناف`;
    }

    function parseOrders(text) {
        const lines = text.split("\n").filter((line) => line.trim() !== "");
        return lines.map((line) => {
            let itemName = line.trim();
            let quantity = 1;
            const separators = ["-", "—", ":", "،", ","];
            for (const sep of separators) {
                const idx = line.indexOf(sep);
                if (idx > 0 && idx < line.length - 1) {
                    const name = line.substring(0, idx).trim();
                    const qtyStr = line.substring(idx + 1).trim();
                    const parsed = parseInt(qtyStr);
                    if (!isNaN(parsed) && parsed > 0) { itemName = name; quantity = parsed; }
                    break;
                }
            }
            return { name: itemName || "صنف غير مسمى", quantity };
        });
    }

    function getOrderSummaryItems() {
        if (isCallMode) {
            return [{ name: "سيحدد المندوب الأصناف معك هاتفيا", quantity: 1 }];
        }
        return parseOrders(orders);
    }

    function getModalLocation() {
        setModalGpsError("");
        if (!navigator.geolocation) { setModalGpsError("متصفحك لا يدعم تحديد الموقع"); return; }
        setModalGpsLoading(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => { setModalCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setModalGpsDone(true); setModalGpsLoading(false); },
            () => { setModalGpsError("تعذّر الحصول على موقعك. تأكد من منح الإذن للمتصفح."); setModalGpsLoading(false); },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }

    function confirmCustomLocation() {
        if (!modalGpsDone) { setModalGpsError("يرجى تحديد الموقع أولاً"); return; }
        if (!modalCity.trim()) { setModalGpsError("يرجى إدخال المدينة"); return; }
        if (!modalDesc.trim()) { setModalGpsError("يرجى إدخال العنوان التفصيلي"); return; }
        setUseCustomLoc(true);
        setShowLocModal(false);
        setShowConfirmModal(true);
    }

    // Start listening to the order doc in real-time (بعد جاهزية Auth حتى تقبل قواعد Firestore القراءة)
    async function startTracking(docId) {
        if (unsubscribeRef.current) unsubscribeRef.current();
        await auth.authStateReady();
        if (!auth.currentUser) {
            showAppAlert("سجّل الدخول لمتابعة الطلب لحظياً");
            return;
        }
        if (userUid && auth.currentUser.uid !== userUid) {
            showAppAlert("جلسة غير متطابقة. سجّل الدخول مرة أخرى.");
            return;
        }
        const orderRef = doc(db, "orders", docId);
        const unsub = onSnapshot(orderRef, async (snap) => {
            if (!snap.exists()) return;
            const data = snap.data();

            if (data.status === "pending") {
                setTrackingStatus("pending");
            } else if (data.status === "accepted" && data.driverId) {
                // Fetch driver profile from users collection
                let driver = { name: "المندوب", phone: "" };
                try {
                    const driverDoc = await getDocs(
                        query(collection(db, "users"), where("__name__", "==", data.driverId), limit(1))
                    );
                    // If stored by uid as doc ID, try direct approach
                    const { getDoc } = await import("firebase/firestore");
                    const dRef = doc(db, "users", data.driverId);
                    const dSnap = await getDoc(dRef);
                    if (dSnap.exists()) {
                        driver = { name: dSnap.data().name || "المندوب", phone: dSnap.data().phone || "" };
                    }
                } catch (e) { }
                setDriverInfo(driver);
                setTrackingStatus("accepted");
            }
        });
        unsubscribeRef.current = unsub;
    }

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");

    function handleConfirmClick() {
        if (!userName.trim()) { showAppAlert("الرجاء تسجيل الدخول أولاً أو إنشاء حساب"); return; }
        if (!isCallMode) {
            if (!orders.trim()) { showAppAlert("الرجاء إدخال الطلبات المطلوبة"); return; }
            const items = parseOrders(orders);
            if (items.length === 0) { showAppAlert("الرجاء إدخال صنف واحد على الأقل"); return; }
        }
        setSubmitError("");
        setShowConfirmModal(true);
    }

    async function submitOrder() {
        const items = isCallMode
            ? [{ name: "طلب عبر المكالمة", quantity: 1 }]
            : parseOrders(orders);
        setIsSubmitting(true);
        setSubmitError("");

        try {
            const token = await getCurrentUserIdToken();
            if (!token) {
                setSubmitError("انتهت الجلسة، الرجاء تسجيل الدخول مجددًا");
                setIsSubmitting(false);
                setShowConfirmModal(false);
                return;
            }

            const activeCoords = useCustomLoc ? modalCoords : acctCoords;
            const activeCity = useCustomLoc ? modalCity : acctCity;
            const activeDesc = useCustomLoc ? modalDesc : acctLocationDesc;

            const res = await fetch("/api/orders", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    customerName: userName.trim(),
                    customerPhone: userPhone.trim(),
                    customerAddress: activeCity ? `${activeCity}، ${activeDesc}` : address.trim(),
                    customerUid: userUid || null,
                    items,
                    notes: isCallMode ? "طلب تواصل مع المندوب هاتفيا" : "",
                    locationCoords: activeCoords || null,
                    locationDesc: activeDesc,
                    customerStatus: customerStatus || null,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setSubmitError(data.error || "حدث خطأ في تقديم الطلب");
                setIsSubmitting(false);
                setShowConfirmModal(false);
                return;
            }

            const newOrderId = data.order.id;
            const newOrderNumber = data.order.orderNumber;
            setOrderNumber(newOrderNumber);
            setOrderId(newOrderId);
            setOrderItems(items);
            setTrackingStatus("pending");
            setShowConfirmModal(false);
            await startTracking(newOrderId);
        } catch (error) {
            setSubmitError("تعذر الاتصال بالخادم. تأكد من اتصالك بالإنترنت.");
            setShowConfirmModal(false);
        } finally {
            setIsSubmitting(false);
        }
    }

    async function clearForm() {
        const ok = await showAppConfirm("هل أنت متأكد من تفريغ جميع الحقول؟");
        if (!ok) return;
        setOrders("");
    }

    async function cancelOrder() {
        if (!orderId) return;
        const ok = await showAppConfirm("هل أنت متأكد من إلغاء الطلب؟");
        if (!ok) return;
        try {
            await updateDoc(doc(db, "orders", orderId), { status: "cancelled" });
            setTrackingStatus("idle");
            setOrderNumber("");
            setOrderId("");
            setOrderItems([]);
            if (unsubscribeRef.current) unsubscribeRef.current();
            showAppAlert("تم إلغاء الطلب بنجاح");
        } catch (err) {
            console.error("Cancel error:", err);
            showAppAlert("حدث خطأ أثناء إلغاء الطلب");
        }
    }

    function getActiveLocationText() {
        if (useCustomLoc) return `${modalCity}، ${modalDesc}`;
        if (acctCity) return `${acctCity}، ${acctLocationDesc}`;
        return address || "—";
    }

    return (
        <>
            <div className="page-wrapper create-order-page">
                {/* Form Content — ملء الشاشة: التمرير داخل منطقة الطلب فقط */}
                <div className="content-area create-order-content">

                    {/* Orders — refreshed design */}
                <div className="order-mode-toggle-wrap order-mode-toggle-wrap--above">
                    <div className="order-mode-toggle" role="tablist" aria-label="طريقة إنشاء الطلب">
                        <Link
                            href="/create-order"
                            className={`order-mode-btn${!isCallMode ? " order-mode-btn--active" : ""}`}
                            role="tab"
                            aria-selected={!isCallMode}
                        >
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
                            </svg>
                            كتابة الطلب
                        </Link>
                        <Link
                            href="/create-order?mode=call"
                            className={`order-mode-btn${isCallMode ? " order-mode-btn--active" : ""}`}
                            role="tab"
                            aria-selected={isCallMode}
                        >
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72 12.8 12.8 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.8 12.8 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                            اتصال بالمندوب
                        </Link>
                    </div>
                </div>

                    <div className={`order-section-card${isCallMode ? " order-section-card--call" : ""}`}>
                        <div className="order-section-header">
                            <div className="order-section-icon">
                                <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 7h10v2H7V7zm0 4h10v2H7v-2zm0 4h10v2H7v-2z" /></svg>
                            </div>
                            <div>
                                <div className="order-section-title">الطلبات المرادة</div>
                                <div className="order-section-subtitle">
                                    {isCallMode ? "سيحدد المندوب الأصناف معك هاتفيا" : "اكتب طلباتك هنا"}
                                </div>
                            </div>
                        </div>

                        {isCallMode ? (
                            <div className="order-hint" style={{ marginTop: 12 }}>
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C10.07 21 3 13.93 3 5c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.24.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                                </svg>
                                سيقوم المندوب بالتواصل معك هاتفيا لتحديد طلبك
                            </div>
                        ) : (
                            <>
                                <div className="order-write-label">
                                    <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>
                                    اكتب طلباتك هنا
                                </div>

                                <div className="order-textarea-scroll">
                                    <textarea
                                        className="order-textarea"
                                        placeholder={`بيتزا عائلية - 2\nمشروب غازي - 3\nبطاطس مقلية كبيرة - 1\n\nاكتب كل صنف في سطر...`}
                                        value={orders}
                                        onChange={(e) => setOrders(e.target.value)}
                                    />
                                </div>

                                <div className="order-hint">
                                    <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
                                    استخدم شرطة (-) للفصل بين الاسم والكمية
                                </div>
                            </>
                        )}
                    </div>

                    {submitError && (
                        <div className="create-order-submit-error" style={{
                            background: "#fff0f0", border: "1px solid #ffcdd2", borderRadius: "12px",
                            padding: "12px 16px", marginBottom: "16px", color: "#c62828", fontSize: "0.9rem",
                            display: "flex", alignItems: "center", gap: "8px",
                        }}>
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="#c62828">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                            </svg>
                            {submitError}
                        </div>
                    )}

                    {/* Confirm button — prominent full width */}
                    <button className="order-confirm-btn" onClick={handleConfirmClick}>
                        <svg viewBox="0 0 24 24" fill="white">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                        </svg>
                        {isCallMode ? "إرسال طلب تواصل" : "تأكيد الطلب"}
                    </button>
                </div>
            </div>

            {/* ── CONFIRMATION MODAL — Location check before submit ── */}
            {showConfirmModal && (
                <div
                    className="create-order-modal-backdrop"
                    style={{
                        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        zIndex: 1000,
                        padding: "max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))",
                        boxSizing: "border-box",
                        overflow: "hidden",
                    }}
                    onClick={() => setShowConfirmModal(false)}
                >
                    <div style={{
                        background: "var(--surface)", borderRadius: "20px",
                        padding: "24px 20px 20px", width: "100%",
                        maxWidth: "min(520px, calc(100vw - 24px))",
                        height: "min(720px, calc(100dvh - 24px))",
                        maxHeight: "min(720px, calc(100dvh - 24px))",
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
                    }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{
                            fontWeight: 800, fontSize: "1.15rem", marginBottom: "16px", textAlign: "center", color: "#1a1a2e",
                            flexShrink: 0,
                        }}>
                            تأكيد موقع التوصيل
                        </div>

                        {/* Current location display */}
                        <div style={{
                            background: "#f0fdf4", borderRadius: "14px", padding: "16px",
                            border: "1.5px solid #a7f3d0", marginBottom: "14px",
                            flexShrink: 0,
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="#059669">
                                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                                </svg>
                                <span style={{ fontSize: "0.8rem", color: "#059669", fontWeight: 700 }}>
                                    {useCustomLoc ? "موقع مختلف محدد" : "موقع حسابك"}
                                </span>
                            </div>
                            <div style={{ fontWeight: 600, color: "#1a1a2e", fontSize: "0.95rem", lineHeight: 1.6 }}>
                                {getActiveLocationText()}
                            </div>
                        </div>

                        {/* Change location button */}
                        <button
                            type="button"
                            onClick={() => { setShowConfirmModal(false); setShowLocModal(true); }}
                            style={{
                                width: "100%", padding: "12px", borderRadius: "12px",
                                border: "1.5px solid #ff6b35", background: "var(--surface)",
                                color: "#ff6b35", fontFamily: "inherit", fontWeight: 700,
                                fontSize: "0.92rem", cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                                marginBottom: "14px",
                                flexShrink: 0,
                            }}
                        >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                            </svg>
                            تغيير الموقع
                        </button>

                        {/* Order summary: عنوان + قائمة قابلة للتمرير + رسوم ثابتة */}
                        <div style={{
                            background: "#fafafa", borderRadius: "12px", padding: "12px 12px 14px",
                            border: "1px solid #f0f0f0", marginBottom: "16px",
                            flex: 1,
                            minHeight: 0,
                            display: "flex",
                            flexDirection: "column",
                            overflow: "hidden",
                        }}>
                            <div style={{
                                fontSize: "0.78rem", color: "#888", fontWeight: 700, marginBottom: "8px",
                                flexShrink: 0,
                            }}>
                                ملخص الطلب
                            </div>
                            <div
                                style={{
                                    flex: 1,
                                    minHeight: 0,
                                    overflowY: "auto",
                                    WebkitOverflowScrolling: "touch",
                                    overscrollBehavior: "contain",
                                    paddingInlineEnd: "4px",
                                }}
                            >
                                {getOrderSummaryItems().map((item, i) => (
                                    <div key={i} style={{
                                        display: "flex", justifyContent: "space-between", alignItems: "center",
                                        padding: "6px 0", borderBottom: i < getOrderSummaryItems().length - 1 ? "1px solid #f0f0f0" : "none",
                                        fontSize: "0.88rem", color: "#334155",
                                    }}>
                                        <span style={{ background: "#fff0eb", color: "#ff6b35", borderRadius: "6px", padding: "2px 8px", fontSize: "0.78rem", fontWeight: 700 }}>
                                            × {item.quantity}
                                        </span>
                                        <span>{item.name}</span>
                                    </div>
                                ))}
                            </div>
                            <div
                                style={{
                                    marginTop: "10px",
                                    paddingTop: "12px",
                                    borderTop: "1px solid #e8eaee",
                                    flexShrink: 0,
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: "12px",
                                        padding: "12px 14px",
                                        borderRadius: "14px",
                                        background: "linear-gradient(135deg, #fffdfb 0%, #fff4ed 100%)",
                                        border: "1px solid rgba(255, 107, 53, 0.2)",
                                        boxShadow: "0 4px 14px rgba(255, 107, 53, 0.1)",
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "10px",
                                            flex: 1,
                                            minWidth: 0,
                                        }}
                                    >
                                        <div
                                            aria-hidden
                                            style={{
                                                width: "42px",
                                                height: "42px",
                                                borderRadius: "12px",
                                                background: "linear-gradient(145deg, #ff6b35, #ff8f5a)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                flexShrink: 0,
                                                boxShadow: "0 4px 14px rgba(255, 107, 53, 0.35)",
                                            }}
                                        >
                                            <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
                                                <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                                            </svg>
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div
                                                style={{
                                                    fontSize: "0.82rem",
                                                    color: "#1e293b",
                                                    fontWeight: 800,
                                                    lineHeight: 1.35,
                                                }}
                                            >
                                                رسوم التوصيل
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: "0.72rem",
                                                    color: "#94a3b8",
                                                    fontWeight: 600,
                                                    marginTop: "2px",
                                                }}
                                            >
                                                ثابتة لهذا الطلب
                                            </div>
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            flexShrink: 0,
                                            textAlign: "center",
                                            paddingInlineStart: "4px",
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: "1.4rem",
                                                fontWeight: 900,
                                                color: "#ea580c",
                                                fontVariantNumeric: "tabular-nums",
                                                lineHeight: 1.1,
                                                letterSpacing: "-0.02em",
                                            }}
                                        >
                                            {DEFAULT_DELIVERY_FEE_SYP}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: "0.7rem",
                                                color: "#64748b",
                                                fontWeight: 700,
                                                marginTop: "4px",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            ل.س جديدة
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Confirm / Cancel buttons */}
                        <div style={{ display: "flex", gap: "10px", flexShrink: 0, paddingTop: "4px" }}>
                            <button
                                type="button"
                                onClick={() => setShowConfirmModal(false)}
                                style={{
                                    flex: 1, padding: "14px", borderRadius: "12px",
                                    border: "1.5px solid #e2e8f0", background: "var(--surface)",
                                    fontFamily: "inherit", fontWeight: 600, cursor: "pointer", color: "#64748b",
                                    fontSize: "0.95rem",
                                }}
                            >
                                رجوع
                            </button>
                            <button
                                type="button"
                                onClick={submitOrder}
                                disabled={isSubmitting}
                                style={{
                                    flex: 2, padding: "14px", borderRadius: "12px",
                                    border: "none", background: "#ff6b35", color: "white",
                                    fontFamily: "inherit", fontWeight: 800, cursor: "pointer",
                                    fontSize: "1rem", opacity: isSubmitting ? 0.7 : 1,
                                    boxShadow: "0 6px 20px rgba(255,107,53,0.3)",
                                }}
                            >
                                {isSubmitting ? "جاري الإرسال..." : "إرسال الطلب"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Location change modal */}
            {showLocModal && (
                <div
                    className="create-order-modal-backdrop"
                    style={{
                        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        zIndex: 1000,
                        padding: "max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))",
                        boxSizing: "border-box",
                        overflow: "hidden",
                    }}
                    onClick={() => setShowLocModal(false)}
                >
                    <div style={{
                        background: "var(--surface)", borderRadius: "20px",
                        padding: "24px 20px 32px", width: "100%",
                        maxWidth: "min(520px, calc(100vw - 24px))",
                        height: "min(720px, calc(100dvh - 24px))",
                        maxHeight: "min(720px, calc(100dvh - 24px))",
                        overflowY: "auto",
                        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
                    }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ fontWeight: 800, fontSize: "1.1rem", marginBottom: "20px", textAlign: "center" }}>
                            تحديد موقع مختلف
                        </div>

                        {/* GPS button */}
                        <button
                            type="button"
                            onClick={getModalLocation}
                            disabled={modalGpsLoading}
                            style={{
                                width: "100%", display: "flex", alignItems: "center",
                                justifyContent: "center", gap: "10px", padding: "14px",
                                borderRadius: "12px", border: "2px dashed",
                                borderColor: modalGpsDone ? "#10b981" : "#ff6b35",
                                background: modalGpsDone ? "#f0fdf4" : "#fff8f6",
                                color: modalGpsDone ? "#065f46" : "#c2410c",
                                fontFamily: "inherit", fontWeight: 700, fontSize: "1rem",
                                cursor: modalGpsLoading ? "wait" : "pointer",
                                marginBottom: "12px",
                            }}
                        >
                            {modalGpsDone ? "✅" : "📍"}
                            {modalGpsLoading
                                ? "جاري تحديد موقعك..."
                                : modalGpsDone
                                    ? `تم (${modalCoords.lat.toFixed(4)}, ${modalCoords.lng.toFixed(4)})`
                                    : "تحديد موقعي تلقائياً أولاً"}
                        </button>

                        {modalGpsError && (
                            <div style={{ color: "#c62828", fontSize: "0.85rem", marginBottom: "10px", padding: "8px 12px", background: "#fff0f0", borderRadius: "8px" }}>
                                {modalGpsError}
                            </div>
                        )}

                        {modalGpsDone && (
                            <>
                                <select
                                    className="form-input"
                                    value={modalCity}
                                    onChange={(e) => setModalCity(e.target.value)}
                                    style={{ marginBottom: "12px" }}
                                >
                                    <option value="" disabled>اختر المدينة</option>
                                    {CITY_OPTIONS.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                                <textarea
                                    className="form-input"
                                    style={{ minHeight: "80px", resize: "vertical" }}
                                    placeholder="عنوان تفصيلي: الحي، الشارع، بجانب أي معلم، رقم البناء..."
                                    value={modalDesc}
                                    onChange={(e) => setModalDesc(e.target.value)}
                                />
                            </>
                        )}

                        <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                            <button
                                type="button"
                                onClick={() => setShowLocModal(false)}
                                style={{
                                    flex: 1, padding: "12px", borderRadius: "12px",
                                    border: "1.5px solid #e2e8f0", background: "var(--surface)",
                                    fontFamily: "inherit", fontWeight: 600, cursor: "pointer", color: "#64748b",
                                }}
                            >
                                إلغاء
                            </button>
                            <button
                                type="button"
                                onClick={confirmCustomLocation}
                                style={{
                                    flex: 2, padding: "12px", borderRadius: "12px",
                                    border: "none", background: "#ff6b35", color: "white",
                                    fontFamily: "inherit", fontWeight: 700, cursor: "pointer",
                                }}
                            >
                                تأكيد الموقع
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── TRACKING SCREEN — Pending ───────────────────────── */}
            {trackingStatus === "pending" && (
                <div style={{
                    position: "fixed", inset: 0, background: "linear-gradient(135deg,#fff8f6 0%,var(--surface) 100%)",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
                    zIndex: 2000,
                    padding: "max(12px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))",
                    textAlign: "center",
                    boxSizing: "border-box",
                    height: "100dvh",
                    maxHeight: "100dvh",
                    overflow: "hidden",
                    overflowX: "hidden",
                }}>
                    <style>{`
                        @keyframes pulse-ring {
                            0% { transform: scale(0.9); opacity: 1; }
                            100% { transform: scale(1.6); opacity: 0; }
                        }
                        @keyframes spin-dot {
                            to { stroke-dashoffset: 0; }
                        }
                        /* دوائر ثابتة: لا تُضغط مع flex العمودي (تجنّب شكل بيضاوي) */
                        .pulse-wrap {
                            position: relative;
                            width: 120px;
                            height: 120px;
                            min-width: 120px;
                            min-height: 120px;
                            aspect-ratio: 1;
                            flex-shrink: 0;
                            box-sizing: border-box;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        }
                        .pulse-ring {
                            position: absolute;
                            inset: 0;
                            width: 100%;
                            height: 100%;
                            box-sizing: border-box;
                            border-radius: 50%;
                            border: 3px solid #ff6b35;
                            animation: pulse-ring 1.5s ease-out infinite;
                        }
                        .pulse-ring:nth-child(2) { animation-delay: 0.5s; }
                    `}</style>

                    <div style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        width: "100%",
                        maxWidth: "480px",
                        margin: "0 auto",
                        flex: "1 1 auto",
                        minHeight: 0,
                        overflow: "hidden",
                        justifyContent: "center",
                    }}>
                    <div className="pulse-wrap">
                        <div className="pulse-ring"></div>
                        <div className="pulse-ring"></div>
                        <div style={{
                            width: 72,
                            height: 72,
                            minWidth: 72,
                            minHeight: 72,
                            aspectRatio: "1",
                            flexShrink: 0,
                            borderRadius: "50%",
                            background: "linear-gradient(135deg,#ff6b35,#ff8c5a)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 8px 24px rgba(255,107,53,0.4)",
                        }}>
                            <svg viewBox="0 0 24 24" width="36" height="36" fill="white">
                                {isCallMode ? (
                                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                                ) : (
                                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                                )}
                            </svg>
                        </div>
                    </div>

                    <h2 style={{
                        fontSize: "clamp(1.15rem, 4vw, 1.5rem)",
                        fontWeight: 800,
                        color: "#1a1a2e",
                        marginTop: "24px",
                        marginBottom: "8px",
                        flexShrink: 0,
                        lineHeight: 1.35,
                        paddingInline: "8px",
                    }}>
                        جاري البحث عن مندوب...
                    </h2>
                    <p style={{
                        color: "#64748b",
                        fontSize: "0.95rem",
                        marginBottom: "24px",
                        flexShrink: 0,
                        lineHeight: 1.5,
                        paddingInline: "8px",
                    }}>
                        {isCallMode
                            ? "طلب تواصل في الانتظار، سيتم الاتصال بك هاتفيا بمجرد قبول المندوب"
                            : "طلبك في الانتظار، سيتم إشعارك فور قبول مندوب لطلبك"}
                    </p>

                    <div style={{
                        background: "var(--surface)",
                        borderRadius: "16px",
                        padding: "16px 18px 14px",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                        width: "100%",
                        maxWidth: "min(440px, calc(100vw - 32px))",
                        textAlign: "right",
                        display: "flex",
                        flexDirection: "column",
                        flex: "1 1 auto",
                        minHeight: 0,
                        overflow: "hidden",
                    }}>
                        <div style={{
                            fontSize: "0.75rem",
                            color: "#ea580c",
                            fontWeight: 700,
                            marginBottom: "8px",
                            letterSpacing: "0.05em",
                            flexShrink: 0,
                        }}>
                            ملخص طلبك
                        </div>
                        <div style={{
                            fontSize: "1.1rem",
                            fontWeight: 800,
                            color: "#1a1a2e",
                            marginBottom: "10px",
                            flexShrink: 0,
                        }}>
                            #{orderNumber}
                        </div>
                        <div
                            style={{
                                flex: 1,
                                minHeight: 0,
                                overflowY: "auto",
                                WebkitOverflowScrolling: "touch",
                                overscrollBehavior: "contain",
                                paddingInlineEnd: "4px",
                                marginInlineEnd: "-2px",
                            }}
                        >
                            {orderItems.map((item, i) => (
                                <div key={i} style={{
                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                    gap: "8px",
                                    padding: "8px 0", borderBottom: i < orderItems.length - 1 ? "1px solid #f1f5f9" : "none",
                                    fontSize: "0.92rem", color: "#334155",
                                }}>
                                    <span style={{
                                        background: "#fff0eb",
                                        color: "#ea580c",
                                        borderRadius: "6px",
                                        padding: "2px 8px",
                                        fontSize: "0.8rem",
                                        fontWeight: 700,
                                        flexShrink: 0,
                                    }}>
                                        × {item.quantity}
                                    </span>
                                    <span style={{ textAlign: "right", wordBreak: "break-word", minWidth: 0 }}>{item.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <p style={{
                        marginTop: "20px",
                        color: "#94a3b8",
                        fontSize: "0.82rem",
                        flexShrink: 0,
                        paddingInline: "8px",
                    }}>
                        لا تغلق هذه الشاشة حتى يقبل المندوب طلبك
                    </p>

                    <button
                        type="button"
                        onClick={cancelOrder}
                        style={{
                            marginTop: "20px",
                            padding: "12px 32px",
                            borderRadius: "12px",
                            border: "1.5px solid rgba(239, 68, 68, 0.4)",
                            background: "rgba(239, 68, 68, 0.05)",
                            color: "#ef4444",
                            fontFamily: "inherit",
                            fontWeight: 700,
                            fontSize: "0.95rem",
                            cursor: "pointer",
                            transition: "all 0.2s",
                            flexShrink: 0,
                        }}
                    >
                        إلغاء الطلب
                    </button>
                    </div>
                </div>
            )}

            {/* ── TRACKING SCREEN — Accepted ──────────────────────── */}
            {trackingStatus === "accepted" && driverInfo && (
                <div style={{
                    position: "fixed", inset: 0, background: "linear-gradient(135deg,#f0fdf4 0%,var(--surface) 100%)",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    zIndex: 2000, padding: "24px", textAlign: "center", overflowY: "auto",
                }}>
                    <style>{`
                        @keyframes pop-in {
                            0% { transform: scale(0.5); opacity: 0; }
                            70% { transform: scale(1.1); }
                            100% { transform: scale(1); opacity: 1; }
                        }
                        .accepted-icon { animation: pop-in 0.5s ease-out forwards; }
                    `}</style>

                    <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#065f46", marginBottom: "14px" }}>
                        تم قبول طلبك
                    </h2>

                    {/* Driver card */}
                    <div style={{
                        background: "var(--surface)", borderRadius: "20px", padding: "20px 18px",
                        boxShadow: "0 6px 26px rgba(0,0,0,0.08)", width: "100%", maxWidth: "420px",
                        textAlign: "right", marginBottom: "18px",
                    }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: "10px", marginBottom: "14px" }}>
                            <div style={{ fontSize: "0.72rem", color: "#10b981", fontWeight: 800, letterSpacing: "0.04em" }}>
                                معلومات المندوب
                            </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                            <div style={{
                                width: 52, height: 52, borderRadius: "50%",
                                background: "linear-gradient(135deg,#ff6b35,#ff8c5a)",
                                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                            }}>
                                <svg viewBox="0 0 24 24" width="26" height="26" fill="white">
                                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                </svg>
                            </div>
                            <div>
                                <div style={{ fontWeight: 900, fontSize: "1.12rem", color: "#1a1a2e" }}>{driverInfo.name}</div>
                                {driverInfo.phone && (
                                    <div style={{ color: "#64748b", fontSize: "0.88rem", marginTop: "2px" }} dir="ltr">{driverInfo.phone}</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Order summary */}
                    <div style={{
                        background: "var(--surface)", borderRadius: "16px", padding: "20px 24px",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.06)", width: "100%", maxWidth: "420px",
                        textAlign: "right", marginBottom: "22px",
                    }}>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px", marginBottom: "12px" }}>
                            <div style={{ fontSize: "0.82rem", color: "#475569", fontWeight: 900 }}>
                                ملخص الطلب
                            </div>
                            <div style={{ background: "#fff0eb", color: "#ff6b35", borderRadius: "999px", padding: "6px 12px", fontWeight: 900, fontSize: "0.85rem" }}>
                                #{orderNumber}
                            </div>
                        </div>
                        {orderItems.map((item, i) => (
                            <div key={i} style={{
                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                padding: "8px 0",
                                borderBottom: i < orderItems.length - 1 ? "1px solid #f1f5f9" : "none",
                                fontSize: "0.92rem", color: "#334155",
                            }}>
                                <span style={{ color: "#475569", fontWeight: 800 }}>{item.name}</span>
                                <span style={{ background: "#f0fdf4", color: "#059669", borderRadius: "999px", padding: "3px 10px", fontSize: "0.8rem", fontWeight: 900 }}>
                                    × {item.quantity}
                                </span>
                            </div>
                        ))}
                    </div>

                    <Link href="/track-order">
                        <button
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "10px",
                                padding: "16px 22px",
                                borderRadius: "14px",
                                border: "none",
                                background: "linear-gradient(135deg,#10b981,#059669)",
                                color: "white",
                                fontFamily: "inherit",
                                fontWeight: 900,
                                fontSize: "1rem",
                                cursor: "pointer",
                                boxShadow: "0 6px 20px rgba(16,185,129,0.3)",
                                width: "100%",
                                maxWidth: "420px",
                            }}
                        >
                            <svg
                                viewBox="0 0 24 24"
                                width="18"
                                height="18"
                                fill="none"
                                stroke="white"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path d="M12 21s-6.5-4.2-6.5-10a6.5 6.5 0 0 1 13 0c0 5.8-6.5 10-6.5 10z" />
                                <path d="M12 11.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z" />
                            </svg>
                            تتبع الطلب
                        </button>
                    </Link>
                </div>
            )}
        </>
    );
}

export default function CreateOrder() {
    return (
        <Suspense
            fallback={
                <div
                    className="page-wrapper"
                    style={{
                        minHeight: "50vh",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 24,
                        fontFamily: "inherit",
                        color: "var(--text-muted, #64748b)",
                        fontWeight: 700,
                    }}
                >
                    جاري التحميل...
                </div>
            }
        >
            <CreateOrderContent />
        </Suspense>
    );
}
