"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { STORE_FILTER_CHIPS, storeMatchesCategoryFilter, storeMatchesSearch } from "@/lib/storesUi";

const STORES_COMING_SOON = true;

function IconStroke({ children, className = "" }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            width="1em"
            height="1em"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            {children}
        </svg>
    );
}

/** أيقونات تصنيف الشريط الأفقي */
function CategoryIcon({ id }) {
    const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.65, strokeLinecap: "round", strokeLinejoin: "round" };
    switch (id) {
        case "all":
            return (
                <svg {...common}>
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
            );
        case "restaurant":
            return (
                <svg {...common}>
                    <path d="M3 2v7c0 1.1.9 2 2 2h1v9" />
                    <path d="M9 2v20" />
                    <path d="M15 2v4h4a2 2 0 0 1 2 2v2c0 1.1-.9 2-2 2h-4v8" />
                </svg>
            );
        case "supermarket":
            return (
                <svg {...common}>
                    <circle cx="8" cy="21" r="1" />
                    <circle cx="19" cy="21" r="1" />
                    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
                </svg>
            );
        case "bakery":
            return (
                <svg {...common}>
                    <path d="M20 10c0-4.4-3.6-8-8-8s-8 3.6-8 8c0 .9.1 1.7.4 2.5L6 22h12l1.6-9.5c.3-.8.4-1.6.4-2.5z" />
                    <path d="M6 12h12" />
                </svg>
            );
        case "pastry":
            return (
                <svg {...common}>
                    <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
                    <path d="M4 16s.5-1 2-1 2.5 2 4 2 2-1 3-1 2.5 1 4 1 3-2 3-2" />
                    <path d="M2 21h20" />
                    <path d="M7 8v3" />
                    <path d="M12 8v3" />
                    <path d="M17 8v3" />
                    <path d="M7 4h0.01" />
                    <path d="M12 4h0.01" />
                    <path d="M17 4h0.01" />
                </svg>
            );
        case "meat":
            return (
                <svg {...common}>
                    <path d="M15.5 5.5a2.5 2.5 0 0 1 3 3L9 18l-4 1 1-4 11.5-9.5z" />
                    <path d="m9 14 6 6" />
                </svg>
            );
        case "veg":
            return (
                <svg {...common}>
                    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 3.5 4 4a10 10 0 0 1 .5 14c-2.2 2.2-5.3 2.7-8.4 2.2" />
                </svg>
            );
        default:
            return (
                <svg {...common}>
                    <circle cx="12" cy="12" r="10" />
                </svg>
            );
    }
}

function StoresSkeleton() {
    return (
        <div className="stores-v2-skeleton-wrap" aria-busy="true" aria-label="جاري التحميل">
            <div className="stores-v2-skeleton-row">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="stores-v2-skeleton-chip" />
                ))}
            </div>
            <div className="stores-v2-skeleton-featured">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="stores-v2-skeleton-featured-card" />
                ))}
            </div>
            <div className="stores-v2-skeleton-list">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="stores-v2-skeleton-card" />
                ))}
            </div>
        </div>
    );
}

/** وهم بحث أثناء التحقق من الجلسة — نفس أبعاد شريط البحث الحقيقي */
function StoresBootSearchPlaceholder() {
    return (
        <div className="stores-v2-boot-search" aria-hidden="true">
            <span className="stores-v2-boot-search-icon" />
            <div className="stores-v2-boot-search-bar" />
        </div>
    );
}

function StoresListHeader() {
    return (
        <header className="stores-v2-header">
            <div className="stores-v2-header-row">
                <Link href="/home" className="stores-v2-back" aria-label="الرئيسية">
                    <IconStroke className="stores-v2-back-ico">
                        <path d="M15 18l-6-6 6-6" />
                    </IconStroke>
                </Link>
                <div className="stores-v2-heading">
                    <h1 className="stores-v2-title">المتاجر</h1>
                    <p className="stores-v2-subtitle">تصفّح المتاجر والمطاعم القريبة منك</p>
                </div>
                <Link href="/home" className="stores-v2-logo-link">
                    <Image src="/logo3.png" alt="" width={44} height={44} className="stores-v2-logo" />
                </Link>
            </div>
        </header>
    );
}

function StoresPageLayout({ children }) {
    return (
        <div className="page-wrapper stores-v2 has-bottom-nav">
            <StoresListHeader />
            <main className="stores-v2-main">
                <div className="stores-v2-inner">
                    {children}
                </div>
            </main>
        </div>
    );
}

