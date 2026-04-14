"use client";

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    doc,
    getDoc,
    getDocs,
    updateDoc,
    serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { getTokenOrRedirect } from "@/lib/clientAuth";
import { showAppAlert } from "@/lib/appAlert";
import { showAppConfirm } from "@/lib/appConfirm";
import { signInWithEmailAndPassword } from "firebase/auth";
import SwipeToAccept from "./SwipeToAccept";
import {
    getDeliveryFeeForOrder,
    getAcceptCommissionSyp,
    DRIVER_MAX_ACTIVE_ORDERS_BEFORE_ACCEPT,
} from "@/lib/orderPricing";
import "./driver.css";

// ─── Config ───────────────────────────────────────────────────────────────
// Driver's area. In a real app this comes from the driver's Firestore profile.
const DRIVER_AREA_ID = "default";
const CANCEL_REASONS = [
    "الزبون لم يرد على المكالمة",
    "لم يتم الاتفاق",
    "العنوان غير واضح",
    "لا أستطيع تنفيذ الطلب حاليا",
];
const DRIVER_SETTINGS_DEFAULT = {
    name: "",
    phone: "",
    vehicleType: "",
    area: DRIVER_AREA_ID,
    isAvailable: true,
    soundAlerts: true,
    vibrationAlerts: true,
};

