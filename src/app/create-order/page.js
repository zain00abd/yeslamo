"use client";

import { useState, useEffect, useRef, Suspense, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { getTokenOrRedirect } from "@/lib/clientAuth";
import { showAppAlert } from "@/lib/appAlert";
import { showAppConfirm } from "@/lib/appConfirm";
import { doc, onSnapshot, collection, query, where, limit, getDocs, updateDoc } from "firebase/firestore";
import { DEFAULT_DELIVERY_FEE_SYP } from "@/lib/orderPricing";
import { notifyOrderCreatedPending } from "@/lib/customerNotifications";

const CITY_OPTIONS = ["عربين", "زملكا", "حرستا", "حمورية"];

// تحويل الأرقام العربية/الفارسية إلى أرقام إنجليزية فور الكتابة
function toLatinNums(str) {
    return str
        .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
        .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0));
}

function CreateOrderContent() {
    const router = useRouter();
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

    const [acctCoords, setAcctCoords] = useState(null);
    const [acctCity, setAcctCity] = useState("");
    const [acctLocationDesc, setAcctLocationDesc] = useState("");

    const [showLocModal, setShowLocModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [useCustomLoc, setUseCustomLoc] = useState(false);
    const [modalCoords, setModalCoords] = useState(null);
    const [modalCity, setModalCity] = useState("");
    const [modalDesc, setModalDesc] = useState("");
    const [modalGpsLoading, setModalGpsLoading] = useState(false);
    const [modalGpsError, setModalGpsError] = useState("");
    const [modalGpsDone, setModalGpsDone] = useState(false);

    const [trackingStatus, setTrackingStatus] = useState("idle");
    const [orderNumber, setOrderNumber] = useState("");
    const [orderId, setOrderId] = useState("");
    const [orderItems, setOrderItems] = useState([]);
    const [driverInfo, setDriverInfo] = useState(null);
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

    useEffect(() => () => { if (unsubscribeRef.current) unsubscribeRef.current(); }, []);

    useEffect(() => {
        if (isCallMode) { setItemsCount(1); return; }
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
        if (isCallMode) return [{ name: "سيحدد المندوب الأصناف معك هاتفيا", quantity: 1 }];
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

    const startTracking = useCallback(async (docId) => {
        if (unsubscribeRef.current) unsubscribeRef.current();
        await auth.authStateReady();
        if (!auth.currentUser) { showAppAlert("سجّل الدخول لمتابعة الطلب لحظياً"); return; }
        if (userUid && auth.currentUser.uid !== userUid) { showAppAlert("جلسة غير متطابقة. سجّل الدخول مرة أخرى."); return; }
        const orderRef = doc(db, "orders", docId);
        const unsub = onSnapshot(orderRef, async (snap) => {
            if (!snap.exists()) return;
            const data = snap.data();
            if (data.status === "pending") {
                setTrackingStatus("pending");
            } else if (data.status === "accepted" && data.driverId) {
                let driver = { name: "المندوب", phone: "" };
                try {
                    const { getDoc } = await import("firebase/firestore");
                    const dRef = doc(db, "users", data.driverId);
                    const dSnap = await getDoc(dRef);
                    if (dSnap.exists()) driver = { name: dSnap.data().name || "المندوب", phone: dSnap.data().phone || "" };
                } catch (e) { }
                setDriverInfo(driver);
                setTrackingStatus("accepted");
            }
        });
        unsubscribeRef.current = unsub;
    }, [userUid]);

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
        const items = isCallMode ? [{ name: "طلب عبر المكالمة", quantity: 1 }] : parseOrders(orders);
        setIsSubmitting(true);
        setSubmitError("");
        try {
            const token = await getTokenOrRedirect(router);
            if (!token) { setIsSubmitting(false); setShowConfirmModal(false); return; }
            const activeCoords = useCustomLoc ? modalCoords : acctCoords;
            const activeCity = useCustomLoc ? modalCity : acctCity;
            const activeDesc = useCustomLoc ? modalDesc : acctLocationDesc;
            const res = await fetch("/api/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
                if (res.status === 409) { setSubmitError("لا يمكن إنشاء طلب جديد حتى إنهاء الطلب الحالي."); setIsSubmitting(false); setShowConfirmModal(false); return; }
                setSubmitError(data.error || "حدث خطأ في تقديم الطلب"); setIsSubmitting(false); setShowConfirmModal(false); return;
            }
            const newOrderId = data.order.id;
            const newOrderNumber = data.order.orderNumber;
            setOrderNumber(newOrderNumber);
            setOrderId(newOrderId);
            setOrderItems(items);
            setTrackingStatus("pending");
            notifyOrderCreatedPending({ id: newOrderId, orderNumber: newOrderNumber });
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
            showAppAlert("حدث خطأ أثناء إلغاء الطلب");
        }
    }

    function getActiveLocationText() {
        if (useCustomLoc) return `${modalCity}، ${modalDesc}`;
        if (acctCity) return `${acctCity}، ${acctLocationDesc}`;
        return address || "—";
    }

    function goBack() {
        if (typeof window !== "undefined" && window.history.length > 1) { router.back(); return; }
        router.push("/home");
    }

    return (
        <>
            <style>{`
                @keyframes co-fade-up {
                    from { opacity: 0; transform: translateY(16px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes co-sheet-up {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                @keyframes co-pulse-ring {
                    0% { transform: scale(0.85); opacity: 0.9; }
                    100% { transform: scale(1.7); opacity: 0; }
                }
                @keyframes co-pop-in {
                    0% { transform: scale(0.4); opacity: 0; }
                    65% { transform: scale(1.12); }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes co-spin {
                    to { transform: rotate(360deg); }
                }
                .co-page {
                    min-height: 0;
                    height: 100dvh;
                    max-height: 100dvh;
                    overflow: hidden;
                    width: 100%;
                    background: #f7f8fa;
                    display: flex;
                    flex-direction: column;
                }
                .co-topbar {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 16px;
                    padding-top: max(12px, env(safe-area-inset-top));
                    background: linear-gradient(135deg, #ff6b35 0%, #f05a28 100%);
                    flex-shrink: 0;
                    position: relative;
                    z-index: 10;
                    box-shadow: 0 3px 14px rgba(255,107,53,0.3);
                }
                .co-back-btn {
                    width: 40px;
                    height: 40px;
                    border-radius: 12px;
                    border: 1.5px solid rgba(255,255,255,0.3);
                    background: rgba(255,255,255,0.18);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: #ffffff;
                    transition: all 0.18s ease;
                    flex-shrink: 0;
                    backdrop-filter: blur(4px);
                }
                .co-back-btn:active { background: rgba(255,255,255,0.28); transform: scale(0.93); }
                .co-topbar-logo {
                    position: absolute;
                    left: 50%;
                    transform: translateX(-50%);
                }
                .co-scroll-area {
                    flex: 1;
                    min-height: 0;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    padding: 14px 16px;
                    padding-bottom: max(16px, env(safe-area-inset-bottom));
                    gap: 12px;
                    max-width: 540px;
                    width: 100%;
                    margin: 0 auto;
                }
                /* Mode Toggle */
                .co-mode-toggle {
                    display: flex;
                    background: #eef0f3;
                    border-radius: 14px;
                    padding: 4px;
                    gap: 4px;
                    flex-shrink: 0;
                }
                .co-mode-btn {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 7px;
                    padding: 11px 8px;
                    border-radius: 11px;
                    font-size: 0.88rem;
                    font-weight: 800;
                    color: #64748b;
                    text-decoration: none;
                    transition: all 0.22s ease;
                    border: none;
                    background: transparent;
                    cursor: pointer;
                }
                .co-mode-btn--active {
                    background: #ffffff;
                    color: #ff6b35;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.08), 0 0 0 1px rgba(255,107,53,0.15);
                }
                .co-mode-btn svg { flex-shrink: 0; }
                /* Order Card */
                .co-card {
                    background: #ffffff;
                    border-radius: 20px;
                    border: 1px solid #f0f1f4;
                    box-shadow: 0 1px 6px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03);
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    animation: co-fade-up 0.28s ease both;
                }
                .co-card--flex { flex: 1; min-height: 0; }
                .co-card-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 16px 16px 14px;
                    border-bottom: 1px solid #f7f8fa;
                }
                .co-card-icon {
                    width: 44px;
                    height: 44px;
                    border-radius: 13px;
                    background: linear-gradient(135deg, #fff3ed, #ffe4d4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .co-card-icon svg { fill: #ff6b35; }
                .co-card-icon--green { background: linear-gradient(135deg, #ecfdf5, #d1fae5); }
                .co-card-icon--green svg { fill: #10b981; }
                .co-card-title { font-size: 0.97rem; font-weight: 800; color: #1e293b; line-height: 1.3; }
                .co-card-subtitle { font-size: 0.77rem; color: #94a3b8; margin-top: 2px; }
                .co-card-body { padding: 14px 16px; display: flex; flex-direction: column; }
                .co-card-body--flex { flex: 1; min-height: 0; }
                /* Textarea */
                .co-textarea-wrap {
                    flex: 1;
                    min-height: 0;
                    display: flex;
                    flex-direction: column;
                }
                .co-textarea {
                    flex: 1;
                    min-height: 0;
                    width: 100%;
                    padding: 14px;
                    font-size: 0.97rem;
                    font-family: inherit;
                    line-height: 1.75;
                    color: #1e293b;
                    background: #f9fafb;
                    border: 2px solid #eef0f3;
                    border-radius: 14px;
                    outline: none;
                    resize: none;
                    transition: border-color 0.18s, box-shadow 0.18s, background 0.18s;
                    overflow-y: auto;
                    -webkit-overflow-scrolling: touch;
                }
                .co-textarea:focus {
                    border-color: #ff6b35;
                    background: #ffffff;
                    box-shadow: 0 0 0 4px rgba(255,107,53,0.1);
                }
                .co-textarea::placeholder { color: #c0c7d4; font-size: 0.88rem; line-height: 1.8; }
                /* Textarea tip row */
                .co-tip {
                    display: flex;
                    align-items: center;
                    gap: 7px;
                    padding: 10px 13px;
                    background: linear-gradient(135deg, #fff8f5, #fff3ed);
                    border-radius: 12px;
                    border: 1px solid rgba(255,107,53,0.15);
                    font-size: 0.82rem;
                    color: #c2410c;
                    font-weight: 600;
                    margin-top: 10px;
                    flex-shrink: 0;
                }
                .co-tip svg { flex-shrink: 0; fill: #ff6b35; }
                /* Call mode hint */
                .co-call-hint {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 28px 20px;
                    gap: 12px;
                    text-align: center;
                }
                .co-call-hint-icon {
                    width: 72px;
                    height: 72px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #fff3ed, #ffe4d4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 2px solid rgba(255,107,53,0.2);
                }
                .co-call-hint-icon svg { fill: #ff6b35; }
                .co-call-hint-title { font-size: 1rem; font-weight: 800; color: #1e293b; }
                .co-call-hint-sub { font-size: 0.85rem; color: #64748b; line-height: 1.6; max-width: 240px; }
                /* Error */
                .co-error {
                    display: flex;
                    align-items: center;
                    gap: 9px;
                    padding: 12px 15px;
                    background: #fef2f2;
                    border: 1.5px solid #fca5a5;
                    border-radius: 14px;
                    color: #dc2626;
                    font-size: 0.88rem;
                    font-weight: 600;
                    flex-shrink: 0;
                    animation: co-fade-up 0.22s ease both;
                }
                .co-error svg { fill: #dc2626; flex-shrink: 0; }
                /* Submit Button */
                .co-submit-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    width: 100%;
                    padding: 17px;
                    border: none;
                    border-radius: 16px;
                    background: linear-gradient(135deg, #ff6b35 0%, #f05a28 100%);
                    color: #ffffff;
                    font-family: inherit;
                    font-size: 1.02rem;
                    font-weight: 900;
                    cursor: pointer;
                    box-shadow: 0 6px 22px rgba(255,107,53,0.35);
                    transition: all 0.2s ease;
                    flex-shrink: 0;
                    letter-spacing: 0.01em;
                }
                .co-submit-btn:active { transform: scale(0.97); box-shadow: 0 3px 12px rgba(255,107,53,0.25); }
                .co-submit-btn svg { fill: white; flex-shrink: 0; }
                /* ── Bottom Sheet / Modal ── */
                .co-sheet-backdrop {
                    position: fixed;
                    inset: 0;
                    background: rgba(15, 23, 42, 0.55);
                    backdrop-filter: blur(2px);
                    -webkit-backdrop-filter: blur(2px);
                    z-index: 1000;
                    display: flex;
                    align-items: flex-end;
                    justify-content: center;
                }
                @media (min-width: 540px) {
                    .co-sheet-backdrop { align-items: center; }
                    .co-sheet { border-radius: 24px !important; max-width: 500px; }
                }
                .co-sheet {
                    background: #ffffff;
                    border-radius: 28px 28px 0 0;
                    width: 100%;
                    max-height: calc(100dvh - 40px);
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    animation: co-sheet-up 0.3s cubic-bezier(0.32, 0.72, 0, 1) both;
                    padding-bottom: max(20px, env(safe-area-inset-bottom));
                }
                .co-sheet-handle {
                    width: 38px;
                    height: 4px;
                    background: #dde1e8;
                    border-radius: 99px;
                    margin: 12px auto 4px;
                    flex-shrink: 0;
                }
                .co-sheet-title {
                    text-align: center;
                    font-size: 1.05rem;
                    font-weight: 800;
                    color: #1e293b;
                    padding: 10px 20px 14px;
                    flex-shrink: 0;
                }
                .co-sheet-body {
                    padding: 0 20px;
                    flex: 1;
                    min-height: 0;
                    overflow-y: auto;
                    -webkit-overflow-scrolling: touch;
                    overscroll-behavior: contain;
                }
                .co-sheet-footer {
                    padding: 14px 20px 0;
                    flex-shrink: 0;
                    display: flex;
                    gap: 10px;
                }
                /* Location box */
                .co-loc-box {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    padding: 13px 14px;
                    background: linear-gradient(135deg, #f0fdf4, #dcfce7);
                    border: 1.5px solid #a7f3d0;
                    border-radius: 16px;
                    margin-bottom: 12px;
                    flex-wrap: wrap;
                }
                .co-loc-icon {
                    width: 38px;
                    height: 38px;
                    border-radius: 10px;
                    background: #10b981;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    margin-top: 1px;
                }
                .co-loc-icon svg { fill: white; }
                .co-loc-label { font-size: 0.72rem; color: #065f46; font-weight: 700; margin-bottom: 3px; }
                .co-loc-text { font-size: 0.94rem; font-weight: 700; color: #1e293b; line-height: 1.5; }
                /* Summary section */
                .co-summary-wrap {
                    background: #f9fafb;
                    border: 1px solid #f0f1f4;
                    border-radius: 16px;
                    overflow: hidden;
                    margin-bottom: 14px;
                    flex-shrink: 0;
                }
                .co-summary-scroll {
                    max-height: 180px;
                    overflow-y: auto;
                    -webkit-overflow-scrolling: touch;
                    overscroll-behavior: contain;
                    padding: 10px 14px;
                }
                .co-summary-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 0;
                    font-size: 0.9rem;
                    color: #334155;
                }
                .co-summary-item + .co-summary-item { border-top: 1px solid #f0f1f4; }
                .co-qty-badge {
                    background: #fff0eb;
                    color: #ea580c;
                    border-radius: 8px;
                    padding: 3px 9px;
                    font-size: 0.78rem;
                    font-weight: 800;
                    flex-shrink: 0;
                }
                .co-delivery-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 14px;
                    background: linear-gradient(135deg, #fffdfb, #fff4ed);
                    border-top: 1px solid rgba(255,107,53,0.12);
                }
                .co-delivery-icon {
                    width: 38px;
                    height: 38px;
                    border-radius: 11px;
                    background: linear-gradient(135deg, #ff6b35, #f05a28);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 12px rgba(255,107,53,0.3);
                }
                .co-delivery-icon svg { fill: white; }
                .co-delivery-label { font-size: 0.82rem; font-weight: 800; color: #1e293b; }
                .co-delivery-sub { font-size: 0.7rem; color: #94a3b8; margin-top: 1px; }
                .co-delivery-price { font-size: 1.5rem; font-weight: 900; color: #ea580c; line-height: 1; }
                .co-delivery-currency { font-size: 0.72rem; color: #64748b; font-weight: 700; margin-top: 3px; text-align: center; }
                /* Modal buttons */
                .co-btn-secondary {
                    flex: 1;
                    padding: 14px;
                    border-radius: 14px;
                    border: 1.5px solid #e2e8f0;
                    background: #f7f8fa;
                    font-family: inherit;
                    font-weight: 700;
                    font-size: 0.95rem;
                    color: #64748b;
                    cursor: pointer;
                    transition: all 0.18s;
                }
                .co-btn-secondary:active { background: #eef0f3; }
                .co-btn-primary {
                    flex: 2;
                    padding: 14px;
                    border-radius: 14px;
                    border: none;
                    background: linear-gradient(135deg, #ff6b35, #f05a28);
                    color: white;
                    font-family: inherit;
                    font-weight: 900;
                    font-size: 1rem;
                    cursor: pointer;
                    box-shadow: 0 4px 16px rgba(255,107,53,0.3);
                    transition: all 0.18s;
                }
                .co-btn-primary:active { transform: scale(0.97); }
                .co-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
                /* GPS Button */
                .co-gps-btn {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    padding: 15px;
                    border-radius: 14px;
                    border: 2px dashed;
                    font-family: inherit;
                    font-weight: 800;
                    font-size: 0.97rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    margin-bottom: 14px;
                }
                .co-gps-btn--idle { border-color: #ff6b35; background: #fff8f5; color: #c2410c; }
                .co-gps-btn--done { border-color: #10b981; background: #f0fdf4; color: #065f46; border-style: solid; }
                .co-gps-btn--loading { border-color: #94a3b8; background: #f8fafc; color: #64748b; cursor: wait; }
                .co-form-label { font-size: 0.8rem; font-weight: 700; color: #64748b; margin-bottom: 6px; }
                .co-form-select, .co-form-textarea {
                    width: 100%;
                    padding: 12px 14px;
                    font-family: inherit;
                    font-size: 0.95rem;
                    color: #1e293b;
                    background: #f9fafb;
                    border: 1.5px solid #eef0f3;
                    border-radius: 13px;
                    outline: none;
                    transition: border-color 0.18s, box-shadow 0.18s;
                    margin-bottom: 12px;
                    appearance: none;
                    -webkit-appearance: none;
                }
                .co-form-select:focus, .co-form-textarea:focus {
                    border-color: #ff6b35;
                    box-shadow: 0 0 0 3px rgba(255,107,53,0.1);
                    background: #fff;
                }
                .co-form-textarea { min-height: 80px; resize: vertical; }
                /* ── Tracking: Pending ── */
                .co-tracking-wrap {
                    position: fixed;
                    inset: 0;
                    z-index: 2000;
                    background: linear-gradient(160deg, #fff8f5 0%, #f7f8fa 60%, #f0fdf4 100%);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: flex-start;
                    overflow: hidden;
                    padding: max(20px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) max(20px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left));
                    box-sizing: border-box;
                }
                .co-tracking-inner {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    width: 100%;
                    max-width: 420px;
                    margin: 0 auto;
                    flex: 1;
                    min-height: 0;
                    overflow: hidden;
                    justify-content: center;
                    gap: 0;
                }
                .co-pulse-wrap {
                    position: relative;
                    width: 118px;
                    height: 118px;
                    min-width: 118px;
                    min-height: 118px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    margin-bottom: 22px;
                }
                .co-pulse-ring {
                    position: absolute;
                    inset: 0;
                    border-radius: 50%;
                    border: 2.5px solid #ff6b35;
                    animation: co-pulse-ring 1.6s ease-out infinite;
                }
                .co-pulse-ring:nth-child(2) { animation-delay: 0.55s; }
                .co-pulse-center {
                    width: 74px;
                    height: 74px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #ff6b35, #f05a28);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 8px 28px rgba(255,107,53,0.45);
                    position: relative;
                    z-index: 1;
                }
                .co-pulse-center svg { fill: white; }
                .co-tracking-title {
                    font-size: clamp(1.15rem, 4.5vw, 1.45rem);
                    font-weight: 900;
                    color: #1e293b;
                    margin-bottom: 8px;
                    text-align: center;
                    line-height: 1.3;
                    flex-shrink: 0;
                }
                .co-tracking-sub {
                    font-size: 0.9rem;
                    color: #64748b;
                    text-align: center;
                    line-height: 1.6;
                    margin-bottom: 22px;
                    flex-shrink: 0;
                    max-width: 300px;
                }
                .co-tracking-card {
                    background: #ffffff;
                    border-radius: 20px;
                    box-shadow: 0 4px 24px rgba(0,0,0,0.07);
                    width: 100%;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                    min-height: 0;
                    max-height: 260px;
                }
                .co-tracking-card-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 13px 16px 10px;
                    border-bottom: 1px solid #f0f1f4;
                    flex-shrink: 0;
                }
                .co-tracking-card-label { font-size: 0.73rem; font-weight: 800; color: #ff6b35; letter-spacing: 0.04em; }
                .co-order-num-badge {
                    background: linear-gradient(135deg, #fff0eb, #ffe4d4);
                    color: #ea580c;
                    border-radius: 20px;
                    padding: 4px 12px;
                    font-size: 0.85rem;
                    font-weight: 900;
                }
                .co-tracking-list {
                    flex: 1;
                    min-height: 0;
                    overflow-y: auto;
                    -webkit-overflow-scrolling: touch;
                    overscroll-behavior: contain;
                    padding: 8px 16px;
                }
                .co-tracking-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 8px;
                    padding: 9px 0;
                    font-size: 0.91rem;
                    color: #334155;
                }
                .co-tracking-item + .co-tracking-item { border-top: 1px solid #f7f8fa; }
                .co-tracking-qty { background: #fff0eb; color: #ea580c; border-radius: 7px; padding: 2px 9px; font-size: 0.8rem; font-weight: 800; flex-shrink: 0; }
                .co-track-footer-note {
                    font-size: 0.8rem;
                    color: #94a3b8;
                    text-align: center;
                    margin-top: 18px;
                    flex-shrink: 0;
                }
                .co-cancel-btn {
                    margin-top: 16px;
                    padding: 13px 36px;
                    border-radius: 14px;
                    border: 1.5px solid rgba(239,68,68,0.35);
                    background: rgba(239,68,68,0.06);
                    color: #ef4444;
                    font-family: inherit;
                    font-weight: 800;
                    font-size: 0.95rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    flex-shrink: 0;
                }
                .co-cancel-btn:active { background: rgba(239,68,68,0.12); transform: scale(0.97); }
                /* ── Tracking: Accepted ── */
                .co-accepted-wrap {
                    position: fixed;
                    inset: 0;
                    z-index: 2000;
                    background: linear-gradient(160deg, #f0fdf4 0%, #f7f8fa 50%, #fff8f5 100%);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    overflow-y: auto;
                    -webkit-overflow-scrolling: touch;
                    padding: max(28px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) max(28px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left));
                    box-sizing: border-box;
                    text-align: center;
                    gap: 16px;
                }
                .co-accepted-icon {
                    width: 90px;
                    height: 90px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #10b981, #059669);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 10px 32px rgba(16,185,129,0.35);
                    animation: co-pop-in 0.5s ease-out both;
                    flex-shrink: 0;
                }
                .co-accepted-icon svg { fill: white; }
                .co-accepted-title { font-size: 1.45rem; font-weight: 900; color: #065f46; flex-shrink: 0; }
                .co-driver-card {
                    background: #ffffff;
                    border-radius: 20px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.06);
                    width: 100%;
                    max-width: 400px;
                    padding: 18px;
                    text-align: right;
                    flex-shrink: 0;
                }
                .co-driver-label { font-size: 0.7rem; font-weight: 800; color: #10b981; letter-spacing: 0.04em; margin-bottom: 12px; }
                .co-driver-row { display: flex; align-items: center; gap: 14px; }
                .co-driver-avatar {
                    width: 52px;
                    height: 52px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #ff6b35, #f05a28);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .co-driver-avatar svg { fill: white; }
                .co-driver-name { font-size: 1.1rem; font-weight: 900; color: #1e293b; }
                .co-driver-phone { font-size: 0.88rem; color: #64748b; margin-top: 2px; }
                .co-accepted-summary {
                    background: #ffffff;
                    border-radius: 20px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.06);
                    width: 100%;
                    max-width: 400px;
                    padding: 16px 18px;
                    text-align: right;
                    flex-shrink: 0;
                }
                .co-accepted-summary-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 12px;
                }
                .co-track-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    padding: 16px 24px;
                    border-radius: 16px;
                    border: none;
                    background: linear-gradient(135deg, #10b981, #059669);
                    color: white;
                    font-family: inherit;
                    font-weight: 900;
                    font-size: 1rem;
                    cursor: pointer;
                    box-shadow: 0 6px 22px rgba(16,185,129,0.35);
                    width: 100%;
                    max-width: 400px;
                    flex-shrink: 0;
                    text-decoration: none;
                    transition: all 0.2s;
                }
                .co-track-btn:active { transform: scale(0.97); }
                .co-track-btn svg { fill: white; }
                /* Spinner */
                .co-spinner {
                    width: 18px;
                    height: 18px;
                    border: 2.5px solid rgba(255,255,255,0.35);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: co-spin 0.7s linear infinite;
                    flex-shrink: 0;
                }
            `}</style>

            {/* ── MAIN PAGE ── */}
            <div className="co-page">
                {/* Top Bar */}
                <div className="co-topbar">
                    <button type="button" className="co-back-btn" onClick={goBack} aria-label="رجوع">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                    </button>
                    <div className="co-topbar-logo">
                        <Image src="/logo3.png" alt="يسلمو" width={56} height={56} priority style={{ borderRadius: 13, display: "block" }} />
                    </div>
                    {/* spacer to balance the back button */}
                    <div style={{ width: 40, flexShrink: 0 }} />
                </div>

                {/* Scroll / Content Area */}
                <div className="co-scroll-area">

                    {/* Mode Toggle */}
                    <div className="co-mode-toggle">
                        <Link
                            href="/create-order"
                            className={`co-mode-btn${!isCallMode ? " co-mode-btn--active" : ""}`}
                            role="tab"
                            aria-selected={!isCallMode}
                        >
                            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
                            </svg>
                            كتابة الطلب
                        </Link>
                        <Link
                            href="/create-order?mode=call"
                            className={`co-mode-btn${isCallMode ? " co-mode-btn--active" : ""}`}
                            role="tab"
                            aria-selected={isCallMode}
                        >
                            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72 12.8 12.8 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.8 12.8 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                            اتصال بالمندوب
                        </Link>
                    </div>

                    {/* Order Card */}
                    <div className={`co-card${isCallMode ? "" : " co-card--flex"}`}>
                        <div className="co-card-header">
                            <div className="co-card-icon">
                                <svg viewBox="0 0 24 24" width="22" height="22">
                                    {isCallMode
                                        ? <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C10.07 21 3 13.93 3 5c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.24.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                                        : <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 7h10v2H7V7zm0 4h10v2H7v-2zm0 4h10v2H7v-2z" />
                                    }
                                </svg>
                            </div>
                            <div>
                                <div className="co-card-title">
                                    {isCallMode ? "اتصال بالمندوب" : "الطلبات المرادة"}
                                </div>
                                <div className="co-card-subtitle">
                                    {isCallMode ? "سيحدد المندوب الأصناف معك هاتفيا" : "كل صنف في سطر منفصل"}
                                </div>
                            </div>
                        </div>

                        {isCallMode ? (
                            <div className="co-call-hint">
                                <div className="co-call-hint-icon">
                                    <svg viewBox="0 0 24 24" width="32" height="32">
                                        <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C10.07 21 3 13.93 3 5c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.24.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                                    </svg>
                                </div>
                                <div className="co-call-hint-title">سيتصل بك المندوب</div>
                                <div className="co-call-hint-sub">سيقوم المندوب بالتواصل معك هاتفياً لتحديد طلبك والاتفاق على التفاصيل</div>
                            </div>
                        ) : (
                            <div className={`co-card-body co-card-body--flex`}>
                                <div className="co-textarea-wrap">
                                    <textarea
                                        className="co-textarea"
                                        placeholder={`بيتزا عائلية - 2\nمشروب غازي - 3\nبطاطس مقلية كبيرة - 1\n\nاكتب كل صنف في سطر...`}
                                        value={orders}
                                        onChange={(e) => setOrders(toLatinNums(e.target.value))}
                                        dir="rtl"
                                    />
                                </div>
                                <div className="co-tip">
                                    <svg viewBox="0 0 24 24" width="16" height="16">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                                    </svg>
                                    يرجى كتابة الصنف مع الكمية
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Error */}
                    {submitError && (
                        <div className="co-error">
                            <svg viewBox="0 0 24 24" width="18" height="18">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                            </svg>
                            {submitError}
                        </div>
                    )}

                    {/* Submit Button */}
                    <button className="co-submit-btn" onClick={handleConfirmClick}>
                        <svg viewBox="0 0 24 24" width="21" height="21">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                        </svg>
                        {isCallMode ? "إرسال طلب تواصل" : "تأكيد الطلب"}
                    </button>

                </div>
            </div>

            {/* ── CONFIRM MODAL (Bottom Sheet) ── */}
            {showConfirmModal && (
                <div className="co-sheet-backdrop" onClick={() => setShowConfirmModal(false)}>
                    <div className="co-sheet" onClick={(e) => e.stopPropagation()}>
                        <div className="co-sheet-handle" />
                        <div className="co-sheet-title">تأكيد موقع التوصيل</div>

                        <div className="co-sheet-body">
                            {/* Location box with inline change button */}
                            <div className="co-loc-box">
                                <div className="co-loc-icon">
                                    <svg viewBox="0 0 24 24" width="19" height="19">
                                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                                    </svg>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="co-loc-label">{useCustomLoc ? "موقع مختلف محدد" : "موقع حسابك"}</div>
                                    <div className="co-loc-text">{getActiveLocationText()}</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => { setShowConfirmModal(false); setShowLocModal(true); }}
                                    style={{
                                        display: "flex", alignItems: "center", gap: 5,
                                        padding: "6px 11px", borderRadius: 10,
                                        border: "1.5px solid rgba(255,107,53,0.45)",
                                        background: "rgba(255,255,255,0.85)",
                                        color: "#ea580c", fontFamily: "inherit",
                                        fontSize: "0.8rem", fontWeight: 800,
                                        cursor: "pointer", flexShrink: 0, alignSelf: "center",
                                        transition: "all 0.18s",
                                    }}
                                >
                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                    </svg>
                                    تغيير
                                </button>
                            </div>

                            {/* Order summary */}
                            <div className="co-summary-wrap">
                                <div className="co-summary-scroll">
                                    {getOrderSummaryItems().map((item, i) => (
                                        <div key={i} className="co-summary-item">
                                            <span className="co-qty-badge">× {item.quantity}</span>
                                            <span style={{ flex: 1, textAlign: "right", paddingRight: 8 }}>{item.name}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="co-delivery-row">
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div className="co-delivery-icon">
                                            <svg viewBox="0 0 24 24" width="20" height="20">
                                                <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <div className="co-delivery-label">رسوم التوصيل</div>
                                            <div className="co-delivery-sub">ثابتة لهذا الطلب</div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="co-delivery-price">{DEFAULT_DELIVERY_FEE_SYP}</div>
                                        <div className="co-delivery-currency">ل.س جديدة</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="co-sheet-footer">
                            <button type="button" className="co-btn-secondary" onClick={() => setShowConfirmModal(false)}>
                                رجوع
                            </button>
                            <button
                                type="button"
                                className="co-btn-primary"
                                onClick={submitOrder}
                                disabled={isSubmitting}
                                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                            >
                                {isSubmitting ? <><span className="co-spinner" />جاري الإرسال...</> : "إرسال الطلب"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── LOCATION MODAL (Bottom Sheet) ── */}
            {showLocModal && (
                <div className="co-sheet-backdrop" onClick={() => setShowLocModal(false)}>
                    <div className="co-sheet" onClick={(e) => e.stopPropagation()}>
                        <div className="co-sheet-handle" />
                        <div className="co-sheet-title">تحديد موقع مختلف</div>

                        <div className="co-sheet-body">
                            {/* GPS button */}
                            <button
                                type="button"
                                className={`co-gps-btn${modalGpsDone ? " co-gps-btn--done" : modalGpsLoading ? " co-gps-btn--loading" : " co-gps-btn--idle"}`}
                                onClick={getModalLocation}
                                disabled={modalGpsLoading}
                            >
                                {modalGpsDone ? (
                                    <>
                                        <svg viewBox="0 0 24 24" width="20" height="20" fill="#10b981">
                                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                                        </svg>
                                        تم — {modalCoords.lat.toFixed(4)}, {modalCoords.lng.toFixed(4)}
                                    </>
                                ) : modalGpsLoading ? (
                                    <>
                                        <span style={{ width: 18, height: 18, border: "2.5px solid #cbd5e1", borderTopColor: "#ff6b35", borderRadius: "50%", animation: "co-spin 0.7s linear infinite", display: "inline-block" }} />
                                        جاري تحديد موقعك...
                                    </>
                                ) : (
                                    <>
                                        <svg viewBox="0 0 24 24" width="20" height="20" fill="#ff6b35">
                                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                                        </svg>
                                        تحديد موقعي تلقائياً
                                    </>
                                )}
                            </button>

                            {modalGpsError && (
                                <div className="co-error" style={{ marginBottom: 12 }}>
                                    <svg viewBox="0 0 24 24" width="17" height="17">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                                    </svg>
                                    {modalGpsError}
                                </div>
                            )}

                            {modalGpsDone && (
                                <>
                                    <div className="co-form-label">المدينة</div>
                                    <select
                                        className="co-form-select"
                                        value={modalCity}
                                        onChange={(e) => setModalCity(e.target.value)}
                                    >
                                        <option value="" disabled>اختر المدينة</option>
                                        {CITY_OPTIONS.map((c) => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>

                                    <div className="co-form-label">العنوان التفصيلي</div>
                                    <textarea
                                        className="co-form-textarea"
                                        placeholder="الحي، الشارع، بجانب أي معلم، رقم البناء..."
                                        value={modalDesc}
                                        onChange={(e) => setModalDesc(toLatinNums(e.target.value))}
                                    />
                                </>
                            )}
                        </div>

                        <div className="co-sheet-footer">
                            <button type="button" className="co-btn-secondary" onClick={() => setShowLocModal(false)}>إلغاء</button>
                            <button type="button" className="co-btn-primary" onClick={confirmCustomLocation}>تأكيد الموقع</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── TRACKING: PENDING ── */}
            {trackingStatus === "pending" && (
                <div className="co-tracking-wrap">
                    <div className="co-tracking-inner">
                        <div className="co-pulse-wrap">
                            <div className="co-pulse-ring" />
                            <div className="co-pulse-ring" />
                            <div className="co-pulse-center">
                                <svg viewBox="0 0 24 24" width="34" height="34">
                                    {isCallMode
                                        ? <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                                        : <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                                    }
                                </svg>
                            </div>
                        </div>

                        <div className="co-tracking-title">جاري البحث عن مندوب...</div>
                        <div className="co-tracking-sub">
                            {isCallMode
                                ? "طلب تواصل في الانتظار، سيتم الاتصال بك هاتفياً بمجرد قبول المندوب"
                                : "طلبك في الانتظار، سيتم إشعارك فور قبول مندوب لطلبك"
                            }
                        </div>

                        <div className="co-tracking-card">
                            <div className="co-tracking-card-header">
                                <div className="co-tracking-card-label">ملخص طلبك</div>
                                <div className="co-order-num-badge">#{orderNumber}</div>
                            </div>
                            <div className="co-tracking-list">
                                {orderItems.map((item, i) => (
                                    <div key={i} className="co-tracking-item">
                                        <span className="co-tracking-qty">× {item.quantity}</span>
                                        <span style={{ flex: 1, textAlign: "right", paddingRight: 6, wordBreak: "break-word" }}>{item.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="co-track-footer-note">لا تغلق هذه الشاشة حتى يقبل المندوب طلبك</div>

                        <button type="button" className="co-cancel-btn" onClick={cancelOrder}>
                            إلغاء الطلب
                        </button>
                    </div>
                </div>
            )}

            {/* ── TRACKING: ACCEPTED ── */}
            {trackingStatus === "accepted" && driverInfo && (
                <div className="co-accepted-wrap">
                    <div className="co-accepted-icon">
                        <svg viewBox="0 0 24 24" width="44" height="44">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                        </svg>
                    </div>

                    <div className="co-accepted-title">تم قبول طلبك! 🎉</div>

                    {/* Driver card */}
                    <div className="co-driver-card">
                        <div className="co-driver-label">معلومات المندوب</div>
                        <div className="co-driver-row">
                            <div className="co-driver-avatar">
                                <svg viewBox="0 0 24 24" width="26" height="26">
                                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                </svg>
                            </div>
                            <div>
                                <div className="co-driver-name">{driverInfo.name}</div>
                                {driverInfo.phone && (
                                    <div className="co-driver-phone" dir="ltr">{driverInfo.phone}</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Order summary */}
                    <div className="co-accepted-summary">
                        <div className="co-accepted-summary-header">
                            <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "#475569" }}>ملخص الطلب</div>
                            <div className="co-order-num-badge">#{orderNumber}</div>
                        </div>
                        {orderItems.map((item, i) => (
                            <div key={i} className="co-summary-item">
                                <span style={{ background: "#f0fdf4", color: "#059669", borderRadius: 8, padding: "3px 10px", fontSize: "0.8rem", fontWeight: 800 }}>× {item.quantity}</span>
                                <span style={{ flex: 1, textAlign: "right", paddingRight: 8, color: "#334155", fontWeight: 600 }}>{item.name}</span>
                            </div>
                        ))}
                    </div>

                    <Link href="/track-order" className="co-track-btn">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 21s-6.5-4.2-6.5-10a6.5 6.5 0 0 1 13 0c0 5.8-6.5 10-6.5 10z" />
                            <circle cx="12" cy="11" r="2.2" />
                        </svg>
                        تتبع الطلب
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
                <div style={{
                    minHeight: "100dvh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#f7f8fa",
                    fontFamily: "inherit",
                    color: "#94a3b8",
                    fontWeight: 700,
                    flexDirection: "column",
                    gap: 12,
                }}>
                    <div style={{
                        width: 40, height: 40,
                        border: "3px solid #fee2d4",
                        borderTopColor: "#ff6b35",
                        borderRadius: "50%",
                        animation: "co-spin 0.7s linear infinite",
                    }} />
                    جاري التحميل...
                </div>
            }
        >
            <CreateOrderContent />
        </Suspense>
    );
}
