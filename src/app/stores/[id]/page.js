"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

function StoreDetailHeader() {
    return (
        <header className="stores-v2-header">
            <div className="stores-v2-header-row">
                <Link href="/stores" className="stores-v2-back" aria-label="المتاجر">
                    <svg className="stores-v2-back-ico" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75">
                        <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </Link>
                <div className="stores-v2-heading">
                    <h1 className="stores-v2-title" style={{ fontSize: "1.05rem" }}>
                        تفاصيل المتجر
                    </h1>
                </div>
                <span style={{ width: 44 }} aria-hidden />
            </div>
        </header>
    );
}

/** هيكل تحميل يطابق الصفحة النهائية (عرض كامل + هيرو + بطاقة) */
function StoreDetailLoadingShell() {
    return (
        <>
            <div className="stores-detail-v2-hero stores-v2-skeleton-hero" aria-hidden />
            <div className="stores-detail-v2-body">
                <div className="stores-v2-skeleton-card stores-detail-v2-skeleton-card" />
            </div>
        </>
    );
}

export default function StoreDetailPage() {
    const router = useRouter();
    const params = useParams();
    const id = typeof params?.id === "string" ? params.id : "";
    const [loaded, setLoaded] = useState(false);
    const [store, setStore] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        try {
            const userData = localStorage.getItem("yaslamo_user");
            if (!userData) {
                router.replace("/login");
                return;
            }
            JSON.parse(userData);
            queueMicrotask(() => setLoaded(true));
        } catch {
            router.replace("/login");
        }
    }, [router]);

    useEffect(() => {
        if (!loaded || !id) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError("");
            try {
                const res = await fetch(`/api/stores/${encodeURIComponent(id)}`);
                const j = await res.json();
                if (cancelled) return;
                if (!res.ok) {
                    setError(j.error || "تعذر التحميل");
                    setStore(null);
                    return;
                }
                setStore(j.store);
            } catch {
                if (!cancelled) setError("تعذر الاتصال");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [loaded, id]);

    useEffect(() => {
        if (store?.name) document.title = `${store.name} | يسلمو`;
    }, [store]);

    if (!loaded) {
        return (
            <div className="page-wrapper stores-detail-v2 has-bottom-nav">
                <StoreDetailHeader />
                <main className="stores-v2-main stores-detail-v2-main">
                    <div className="stores-detail-v2-loading-root" aria-busy="true" aria-label="جاري تجهيز الصفحة">
                        <StoreDetailLoadingShell />
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="page-wrapper stores-detail-v2 has-bottom-nav">
            <StoreDetailHeader />

            {loading ? (
                <main className="stores-v2-main stores-detail-v2-main">
                    <div className="stores-detail-v2-loading-root" aria-busy="true" aria-label="جاري التحميل">
                        <StoreDetailLoadingShell />
                    </div>
                </main>
            ) : error || !store ? (
                <main className="stores-v2-main stores-detail-v2-main">
                    <div className="stores-v2-inner">
                        <div className="stores-v2-state stores-v2-state--error" role="alert">
                            <p className="stores-v2-state-title">{error || "غير موجود"}</p>
                            <Link href="/stores" className="stores-v2-cta-secondary" style={{ marginTop: 16 }}>
                                العودة للمتاجر
                            </Link>
                        </div>
                    </div>
                </main>
            ) : (
                <>
                    <div className="stores-detail-v2-hero">
                        {store.imageUrl ? (
                            <img src={store.imageUrl} alt="" />
                        ) : (
                            <div style={{ width: "100%", height: "100%", background: "#e2e8f0" }} />
                        )}
                    </div>
                    <div className="stores-detail-v2-body">
                        <div className="stores-detail-v2-card">
                            <span
                                className={`stores-v2-badge${store.isOpenNow ? " stores-v2-badge--open" : " stores-v2-badge--closed"}`}
                                style={{ position: "static", display: "inline-block", marginBottom: 10 }}
                            >
                                {store.isOpenNow ? "مفتوح" : "مغلق"}
                            </span>
                            <h2 className="stores-detail-v2-name">{store.name}</h2>
                            {store.type ? <p style={{ margin: 0, fontWeight: 800, color: "#c2410c", fontSize: "0.88rem" }}>{store.type}</p> : null}
                            {store.city ? (
                                <p style={{ margin: "10px 0 0", color: "#64748b", fontWeight: 600, fontSize: "0.9rem" }}>{store.city}</p>
                            ) : null}
                            {store.description ? (
                                <p style={{ margin: "14px 0 0", lineHeight: 1.65, color: "#334155", fontSize: "0.92rem" }}>{store.description}</p>
                            ) : null}
                            {store.address ? (
                                <p style={{ margin: "12px 0 0", lineHeight: 1.55, color: "#64748b", fontSize: "0.85rem" }}>{store.address}</p>
                            ) : null}

                            <div className="stores-detail-v2-actions">
                                {store.phone ? (
                                    <a href={`tel:${store.phone.replace(/\s/g, "")}`} className="stores-detail-v2-btn stores-detail-v2-btn--primary">
                                        اتصال بالمتجر
                                    </a>
                                ) : null}
                                {store.locationCoords ? (
                                    <a
                                        href={`https://www.google.com/maps?q=${store.locationCoords.lat},${store.locationCoords.lng}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="stores-detail-v2-btn stores-detail-v2-btn--ghost"
                                    >
                                        فتح الموقع على الخريطة
                                    </a>
                                ) : null}
                                <Link href="/create-order" className="stores-detail-v2-btn stores-detail-v2-btn--ghost">
                                    إنشاء طلب توصيل
                                </Link>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