export default function StoresPage() {
    const router = useRouter();
    const [loaded, setLoaded] = useState(false);
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [activeFilter, setActiveFilter] = useState("all");

    const loadStores = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/stores");
            const j = await res.json();
            if (!res.ok) {
                setError(j.error || "تعذر التحميل");
                setStores([]);
                return;
            }
            setStores(j.stores || []);
        } catch {
            setError("تعذر الاتصال. تحقق من الشبكة وحاول مجدداً.");
            setStores([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        document.title = "المتاجر | يسلمو";
    }, []);

    useEffect(() => {
        try {
            const userData = localStorage.getItem("yaslamo_user");
            if (!userData) {
                router.replace("/login");
                return;
            }
            const parsed = JSON.parse(userData);
            if (parsed === null || typeof parsed !== "object") {
                router.replace("/login");
                return;
            }
            queueMicrotask(() => setLoaded(true));
        } catch {
            router.replace("/login");
        }
    }, [router]);

    useEffect(() => {
        if (!loaded) return;
        loadStores();
    }, [loaded, loadStores]);

    const filteredStores = useMemo(() => {
        return stores.filter(
            (s) =>
                storeMatchesCategoryFilter(s, activeFilter) &&
                storeMatchesSearch(search, [s.name, s.type, s.city, s.description, s.address]),
        );
    }, [stores, activeFilter, search]);

    const featuredStores = useMemo(() => {
        const marked = stores.filter((s) => s.featured);
        if (marked.length > 0) return marked.slice(0, 10);
        return stores.slice(0, Math.min(5, stores.length));
    }, [stores]);

    const showFeatured =
        !loading &&
        !error &&
        stores.length > 0 &&
        !search.trim() &&
        activeFilter === "all" &&
        featuredStores.length > 0;

    if (!loaded) {
        return (
            <StoresPageLayout>
                <div aria-busy="true" aria-label="جاري تجهيز الصفحة">
                    <StoresBootSearchPlaceholder />
                    <StoresSkeleton />
                </div>
            </StoresPageLayout>
        );
    }

    if (STORES_COMING_SOON) {
        return (
            <StoresPageLayout>
                <section className="stores-v2-state stores-v2-state--muted" role="status" aria-live="polite">
                    <Image
                        src="/logo1.jpg"
                        alt="يسلمو"
                        width={72}
                        height={72}
                        style={{ borderRadius: 18, margin: "0 auto 14px", display: "block" }}
                    />
                    <p className="stores-v2-state-title">قريبًا في يسلمو</p>
                    <p className="stores-v2-state-text">
                        نعمل الآن على إضافة المتاجر داخل التطبيق لتجربة أفضل. ترقبوا التحديث القادم.
                    </p>
                    <Link href="/home" className="stores-v2-cta-secondary">
                          العودة الى الصفحة الرئيسية 
                    </Link>
                </section>
            </StoresPageLayout>
        );
    }

    return (
        <StoresPageLayout>
            <label className="stores-v2-search-label" htmlFor="stores-search">
                        <span className="stores-v2-search-icon" aria-hidden>
                            <IconStroke>
                                <circle cx="11" cy="11" r="7" />
                                <path d="M21 21l-4.3-4.3" />
                            </IconStroke>
                        </span>
                        <input
                            id="stores-search"
                            type="search"
                            className="stores-v2-search"
                            placeholder="ابحث عن متجر أو مطعم"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoComplete="off"
                            dir="rtl"
                        />
            </label>

            <div className="stores-v2-chips-scroll" dir="rtl">
                        <div className="stores-v2-chips">
                            {STORE_FILTER_CHIPS.map((chip) => {
                                const active = activeFilter === chip.id;
                                return (
                                    <button
                                        key={chip.id}
                                        type="button"
                                        className={`stores-v2-chip${active ? " stores-v2-chip--active" : ""}`}
                                        onClick={() => setActiveFilter(chip.id)}
                                        aria-pressed={active}
                                    >
                                        <span className="stores-v2-chip-ico" aria-hidden>
                                            <CategoryIcon id={chip.id} />
                                        </span>
                                        <span className="stores-v2-chip-label">{chip.label}</span>
                                    </button>
                                );
                            })}
                </div>
            </div>

            {loading ? (
                <StoresSkeleton />
            ) : error ? (
                <div className="stores-v2-state stores-v2-state--error" role="alert">
                            <p className="stores-v2-state-title">حدث خطأ</p>
                            <p className="stores-v2-state-text">{error}</p>
                            <button type="button" className="stores-v2-retry" onClick={loadStores}>
                                إعادة المحاولة
                    </button>
                </div>
            ) : stores.length === 0 ? (
                <div className="stores-v2-state">
                            <p className="stores-v2-state-title">لا توجد متاجر بعد</p>
                            <p className="stores-v2-state-text">يمكنك طلب احتياجاتك من البقالة الآن.</p>
                            <Link href="/create-order" className="stores-v2-cta-secondary">
                                طلب من البقالة
                    </Link>
                </div>
            ) : (
                <>
                    {showFeatured ? (
                        <section className="stores-v2-section" aria-labelledby="stores-featured-heading">
                                    <h2 id="stores-featured-heading" className="stores-v2-section-title">
                                        متاجر مميزة
                                    </h2>
                                    <div className="stores-v2-featured-scroll" dir="rtl">
                                        <ul className="stores-v2-featured-track" role="list">
                                            {featuredStores.map((s) => (
                                                <li key={s.id} className="stores-v2-featured-card">
                                                    <Link href={`/stores/${s.id}`} className="stores-v2-featured-link">
                                                        <div className="stores-v2-featured-media">
                                                            {s.imageUrl ? (
                                                                <img src={s.imageUrl} alt="" className="stores-v2-featured-img" loading="lazy" />
                                                            ) : (
                                                                <div className="stores-v2-featured-placeholder">
                                                                    <CategoryIcon id="all" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span className="stores-v2-featured-name">{s.name}</span>
                                                        {s.type ? <span className="stores-v2-featured-type">{s.type}</span> : null}
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                            </div>
                        </section>
                    ) : null}

                    <section className="stores-v2-section" aria-labelledby="stores-all-heading">
                        <h2 id="stores-all-heading" className="stores-v2-section-title">
                            {search.trim() || activeFilter !== "all" ? "نتائج البحث" : "جميع المتاجر"}
                        </h2>

                        {filteredStores.length === 0 ? (
                            <div className="stores-v2-state stores-v2-state--muted">
                                        <p className="stores-v2-state-title">لا نتائج مطابقة</p>
                                        <p className="stores-v2-state-text">جرّب كلمات أخرى أو اختر «الكل» من التصنيفات.</p>
                                        <button
                                            type="button"
                                            className="stores-v2-linkish"
                                            onClick={() => {
                                                setSearch("");
                                                setActiveFilter("all");
                                            }}
                                        >
                                            مسح البحث والتصفية
                                </button>
                            </div>
                        ) : (
                            <ul className="stores-v2-grid" role="list">
                                {filteredStores.map((s) => (
                                    <li key={s.id} className="stores-v2-card">
                                        <div className="stores-v2-card-media">
                                                    {s.imageUrl ? (
                                                        <img src={s.imageUrl} alt="" className="stores-v2-card-img" loading="lazy" />
                                                    ) : (
                                                        <div className="stores-v2-card-placeholder">
                                                            <CategoryIcon id="supermarket" />
                                                        </div>
                                                    )}
                                                    <span
                                                        className={`stores-v2-badge${s.isOpenNow ? " stores-v2-badge--open" : " stores-v2-badge--closed"}`}
                                                    >
                                                        {s.isOpenNow ? "مفتوح" : "مغلق"}
                                                    </span>
                                                </div>
                                                <div className="stores-v2-card-body">
                                                    <h3 className="stores-v2-card-name">{s.name}</h3>
                                                    <div className="stores-v2-card-row">
                                                        {s.type ? <span className="stores-v2-card-type">{s.type}</span> : null}
                                                        {s.city ? (
                                                            <span className="stores-v2-card-area">
                                                                <IconStroke className="stores-v2-card-area-ico">
                                                                    <path d="M12 22s7-4.5 7-10a7 7 0 10-14 0c0 5.5 7 10 7 10z" />
                                                                    <path d="M12 13a3 3 0 100-6 3 3 0 000 6z" />
                                                                </IconStroke>
                                                                {s.city}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    {s.description ? <p className="stores-v2-card-desc">{s.description}</p> : null}
                                                    <Link href={`/stores/${s.id}`} className="stores-v2-card-btn">
                                                        عرض المتجر
                                                    </Link>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        </>
                    )}
        </StoresPageLayout>
    );
}