// ─── Order Details Modal ──────────────────────────────────────────────────
function OrderModal({ order, onClose, onAccept, isAccepting, walletBalanceSyp, activeIncompleteCount = 0 }) {
    if (!order) return null;

    const commission = getAcceptCommissionSyp(order);
    const atActiveLimit = activeIncompleteCount >= DRIVER_MAX_ACTIVE_ORDERS_BEFORE_ACCEPT;
    const swipeBlocked = walletBalanceSyp === null || walletBalanceSyp < commission || atActiveLimit;
    let swipeHint = "";
    if (walletBalanceSyp === null) swipeHint = "جاري التحميل...";
    else if (atActiveLimit) {
        swipeHint = `أنهِ طلباتك الحالية أولاً (حد أقصى ${DRIVER_MAX_ACTIVE_ORDERS_BEFORE_ACCEPT} طلبات نشطة)`;
    } else if (walletBalanceSyp < commission) swipeHint = "الرصيد غير كافٍ";

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-title">تفاصيل الطلب <span style={{ color: "var(--driver-primary)", fontFamily: "'Outfit', sans-serif" }}>#{order.orderNumber}</span></div>
                    <button className="close-btn" onClick={onClose}>
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="#64748b">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                        </svg>
                    </button>
                </div>

                <div className="detail-row">
                    <div
                        className="detail-value"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            fontSize: "1rem",
                        }}
                    >
                        <span style={{ color: "var(--driver-text-muted)", fontWeight: 800 }}>اسم العميل:</span>
                        <span style={{ color: "var(--driver-text)", fontWeight: 900 }}>{order.customerName}</span>
                    </div>
                </div>

                <div className="detail-row">
                    <div className="detail-label" style={{ marginBottom: "8px" }}>عنوان التوصيل</div>
                    <div
                        style={{
                            background: "rgba(30, 58, 95, 0.05)",
                            border: "1px solid rgba(30, 58, 95, 0.2)",
                            borderRadius: "12px",
                            padding: "10px 12px",
                        }}
                    >
                        <div className="detail-value" style={{ lineHeight: "1.6", fontSize: "0.95rem" }}>
                            {order.customerAddress}
                        </div>
                        {order.locationDesc ? (
                            <div style={{ marginTop: "4px", fontSize: "0.86rem", color: "var(--driver-text-muted)", fontWeight: 700 }}>
                                {order.locationDesc}
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="detail-row" style={{ marginTop: "12px" }}>
                    <div className="detail-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>قائمة الطلبات</span>
                        <span style={{ background: "var(--driver-primary)", color: "white", padding: "3px 10px", borderRadius: "6px", fontSize: "0.8rem", fontWeight: 700 }}>
                            {order.items?.length || 0} أصناف
                        </span>
                    </div>
                    <div className="items-list">
                        {order.items?.map((item, idx) => (
                            <div key={idx} className="item-row">
                                <span style={{ fontWeight: 700, color: "var(--driver-text)" }}>{item.name}</span>
                                <span style={{ background: "rgba(30, 58, 95, 0.08)", color: "var(--driver-primary)", padding: "2px 8px", borderRadius: "6px", fontWeight: 700, fontSize: "0.85rem" }}>× {item.quantity}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {order.notes && (
                    <div className="detail-row" style={{ marginTop: "20px" }}>
                        <div className="detail-label">ملاحظات العميل</div>
                        <div style={{ background: "#fefce8", padding: "12px", borderRadius: "8px", fontSize: "0.92rem", color: "#854d0e", fontWeight: 600, border: "1px solid #fde68a", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="#854d0e" style={{ flexShrink: 0, marginTop: 2 }}><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                            <span>{order.notes}</span>
                        </div>
                    </div>
                )}

                <div style={{ marginTop: "18px" }}>
                    <SwipeToAccept
                        isLoading={isAccepting}
                        disabled={swipeBlocked}
                        disabledHint={swipeBlocked ? swipeHint : undefined}
                        onAccept={() => onAccept(order.id)}
                    />
                </div>
            </div>
        </div>
    );
}

// ─── Driver Login Screen ──────────────────────────────────────────────────
function DriverLogin({ onLogin }) {
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!phone || !password) { setError("أدخل رقم الهاتف وكلمة السر"); return; }

        setLoading(true);
        setError("");

        try {
            // Derive the pseudo-email used during registration
            const email = `${phone.trim().replace(/\s/g, "")}@yaslamo.app`;
            const cred = await signInWithEmailAndPassword(auth, email, password);
            onLogin(cred.user);
        } catch (err) {
            console.error(err);
            setError("رقم الهاتف أو كلمة السر غير صحيحة");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <svg viewBox="0 0 24 24" width="52" height="52" fill="var(--driver-primary)" style={{ marginBottom: "16px" }}>
                    <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                </svg>
                <h1 style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: "6px", color: "var(--driver-text)", textAlign: "center" }}>بوابة المندوبين</h1>
                <p style={{ color: "var(--driver-text-muted)", marginBottom: "28px", fontSize: "0.95rem", textAlign: "center", fontWeight: 600 }}>تطبيق يسلمو للتوصيل</p>

                <form onSubmit={handleLogin} style={{ width: "100%", display: "flex", flexDirection: "column", gap: "20px" }}>
                    <input
                        type="tel"
                        placeholder="رقم الهاتف"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        dir="ltr"
                        className="login-input"
                    />
                    <input
                        type="password"
                        placeholder="كلمة السر"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="login-input"
                        style={{ textAlign: "right", direction: "rtl" }}
                    />
                    {error && (
                        <div style={{ color: "var(--driver-danger)", background: "rgba(239, 68, 68, 0.1)", borderRadius: "12px", padding: "12px 16px", fontSize: "0.95rem", fontWeight: 700, textAlign: "center", border: "1px solid rgba(239, 68, 68, 0.2)" }}>{error}</div>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        className="login-btn"
                        style={{ marginTop: "10px", opacity: loading ? 0.7 : 1 }}
                    >
                        {loading ? "جاري الدخول..." : "تسجيل الدخول"}
                    </button>
                </form>
            </div>
        </div>
    );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────
export default function DriverDashboard() {
    const [user, setUser] = useState(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [orders, setOrders] = useState([]);
    const [acceptedOrders, setAcceptedOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [isAccepting, setIsAccepting] = useState(false);
    const [accessDenied, setAccessDenied] = useState(false);
    const [activeTab, setActiveTab] = useState("available"); // "available" | "mine"
    const [callActionsReady, setCallActionsReady] = useState({});
    const [callDetailsExpanded, setCallDetailsExpanded] = useState({});
    const [cancelModalOrder, setCancelModalOrder] = useState(null);
    const [cancelReason, setCancelReason] = useState(CANCEL_REASONS[0]);
    const [verifyModalOrder, setVerifyModalOrder] = useState(null);
    const [verifyModalCalled, setVerifyModalCalled] = useState(false);
    const [onTheWayModalOrder, setOnTheWayModalOrder] = useState(null);
    const [onTheWayPurchaseInput, setOnTheWayPurchaseInput] = useState("");
    const [onTheWaySaving, setOnTheWaySaving] = useState(false);
    /** رصيد المحفظة (ل.س) — null حتى اكتمال أول لقطة من Firestore */
    const [walletBalanceSyp, setWalletBalanceSyp] = useState(null);
    const callFlowStorageKey = user ? `yaslamo_driver_call_flow_${user.uid}` : null;
    const settingsStorageKey = user ? `yaslamo_driver_settings_${user.uid}` : null;
    const [driverSettings, setDriverSettings] = useState(DRIVER_SETTINGS_DEFAULT);
    const driverLayoutRef = useRef(null);
    const driverHeaderRef = useRef(null);

    /** يطابق top للتبويب المثبت مع ارتفاع الهيدر الفعلي (اللفّ على الجوال يكبّر الهيدر) */
    useLayoutEffect(() => {
        if (!authChecked || !user || accessDenied) return;
        const layout = driverLayoutRef.current;
        const header = driverHeaderRef.current;
        if (!layout || !header) return;

        const syncStickyOffset = () => {
            const h = Math.ceil(header.getBoundingClientRect().height);
            layout.style.setProperty("--driver-header-sticky-offset", `${h}px`);
        };

        syncStickyOffset();
        const ro = new ResizeObserver(syncStickyOffset);
        ro.observe(header);
        window.addEventListener("resize", syncStickyOffset);
        return () => {
            ro.disconnect();
            window.removeEventListener("resize", syncStickyOffset);
        };
    }, [authChecked, user, accessDenied]);

    useEffect(() => {
        if (!callFlowStorageKey) return;
        try {
            const raw = localStorage.getItem(callFlowStorageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
                setCallActionsReady(
                    parsed.callActionsReady && typeof parsed.callActionsReady === "object"
                        ? parsed.callActionsReady
                        : {}
                );
                setCallDetailsExpanded(
                    parsed.callDetailsExpanded && typeof parsed.callDetailsExpanded === "object"
                        ? parsed.callDetailsExpanded
                        : {}
                );
            }
        } catch (err) {
            console.error("read call flow storage error:", err);
        }
    }, [callFlowStorageKey]);

    useEffect(() => {
        if (!callFlowStorageKey) return;
        try {
            localStorage.setItem(
                callFlowStorageKey,
                JSON.stringify({
                    callActionsReady,
                    callDetailsExpanded,
                })
            );
        } catch (err) {
            console.error("save call flow storage error:", err);
        }
    }, [callFlowStorageKey, callActionsReady, callDetailsExpanded]);

    useEffect(() => {
        if (!settingsStorageKey || !user) return;
        try {
            const raw = localStorage.getItem(settingsStorageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                const merged = { ...DRIVER_SETTINGS_DEFAULT, ...parsed };
                setDriverSettings(merged);
                return;
            }
            const initialSettings = {
                ...DRIVER_SETTINGS_DEFAULT,
                name: user.displayName || "",
                phone: user.phoneNumber || "",
            };
            setDriverSettings(initialSettings);
            localStorage.setItem(settingsStorageKey, JSON.stringify(initialSettings));
        } catch (err) {
            console.error("read driver settings storage error:", err);
        }
    }, [settingsStorageKey, user]);

    // Restore auth state on page load
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
        const verifyDriverRole = async () => {
            if (!user) {
                setAccessDenied(false);
                return;
            }
            try {
                const profileSnap = await getDoc(doc(db, "users", user.uid));
                const role = profileSnap.exists() ? profileSnap.data()?.role : null;
                setAccessDenied(role !== "driver");
            } catch (err) {
                console.error("driver role check error:", err);
                setAccessDenied(true);
            }
        };
        verifyDriverRole();
    }, [user]);

    useEffect(() => {
        if (!user?.uid) {
            setWalletBalanceSyp(null);
            return;
        }
        const userRef = doc(db, "users", user.uid);
        const unsub = onSnapshot(
            userRef,
            (snap) => {
                if (!snap.exists()) {
                    setWalletBalanceSyp(0);
                    return;
                }
                const w = snap.data().walletBalanceSyp;
                setWalletBalanceSyp(typeof w === "number" && !Number.isNaN(w) ? w : 0);
            },
            (err) => console.error("wallet listener:", err)
        );
        return () => unsub();
    }, [user]);

    // Real-time listener: pending orders for this area
    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, "orders"),
            where("status", "==", "pending"),
            where("areaId", "==", DRIVER_AREA_ID),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const liveOrders = snapshot.docs.map((docSnap) => {
                const data = docSnap.data();
                return { id: docSnap.id, ...data, createdAt: data.createdAt?.toDate?.()?.toISOString() || null };
            });
            setOrders(liveOrders);
        }, (error) => { console.error("onSnapshot error:", error); });

        return () => unsubscribe();
    }, [user]);

    // Real-time listener: this driver's accepted orders
    useEffect(() => {
        if (!user) return;

        // Listen for orders in both accepted and on_the_way states
        const q1 = query(collection(db, "orders"), where("driverId", "==", user.uid), where("status", "==", "accepted"), orderBy("updatedAt", "desc"));
        const q2 = query(collection(db, "orders"), where("driverId", "==", user.uid), where("status", "==", "on_the_way"), orderBy("updatedAt", "desc"));

        const toObj = (docSnap) => { const d = docSnap.data(); return { id: docSnap.id, ...d, updatedAt: d.updatedAt?.toDate?.()?.toISOString() || null }; };
        let snap1Docs = [], snap2Docs = [];
        const merge = () => {
            const all = [...snap1Docs, ...snap2Docs].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
            setAcceptedOrders(all);
            if (all.length > 0) setActiveTab("mine");
        };
        const unsub1 = onSnapshot(q1, (s) => { snap1Docs = s.docs.map(toObj); merge(); }, console.error);
        const unsub2 = onSnapshot(q2, (s) => { snap2Docs = s.docs.map(toObj); merge(); }, console.error);
        return () => { unsub1(); unsub2(); };
    }, [user]);

    // قبول الطلب عبر API السيرفر (خصم 20% من رسوم التوصيل من الرصيد)
    const handleAcceptOrder = useCallback(async (orderId) => {
        if (!user) return;
        if (acceptedOrders.length >= DRIVER_MAX_ACTIVE_ORDERS_BEFORE_ACCEPT) {
            showAppAlert(
                `لديك ${DRIVER_MAX_ACTIVE_ORDERS_BEFORE_ACCEPT} طلبات لم تُسلَّم بعد. أنهِ أحدها قبل قبول طلب جديد.`
            );
            return;
        }
        setIsAccepting(true);

        try {
            const token = await getTokenOrRedirect({
                replace: (href) => {
                    try {
                        window.location.href = href;
                    } catch {}
                },
            });
            if (!token) {
                return;
            }
            const res = await fetch("/api/driver/accept-order", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ orderId }),
            });
            if (res.status === 401 || res.status === 403) {
                try {
                    localStorage.removeItem("yaslamo_user");
                    window.dispatchEvent(new Event("yaslamo_auth"));
                } catch {}
                window.location.href = "/login";
                return;
            }
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || "تعذر قبول الطلب");
            }
            setSelectedOrder(null);
        } catch (err) {
            console.error("Accept order error:", err);
            showAppAlert(err.message || "حدث خطأ في قبول الطلب");
        } finally {
            setIsAccepting(false);
        }
    }, [user, acceptedOrders.length]);

    // ── Verification: set customerStatus ONCE ──────────────────────────────
    const handleVerifyCustomer = useCallback(async (order, action) => {
        try {
            // Write to the ORDER doc (so onSnapshot updates the card instantly)
            await updateDoc(doc(db, "orders", order.id), { customerStatus: action });

            // Also write to the USER doc (so future orders inherit the status)
            if (order.customerUid) {
                await updateDoc(doc(db, "users", order.customerUid), { customerStatus: action });
            } else if (order.customerPhone) {
                const snap = await getDocs(
                    query(collection(db, "users"), where("phone", "==", order.customerPhone.trim()))
                );
                if (!snap.empty) await updateDoc(snap.docs[0].ref, { customerStatus: action });
            }

            showAppAlert(action === "verified" ? "✅ تم توثيق الزبون" : "🚫 تم الإبلاغ عن الزبون");
            setVerifyModalOrder(null);
            setVerifyModalCalled(false);
        } catch (err) {
            console.error("verify error:", err);
            showAppAlert("حدث خطأ");
        }
    }, []);

    const updateCustomerStatusByPhoneOrUid = useCallback(async (order, nextStatus) => {
        if (order.customerUid) {
            await updateDoc(doc(db, "users", order.customerUid), { customerStatus: nextStatus });
            return;
        }
        if (order.customerPhone) {
            const snap = await getDocs(
                query(collection(db, "users"), where("phone", "==", order.customerPhone.trim()))
            );
            if (!snap.empty) await updateDoc(snap.docs[0].ref, { customerStatus: nextStatus });
        }
    }, []);

    const handleVerifyReport = useCallback(async (order, reportType) => {
        try {
            if (reportType === "continue_on_driver_risk") {
                const ok = await showAppConfirm(
                    "هل تريد متابعة الطلب على مسؤوليتك الكاملة؟ إذا كان الطلب مزيفاً ستكون المسؤولية عليك.",
                );
                if (!ok) return;
                showAppAlert("تمت المتابعة على مسؤوليتك. أكمل الطلب بحذر.");
                setVerifyModalOrder(null);
                setVerifyModalCalled(false);
                return;
            }

            if (reportType === "number_not_in_service") {
                await updateDoc(doc(db, "orders", order.id), {
                    status: "cancelled",
                    cancelReason:
                        "الرقم غير موجود بالخدمة — يجب إنشاء حساب جديد برقم هاتف موجود بالخدمة.",
                    cancelledBy: "driver",
                    customerStatus: "blocked_phone",
                    updatedAt: serverTimestamp(),
                });
                await updateCustomerStatusByPhoneOrUid(order, "blocked_phone");
                showAppAlert(
                    "تم إلغاء الطلب وحظر الحساب. يُطلب من الزبون إنشاء حساب جديد برقم هاتف موجود بالخدمة.",
                );
                setVerifyModalOrder(null);
                setVerifyModalCalled(false);
                return;
            }

            if (reportType === "no_answer_on_call") {
                await updateDoc(doc(db, "orders", order.id), {
                    status: "cancelled",
                    cancelReason:
                        "لم يرد أحد على المكالمة — يجب الرد على المكالمة في أول عملية إنشاء طلب.",
                    cancelledBy: "driver",
                    customerStatus: "must_answer_call_once",
                    updatedAt: serverTimestamp(),
                });
                await updateCustomerStatusByPhoneOrUid(order, "must_answer_call_once");
                showAppAlert(
                    "تم إلغاء الطلب. سيظهر للزبون تنبيه بضرورة الرد على المكالمة في أول طلب توصيل.",
                );
                setVerifyModalOrder(null);
                setVerifyModalCalled(false);
                return;
            }
        } catch (err) {
            console.error("verify report error:", err);
            showAppAlert("حدث خطأ أثناء تنفيذ الإبلاغ");
        }
    }, [updateCustomerStatusByPhoneOrUid]);

    // ── Update order status (delivered only — «في الطريق» يمر عبر نافذة سعر المشتريات) ──
    const handleUpdateStatus = useCallback(async (orderId, newStatus) => {
        if (newStatus !== "delivered") return;
        const msg = "هل أنت متأكد من تسليم الطلب للزبون بنجاح؟";
        showAppConfirm(msg).then(async (ok) => {
            if (!ok) return;

            try {
                await updateDoc(doc(db, "orders", orderId), {
                    status: newStatus,
                    updatedAt: serverTimestamp(),
                });
            } catch (err) {
                console.error("status update error:", err);
                showAppAlert("حدث خطأ أثناء تحديث حالة الطلب");
            }
        });
    }, []);

    const submitOnTheWayPricing = useCallback(async () => {
        if (!onTheWayModalOrder) return;
        const raw = String(onTheWayPurchaseInput).trim().replace(/,/g, ".");
        const purchase = parseFloat(raw);
        if (Number.isNaN(purchase) || purchase < 0) {
            showAppAlert("أدخل مبلغاً صحيحاً لمشتريات الطلب");
            return;
        }
        const deliveryFeeSyp = getDeliveryFeeForOrder(onTheWayModalOrder);
        const totalDueSyp = Math.round((purchase + deliveryFeeSyp) * 100) / 100;
        setOnTheWaySaving(true);
        try {
            await updateDoc(doc(db, "orders", onTheWayModalOrder.id), {
                status: "on_the_way",
                itemsPurchaseSyp: purchase,
                deliveryFeeSyp,
                totalDueSyp,
                updatedAt: serverTimestamp(),
            });
            setOnTheWayModalOrder(null);
            setOnTheWayPurchaseInput("");
        } catch (err) {
            console.error("on the way pricing error:", err);
            showAppAlert("حدث خطأ أثناء حفظ السعر أو تحديث الحالة");
        } finally {
            setOnTheWaySaving(false);
        }
    }, [onTheWayModalOrder, onTheWayPurchaseInput]);

    const onTheWayFeePreview = onTheWayModalOrder ? getDeliveryFeeForOrder(onTheWayModalOrder) : 0;
    const onTheWayPurchasePreview = Math.max(
        0,
        parseFloat(String(onTheWayPurchaseInput).trim().replace(/,/g, ".")) || 0
    );
    const onTheWayTotalPreview = Math.round((onTheWayPurchasePreview + onTheWayFeePreview) * 100) / 100;

    const handleCancelOrder = useCallback(async () => {
        if (!cancelModalOrder) return;
        try {
            await updateDoc(doc(db, "orders", cancelModalOrder.id), {
                status: "cancelled",
                cancelReason,
                cancelledBy: "driver",
                updatedAt: serverTimestamp(),
            });
            setCancelModalOrder(null);
            setCancelReason(CANCEL_REASONS[0]);
        } catch (err) {
            console.error("cancel order error:", err);
            showAppAlert("حدث خطأ أثناء إلغاء الطلب");
        }
    }, [cancelModalOrder, cancelReason]);

    // ── Render ────────────────────────────────────────────────────────────
    if (!authChecked) {
        return (
            <div className="driver-layout" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
                <div style={{ color: "var(--driver-text-muted)" }}>...</div>
            </div>
        );
    }

    if (!user) return <DriverLogin onLogin={setUser} />;
    if (accessDenied) {
        return (
            <div className="driver-layout" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "24px" }}>
                <div className="empty-state">
                    <div style={{ fontWeight: 800, marginBottom: "8px" }}>غير مخول لدخول صفحة المندوب</div>
                    <button
                        className="order-details-btn"
                        onClick={() => auth.signOut().then(() => setUser(null))}
                        style={{ marginTop: "8px" }}
                    >
                        تسجيل خروج
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="driver-layout" ref={driverLayoutRef}>
            <header className="driver-header" ref={driverHeaderRef}>
                <div className="driver-header-brand">
                    <div className="driver-title">
                        <span className="driver-title-icon-wrap" aria-hidden>
                            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                                <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                            </svg>
                        </span>
                        <div className="driver-title-text-block">
                            <span className="driver-title-eyebrow">يسلمو</span>
                            <span className="driver-title-text">بوابة المندوبين</span>
                        </div>
                    </div>
                    <div className="driver-header-wallet" title="رصيد المحفظة">
                        <span className="driver-header-wallet-icon" aria-hidden>
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
                            </svg>
                        </span>
                        <span className="driver-header-wallet-body">
                            <span className="driver-header-wallet-label">رصيد</span>
                            <span className="driver-header-wallet-amount">
                                <span className="driver-header-wallet-value">{walletBalanceSyp === null ? "…" : walletBalanceSyp}</span>
                                <span className="driver-header-wallet-currency">ل.س</span>
                            </span>
                        </span>
                    </div>
                </div>
                <div className="driver-header-actions">
                    <div className={`driver-status-badge ${driverSettings.isAvailable ? "" : "driver-status-badge--offline"}`}>
                        {driverSettings.isAvailable ? "متاح" : "غير متاح"}
                    </div>
                    <div className="driver-header-toolbar">
                        <Link
                            href="/driver/settings"
                            className="driver-settings-btn"
                            aria-label="إعدادات المندوب"
                            title="إعدادات المندوب"
                        >
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                                <path d="M19.14 12.94a7.96 7.96 0 0 0 .05-.94 7.96 7.96 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.17 7.17 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.13.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.48a.5.5 0 0 0 .12.64l2.03 1.58a7.96 7.96 0 0 0-.05.94c0 .32.02.63.05.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.31.6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54c.04.24.25.42.49.42h3.8c.24 0 .45-.18.49-.42l.36-2.54c.58-.22 1.13-.53 1.63-.94l2.39.96c.22.09.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5z" />
                            </svg>
                        </Link>
                    </div>
                </div>
            </header>

            {/* ── Tab Bar ── */}
            <div className="driver-tabs-container">
                <div className="driver-tabs">
                    <button
                        className={`driver-tab-btn ${activeTab === "available" ? "active" : ""}`}
                        onClick={() => setActiveTab("available")}
                    >
                        المتاحة
                        {orders.length > 0 && (
                            <span className="tab-badge">
                                {orders.length}
                            </span>
                        )}
                    </button>
                    <button
                        className={`driver-tab-btn ${activeTab === "mine" ? "active" : ""}`}
                        onClick={() => setActiveTab("mine")}
                    >
                        طلباتي
                        {acceptedOrders.length > 0 && (
                            <span className="tab-badge">
                                {acceptedOrders.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            <main className="driver-content">

                {/* ── Tab: Available Orders ── */}
                {activeTab === "available" && (
                    <>
                        <div className="section-heading">
                            الطلبات المتاحة ({orders.length})
                            <span style={{ fontSize: "0.78rem", color: "var(--driver-accent)", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>● مباشر</span>
                        </div>

                        {acceptedOrders.length >= DRIVER_MAX_ACTIVE_ORDERS_BEFORE_ACCEPT && (
                            <div
                                style={{
                                    marginBottom: "14px",
                                    padding: "10px 12px",
                                    borderRadius: "10px",
                                    background: "#fef3c7",
                                    border: "1px solid #fcd34d",
                                    fontSize: "0.86rem",
                                    fontWeight: 700,
                                    color: "#92400e",
                                    lineHeight: 1.55,
                                }}
                            >
                                لديك {DRIVER_MAX_ACTIVE_ORDERS_BEFORE_ACCEPT} طلبات لم تُسلَّم بعد. أنهِ أحدها من «طلباتي» قبل
                                قبول طلب جديد.
                            </div>
                        )}

                        {orders.length === 0 ? (
                            <div className="empty-state">
                                <svg viewBox="0 0 24 24" width="48" height="48" fill="var(--driver-text-muted)" style={{ marginBottom: "12px", opacity: 0.5 }}>
                                    <path d="M20 6H12l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 14H4V6h6.17l2 2H20v12z" />
                                </svg>
                                <div style={{ fontWeight: 700, color: "var(--driver-text)", fontSize: "1rem" }}>لا توجد طلبات جديدة حالياً</div>
                                <div style={{ fontSize: "0.88rem", color: "var(--driver-text-muted)", marginTop: "6px" }}>ستظهر الطلبات الجديدة هنا تلقائياً</div>
                            </div>
                        ) : (
                            orders.map((order) => (
                                <div key={order.id} className="order-card-wrapper">
                                    <div className="order-card">
                                        <div className="order-card-header">
                                            <span className="order-time">
                                                <svg viewBox="0 0 24 24" width="16" height="16" fill="var(--driver-primary)"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
                                                {order.createdAt ? new Date(order.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) : ""}
                                            </span>
                                            <span className="order-id">#{order.orderNumber}</span>
                                        </div>
                                        <div className="order-customer">
                                            <div className="customer-name-label">اسم العميل</div>
                                            <div className="customer-name">{order.customerName}</div>
                                            <div className="customer-address">
                                                <svg viewBox="0 0 24 24" width="20" height="20" fill="var(--driver-primary)" style={{ flexShrink: 0, marginTop: "2px" }}>
                                                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                                                </svg>
                                                {order.customerAddress}
                                            </div>
                                        </div>
                                        <button className="order-details-btn" onClick={() => setSelectedOrder(order)}>
                                            عرض وتفاصيل الطلب
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </>
                )}

                {/* ── Tab: My Accepted Orders ── */}
                {activeTab === "mine" && (
                    <>
                        <div className="section-heading">
                            طلباتي المقبولة ({acceptedOrders.length})
                        </div>

                        {acceptedOrders.length === 0 ? (
                            <div className="empty-state">
                                <svg viewBox="0 0 24 24" width="48" height="48" fill="var(--driver-text-muted)" style={{ marginBottom: "12px", opacity: 0.5 }}>
                                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM17.99 9l-1.41-1.42-6.59 6.59-2.58-2.57-1.42 1.41 4 3.99z" />
                                </svg>
                                <div style={{ fontWeight: 700, color: "var(--driver-text)", fontSize: "1rem" }}>لم تقبل أي طلب بعد</div>
                                <div style={{ fontSize: "0.88rem", color: "var(--driver-text-muted)", marginTop: "6px" }}>اقبل طلباً من تبويب الطلبات المتاحة</div>
                            </div>
                        ) : (
                            acceptedOrders.map((order) => (
                                <div key={order.id} className="accepted-card">
                                    {/** طلب مكالمة: نُظهر مسار مخصص مختصر */}
                                    {(() => {
                                        const isCallOrder =
                                            Boolean(order.notes?.includes("تواصل")) ||
                                            Boolean(order.items?.some((item) => String(item?.name || "").includes("مكالمة")));
                                        const showCallActions = Boolean(callActionsReady[order.id]);
                                        const isCallExpanded = Boolean(callDetailsExpanded[order.id]);

                                        return (
                                            <>
                                    {/* Card Header */}
                                    <div style={{
                                        background: "var(--driver-primary)",
                                        padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center",
                                    }}>
                                        <span style={{ color: "white", fontWeight: 700, fontSize: "1rem", fontFamily: "'Outfit', sans-serif" }}>#{order.orderNumber}</span>
                                        <span style={{ background: "rgba(255,255,255,0.2)", color: "white", borderRadius: "6px", padding: "3px 10px", fontSize: "0.8rem", fontWeight: 700 }}>{order.status === "on_the_way" ? "في الطريق" : "مقبول"}</span>
                                    </div>

                                    <div style={{ padding: "16px" }}>
                                        {/* Customer info */}
                                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                                            <div style={{
                                                width: 40, height: 40, borderRadius: "8px",
                                                background: "var(--driver-bg)",
                                                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                                            }}>
                                                <svg viewBox="0 0 24 24" width="20" height="20" fill="var(--driver-primary)">
                                                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                                </svg>
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "2px" }}>
                                                    <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--driver-text)" }}>{order.customerName}</span>
                                                    {order.customerStatus === "verified" && (
                                                        <span
                                                            title="موثّق"
                                                            style={{
                                                                display: "inline-flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                width: "16px",
                                                                height: "16px",
                                                                borderRadius: "50%",
                                                                background: "#059669",
                                                                color: "white",
                                                                fontSize: "10px",
                                                                fontWeight: 900,
                                                                lineHeight: 1,
                                                                flexShrink: 0,
                                                            }}
                                                            aria-label="موثّق"
                                                        >
                                                            ✓
                                                        </span>
                                                    )}
                                                    {order.customerStatus === "flagged" && (
                                                        <span
                                                            style={{
                                                                fontSize: "0.62rem",
                                                                fontWeight: 800,
                                                                padding: "1px 5px",
                                                                borderRadius: "4px",
                                                                background: "#fff7ed",
                                                                color: "#c2410c",
                                                                border: "1px solid #fed7aa",
                                                                flexShrink: 0,
                                                            }}
                                                        >
                                                            مبلّغ
                                                        </span>
                                                    )}
                                                    {!order.customerStatus && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setVerifyModalOrder(order);
                                                                setVerifyModalCalled(false);
                                                            }}
                                                            style={{
                                                                fontSize: "0.62rem",
                                                                fontWeight: 800,
                                                                padding: "2px 6px",
                                                                borderRadius: "4px",
                                                                background: "#fef2f2",
                                                                color: "#dc2626",
                                                                border: "1px solid #fecaca",
                                                                cursor: "pointer",
                                                                lineHeight: 1.25,
                                                                fontFamily: "inherit",
                                                            }}
                                                        >
                                                            غير موثق
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <a
                                                href={`tel:${order.customerPhone}`}
                                                style={{
                                                    marginInlineStart: "auto",
                                                    width: "40px",
                                                    height: "40px",
                                                    borderRadius: "10px",
                                                    background: "#16a34a",
                                                    color: "white",
                                                    textDecoration: "none",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    boxShadow: "0 6px 14px rgba(22, 163, 74, 0.28)",
                                                    flexShrink: 0,
                                                }}
                                                aria-label="اتصال بالزبون"
                                                title="اتصال بالزبون"
                                            >
                                                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                                                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                                                </svg>
                                            </a>
                                        </div>

                                        {/* Address & map */}
                                        <div style={{ background: "var(--driver-bg)", borderRadius: "8px", padding: "12px", marginBottom: "12px", border: "1px solid var(--driver-border)" }}>
                                            <div style={{ display: "flex", gap: "10px", alignItems: "stretch" }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: "0.78rem", color: "var(--driver-text-muted)", fontWeight: 700, marginBottom: "6px", display: "flex", alignItems: "center", gap: "4px" }}><svg viewBox="0 0 24 24" width="14" height="14" fill="var(--driver-text-muted)"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg> عنوان التوصيل</div>
                                                    <div style={{ fontWeight: 600, color: "var(--driver-text)", fontSize: "0.9rem", lineHeight: "1.5", textAlign: "right" }}>
                                                        {order.customerAddress}
                                                    </div>
                                                    {order.locationDesc && (
                                                        <div style={{ fontSize: "0.9rem", color: "var(--driver-text-muted)", marginTop: "6px", fontWeight: 600 }}>{order.locationDesc}</div>
                                                    )}
                                                </div>
                                                {order.locationCoords && (
                                                    <a
                                                        href={`https://www.google.com/maps?q=${order.locationCoords.lat},${order.locationCoords.lng}`}
                                                        target="_blank" rel="noopener noreferrer"
                                                        style={{
                                                            width: "120px",
                                                            minWidth: "120px",
                                                            display: "flex",
                                                            flexDirection: "column",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            gap: "6px",
                                                            padding: "8px 10px",
                                                            background: "var(--driver-primary)",
                                                            color: "white",
                                                            borderRadius: "8px",
                                                            textDecoration: "none",
                                                            fontWeight: 700,
                                                            fontSize: "0.82rem",
                                                            textAlign: "center",
                                                        }}
                                                    >
                                                        <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
                                                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                                                        </svg>
                                                        فتح في الخريطة
                                                    </a>
                                                )}
                                            </div>
                                        </div>

                                        {/* Call-flow helper: show only for call-based orders */}
                                        {isCallOrder && !isCallExpanded && (
                                            <div style={{ marginBottom: "12px" }}>
                                                <a
                                                    href={`tel:${order.customerPhone}`}
                                                    onClick={() =>
                                                        setCallActionsReady((prev) => ({ ...prev, [order.id]: true }))
                                                    }
                                                    style={{
                                                        width: "100%",
                                                        padding: "12px",
                                                        borderRadius: "8px",
                                                        border: "none",
                                                        background: "var(--driver-primary-gradient)",
                                                        color: "white",
                                                        fontFamily: "inherit",
                                                        fontWeight: 800,
                                                        fontSize: "0.95rem",
                                                        textDecoration: "none",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        gap: "8px",
                                                        boxShadow: "0 4px 14px rgba(16,185,129,0.28)",
                                                    }}
                                                >
                                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                                                        <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                                                    </svg>
                                                    الاتصال بالزبون
                                                </a>
                                                <div style={{ marginTop: "6px", fontSize: "0.78rem", color: "#dc2626", fontWeight: 800 }}>
                                                    لا يجب التأخر في الاتصال
                                                </div>
                                            </div>
                                        )}

                                        {/* Items + Notes */}
                                        {(!isCallOrder || isCallExpanded) && (
                                            <>
                                                <div style={{ marginBottom: order.notes ? "12px" : 0 }}>
                                                    <div style={{ fontSize: "0.78rem", color: "var(--driver-text-muted)", fontWeight: 700, marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                        <span>الطلبات</span>
                                                        <span style={{ background: "var(--driver-bg)", color: "var(--driver-text-muted)", borderRadius: "6px", padding: "2px 8px", fontSize: "0.78rem" }}>{order.items?.length || 0} أصناف</span>
                                                    </div>
                                                    {order.items?.map((item, idx) => (
                                                        <div key={idx} style={{
                                                            display: "flex", justifyContent: "space-between", alignItems: "center",
                                                            padding: "8px 0", borderBottom: idx < (order.items.length - 1) ? "1px solid var(--driver-border)" : "none",
                                                            fontSize: "0.9rem", color: "var(--driver-text)", direction: "rtl", textAlign: "right",
                                                        }}>
                                                            <span style={{ fontWeight: 600 }}>{item.name}</span>
                                                            <span style={{ background: "rgba(30, 58, 95, 0.08)", color: "var(--driver-primary)", borderRadius: "6px", padding: "2px 8px", fontWeight: 700, fontSize: "0.82rem", flexShrink: 0 }}>× {item.quantity}</span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {order.notes && !isCallOrder && (
                                                    <div style={{ background: "#fefce8", borderRadius: "8px", padding: "10px 12px", fontSize: "0.88rem", color: "#854d0e", fontWeight: 600, border: "1px solid #fde68a", display: "flex", gap: "6px", alignItems: "flex-start" }}>
                                                        <svg viewBox="0 0 24 24" width="14" height="14" fill="#854d0e" style={{ flexShrink: 0, marginTop: 2 }}><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                                                        {order.notes}
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {/* ── Status Actions ── */}
                                        <div style={{ marginTop: "16px" }}>
                                            {isCallOrder ? (
                                                showCallActions ? (
                                                    isCallExpanded ? (
                                                        order.status === "accepted" ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setOnTheWayModalOrder(order);
                                                                    setOnTheWayPurchaseInput("");
                                                                }}
                                                                style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "none", background: "#2563eb", color: "white", fontFamily: "inherit", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                                                            >
                                                                <svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>
                                                                أنا في الطريق
                                                            </button>
                                                        ) : null
                                                    ) : (
                                                        <div style={{ display: "flex", gap: "8px" }}>
                                                            <button
                                                                onClick={() =>
                                                                    setCallDetailsExpanded((prev) => ({ ...prev, [order.id]: true }))
                                                                }
                                                                style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "none", background: "#2563eb", color: "white", fontFamily: "inherit", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer" }}
                                                            >
                                                                قبول الطلب
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setCancelModalOrder(order);
                                                                    setCancelReason(CANCEL_REASONS[0]);
                                                                }}
                                                                style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid rgba(220, 38, 38, 0.28)", background: "rgba(220, 38, 38, 0.10)", color: "#b91c1c", fontFamily: "inherit", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer" }}
                                                            >
                                                                إلغاء الطلب
                                                            </button>
                                                        </div>
                                                    )
                                                ) : null
                                            ) : order.status === "accepted" && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setOnTheWayModalOrder(order);
                                                        setOnTheWayPurchaseInput("");
                                                    }}
                                                    style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "none", background: "#2563eb", color: "white", fontFamily: "inherit", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                                                >
                                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>
                                                    أنا في الطريق
                                                </button>
                                            )}
                                            {order.status === "on_the_way" && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateStatus(order.id, "delivered")}
                                                    style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "none", background: "#059669", color: "white", fontFamily: "inherit", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                                                >
                                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                                                    تم التوصيل بنجاح
                                                </button>
                                            )}
                                        </div>

                                        {(order.status === "on_the_way" || order.status === "delivered") &&
                                            typeof order.itemsPurchaseSyp === "number" && (
                                                <div
                                                    style={{
                                                        marginTop: "12px",
                                                        padding: "12px 14px",
                                                        borderRadius: "10px",
                                                        border: "1px solid var(--driver-border)",
                                                        background: "var(--driver-bg)",
                                                    }}
                                                >
                                                    <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--driver-text-muted)", marginBottom: "8px" }}>تفاصيل السعر للزبون</div>
                                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem", fontWeight: 700, color: "var(--driver-text)", marginBottom: "4px" }}>
                                                        <span>مشتريات الطلب</span>
                                                        <span style={{ fontVariantNumeric: "tabular-nums" }}>{order.itemsPurchaseSyp} ل.س</span>
                                                    </div>
                                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem", fontWeight: 700, color: "var(--driver-text)", marginBottom: "8px" }}>
                                                        <span>رسوم التوصيل</span>
                                                        <span style={{ fontVariantNumeric: "tabular-nums" }}>{getDeliveryFeeForOrder(order)} ل.س</span>
                                                    </div>
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            justifyContent: "space-between",
                                                            alignItems: "center",
                                                            paddingTop: "8px",
                                                            borderTop: "1px dashed var(--driver-border)",
                                                            fontSize: "0.95rem",
                                                            fontWeight: 900,
                                                            color: "var(--driver-primary)",
                                                        }}
                                                    >
                                                        <span>الإجمالي</span>
                                                        <span style={{ fontVariantNumeric: "tabular-nums" }}>
                                                            {typeof order.totalDueSyp === "number"
                                                                ? order.totalDueSyp
                                                                : order.itemsPurchaseSyp + getDeliveryFeeForOrder(order)}{" "}
                                                            ل.س
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                    </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            ))
                        )}
                    </>
                )}
            </main>

            <OrderModal
                order={selectedOrder}
                onClose={() => !isAccepting && setSelectedOrder(null)}
                onAccept={handleAcceptOrder}
                isAccepting={isAccepting}
                walletBalanceSyp={walletBalanceSyp}
                activeIncompleteCount={acceptedOrders.length}
            />

            {onTheWayModalOrder && (
                    <div
                        className="modal-overlay"
                        onClick={() => {
                            if (onTheWaySaving) return;
                            setOnTheWayModalOrder(null);
                            setOnTheWayPurchaseInput("");
                        }}
                    >
                        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "420px" }}>
                            <div className="modal-header">
                                <div className="modal-title">تأكيد «في الطريق»</div>
                                <button
                                    type="button"
                                    className="close-btn"
                                    disabled={onTheWaySaving}
                                    onClick={() => {
                                        setOnTheWayModalOrder(null);
                                        setOnTheWayPurchaseInput("");
                                    }}
                                >
                                    <svg viewBox="0 0 24 24" width="22" height="22" fill="#64748b">
                                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                    </svg>
                                </button>
                            </div>
                            <p style={{ fontSize: "0.88rem", color: "var(--driver-text-muted)", lineHeight: 1.65, marginBottom: "12px", fontWeight: 600 }}>
                                أدخل المبلغ الذي دفعته لشراء محتوى الطلب فقط{" "}
                                <strong style={{ color: "var(--driver-text)" }}>دون احتساب رسوم التوصيل</strong>. سيظهر للزبون الإجمالي مع التوصيل.
                            </p>
                            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 800, color: "var(--driver-text-muted)", marginBottom: "6px" }}>
                                مبلغ المشتريات (ل.س جديدة)
                            </label>
                            <input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                step="any"
                                autoFocus
                                value={onTheWayPurchaseInput}
                                onChange={(e) => setOnTheWayPurchaseInput(e.target.value)}
                                placeholder="0"
                                disabled={onTheWaySaving}
                                style={{
                                    width: "100%",
                                    padding: "12px 14px",
                                    borderRadius: "10px",
                                    border: "1px solid var(--driver-border)",
                                    fontSize: "1.1rem",
                                    fontWeight: 800,
                                    fontVariantNumeric: "tabular-nums",
                                    marginBottom: "12px",
                                    fontFamily: "inherit",
                                    boxSizing: "border-box",
                                }}
                            />
                            <div
                                style={{
                                    padding: "12px 14px",
                                    borderRadius: "10px",
                                    background: "var(--driver-bg)",
                                    border: "1px solid var(--driver-border)",
                                    marginBottom: "14px",
                                }}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.86rem", fontWeight: 700, marginBottom: "6px" }}>
                                    <span style={{ color: "var(--driver-text-muted)" }}>رسوم التوصيل (ثابتة)</span>
                                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{onTheWayFeePreview} ل.س</span>
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        fontSize: "1rem",
                                        fontWeight: 900,
                                        color: "var(--driver-primary)",
                                        paddingTop: "8px",
                                        borderTop: "1px dashed var(--driver-border)",
                                    }}
                                >
                                    <span>يُعرض للزبون — الإجمالي</span>
                                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{onTheWayTotalPreview} ل.س</span>
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: "8px" }}>
                                <button
                                    type="button"
                                    disabled={onTheWaySaving}
                                    onClick={() => {
                                        setOnTheWayModalOrder(null);
                                        setOnTheWayPurchaseInput("");
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: "12px",
                                        borderRadius: "10px",
                                        border: "1px solid var(--driver-border)",
                                        background: "var(--surface)",
                                        fontFamily: "inherit",
                                        fontWeight: 800,
                                        cursor: onTheWaySaving ? "wait" : "pointer",
                                    }}
                                >
                                    إلغاء
                                </button>
                                <button
                                    type="button"
                                    disabled={onTheWaySaving}
                                    onClick={submitOnTheWayPricing}
                                    style={{
                                        flex: 1,
                                        padding: "12px",
                                        borderRadius: "10px",
                                        border: "none",
                                        background: "#2563eb",
                                        color: "white",
                                        fontFamily: "inherit",
                                        fontWeight: 800,
                                        cursor: onTheWaySaving ? "wait" : "pointer",
                                        opacity: onTheWaySaving ? 0.85 : 1,
                                    }}
                                >
                                    {onTheWaySaving ? "جاري الحفظ..." : "تأكيد"}
                                </button>
                            </div>
                        </div>
                    </div>
            )}

            {verifyModalOrder && (
                <div
                    className="modal-overlay"
                    onClick={() => {
                        setVerifyModalOrder(null);
                        setVerifyModalCalled(false);
                    }}
                >
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "400px" }}>
                        <div className="modal-header">
                            <div className="modal-title">توثيق الزبون</div>
                            <button
                                type="button"
                                className="close-btn"
                                onClick={() => {
                                    setVerifyModalOrder(null);
                                    setVerifyModalCalled(false);
                                }}
                            >
                                <svg viewBox="0 0 24 24" width="22" height="22" fill="#64748b">
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                </svg>
                            </button>
                        </div>

                        {!verifyModalCalled ? (
                            <>
                                <p style={{ fontSize: "0.88rem", color: "var(--driver-text-muted)", lineHeight: 1.65, marginBottom: "14px", fontWeight: 600 }}>
                                    اضغط للاتصال بالزبون، ثم أكمل التوثيق في الخطوة التالية.
                                </p>
                                <a
                                    href={`tel:${verifyModalOrder.customerPhone}`}
                                    onClick={() => setVerifyModalCalled(true)}
                                    style={{
                                        width: "100%",
                                        padding: "12px 14px",
                                        borderRadius: "10px",
                                        border: "none",
                                        background: "#16a34a",
                                        color: "white",
                                        fontFamily: "inherit",
                                        fontWeight: 800,
                                        fontSize: "0.95rem",
                                        textDecoration: "none",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "8px",
                                        boxShadow: "0 6px 14px rgba(22, 163, 74, 0.28)",
                                    }}
                                >
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
                                        <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                                    </svg>
                                    الاتصال بالزبون
                                </a>
                                <button
                                    type="button"
                                    onClick={() => setVerifyModalCalled(true)}
                                    style={{
                                        width: "100%",
                                        marginTop: "10px",
                                        padding: "8px",
                                        border: "none",
                                        background: "transparent",
                                        color: "var(--driver-primary)",
                                        fontWeight: 800,
                                        fontSize: "0.8rem",
                                        cursor: "pointer",
                                        fontFamily: "inherit",
                                        textDecoration: "underline",
                                    }}
                                >
                                    أكملت الاتصال — متابعة التوثيق
                                </button>
                            </>
                        ) : (
                            <>
                                <p style={{ fontSize: "0.86rem", color: "var(--driver-text-muted)", lineHeight: 1.6, marginBottom: "12px", fontWeight: 600 }}>
                                    بعد التواصل، اختر الإجراء المناسب:
                                </p>
                                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            gap: "10px",
                                            padding: "10px 12px",
                                            borderRadius: "10px",
                                            border: "1px solid var(--driver-border)",
                                            background: "var(--driver-bg)",
                                        }}
                                    >
                                        <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "var(--driver-text)" }}>حقيقي</span>
                                        <button
                                            type="button"
                                            onClick={() => handleVerifyCustomer(verifyModalOrder, "verified")}
                                            style={{
                                                padding: "8px 18px",
                                                borderRadius: "8px",
                                                border: "none",
                                                background: "#059669",
                                                color: "white",
                                                fontFamily: "inherit",
                                                fontWeight: 800,
                                                fontSize: "0.82rem",
                                                cursor: "pointer",
                                                flexShrink: 0,
                                            }}
                                        >
                                            تأكيد
                                        </button>
                                    </div>
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            gap: "10px",
                                            padding: "10px 12px",
                                            borderRadius: "10px",
                                            border: "1px solid rgba(220, 38, 38, 0.35)",
                                            background: "rgba(254, 242, 242, 0.6)",
                                        }}
                                    >
                                        <span style={{ fontWeight: 800, fontSize: "0.88rem", color: "#b91c1c", lineHeight: 1.45 }}>
                                            الرقم غير موجود بالخدمة
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleVerifyReport(verifyModalOrder, "number_not_in_service")}
                                            style={{
                                                padding: "8px 18px",
                                                borderRadius: "8px",
                                                border: "1.5px solid #dc2626",
                                                background: "white",
                                                color: "#dc2626",
                                                fontFamily: "inherit",
                                                fontWeight: 800,
                                                fontSize: "0.82rem",
                                                cursor: "pointer",
                                                flexShrink: 0,
                                            }}
                                        >
                                            تأكيد
                                        </button>
                                    </div>
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            gap: "10px",
                                            padding: "10px 12px",
                                            borderRadius: "10px",
                                            border: "1px solid rgba(245, 158, 11, 0.35)",
                                            background: "rgba(255, 251, 235, 0.7)",
                                        }}
                                    >
                                        <span style={{ fontWeight: 800, fontSize: "0.88rem", color: "#a16207", lineHeight: 1.45 }}>
                                            لم يرد أحد على المكالمة
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleVerifyReport(verifyModalOrder, "no_answer_on_call")}
                                            style={{
                                                padding: "8px 18px",
                                                borderRadius: "8px",
                                                border: "1.5px solid #d97706",
                                                background: "white",
                                                color: "#b45309",
                                                fontFamily: "inherit",
                                                fontWeight: 800,
                                                fontSize: "0.82rem",
                                                cursor: "pointer",
                                                flexShrink: 0,
                                            }}
                                        >
                                            تأكيد
                                        </button>
                                    </div>
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            gap: "10px",
                                            padding: "10px 12px",
                                            borderRadius: "10px",
                                            border: "1px solid rgba(37, 99, 235, 0.35)",
                                            background: "rgba(239, 246, 255, 0.75)",
                                        }}
                                    >
                                        <span style={{ fontWeight: 800, fontSize: "0.88rem", color: "#1d4ed8", lineHeight: 1.45 }}>
                                            لا يمكنني الاتصال حالياً للتأكيد
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleVerifyReport(verifyModalOrder, "continue_on_driver_risk")}
                                            style={{
                                                padding: "8px 14px",
                                                borderRadius: "8px",
                                                border: "1.5px solid #2563eb",
                                                background: "white",
                                                color: "#1d4ed8",
                                                fontFamily: "inherit",
                                                fontWeight: 800,
                                                fontSize: "0.8rem",
                                                cursor: "pointer",
                                                flexShrink: 0,
                                            }}
                                        >
                                            متابعة على مسؤوليتي
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {cancelModalOrder && (
                <div className="modal-overlay" onClick={() => setCancelModalOrder(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "420px" }}>
                        <div className="modal-header">
                            <div className="modal-title">لماذا الإلغاء؟</div>
                            <button className="close-btn" onClick={() => setCancelModalOrder(null)}>
                                <svg viewBox="0 0 24 24" width="22" height="22" fill="#64748b">
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                </svg>
                            </button>
                        </div>

                        <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
                            {CANCEL_REASONS.map((reason) => (
                                <label
                                    key={reason}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "10px",
                                        padding: "10px 12px",
                                        borderRadius: "10px",
                                        border: "1px solid var(--driver-border)",
                                        background: cancelReason === reason ? "rgba(30, 58, 95, 0.06)" : "var(--surface)",
                                        cursor: "pointer",
                                        fontWeight: 600,
                                        color: "var(--driver-text)",
                                    }}
                                >
                                    <input
                                        type="radio"
                                        name="cancel-reason"
                                        checked={cancelReason === reason}
                                        onChange={() => setCancelReason(reason)}
                                    />
                                    <span>{reason}</span>
                                </label>
                            ))}
                        </div>

                        <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                            <button
                                onClick={() => setCancelModalOrder(null)}
                                style={{ flex: 1, padding: "11px", borderRadius: "8px", border: "1px solid var(--driver-border)", background: "var(--surface)", color: "var(--driver-text)", fontFamily: "inherit", fontWeight: 700, cursor: "pointer" }}
                            >
                                رجوع
                            </button>
                            <button
                                onClick={handleCancelOrder}
                                style={{ flex: 1, padding: "11px", borderRadius: "8px", border: "none", background: "#dc2626", color: "white", fontFamily: "inherit", fontWeight: 700, cursor: "pointer" }}
                            >
                                تأكيد الإلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
