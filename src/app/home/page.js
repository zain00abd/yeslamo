"use client";

import { useState, useEffect, useRef, useLayoutEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

/** أيقونات خطّية بلون موحّد (currentColor) */
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

const STATUS_LABEL = {
    pending: "قيد الانتظار",
    accepted: "تم قبول الطلب",
    on_the_way: "في الطريق",
    delivered: "تم التوصيل",
    cancelled: "ملغى",
};

/** أصناف البقالة — أيقونات خطّية أوضح (Lucide ISC، لون واحد عبر currentColor) */
const GROCERY_CATEGORIES = [
    {
        label: "خضراوات",
        paths: (
            <>
                <path d="M2.27 21.7s9.87-3.5 12.73-6.36a4.5 4.5 0 0 0-6.36-6.37C5.77 11.84 2.27 21.7 2.27 21.7zM8.64 14l-2.05-2.04M15.34 15l-2.46-2.46" />
                <path d="M22 9s-1.33-2-3.5-2C16.86 7 15 9 15 9s1.33 2 3.5 2S22 9 22 9z" />
                <path d="M15 2s-2 1.33-2 3.5S15 9 15 9s2-1.84 2-3.5C17 3.33 15 2 15 2z" />
            </>
        ),
    },
    {
        label: "فواكه",
        paths: (
            <>
                <path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z" />
                <path d="M10 2c1 .5 2 2 2 5" />
            </>
        ),
    },
    {
        label: "لحوم",
        paths: (
            <>
                <circle cx="12.5" cy="8.5" r="2.5" />
                <path d="M12.5 2a6.5 6.5 0 0 0-6.22 4.6c-1.1 3.13-.78 3.9-3.18 6.08A3 3 0 0 0 5 18c4 0 8.4-1.8 11.4-4.3A6.5 6.5 0 0 0 12.5 2Z" />
                <path d="m18.5 6 2.19 4.5a6.48 6.48 0 0 1 .31 2 6.49 6.49 0 0 1-2.6 5.2C15.4 20.2 11 22 7 22a3 3 0 0 1-2.68-1.66L2.4 16.5" />
            </>
        ),
    },
    {
        label: "مخبوزات",
        paths: (
            <>
                <path d="m4.6 13.11 5.79-3.21c1.89-1.05 4.79 1.78 3.71 3.71l-3.22 5.81C8.8 23.16.79 15.23 4.6 13.11Z" />
                <path d="m10.5 9.5-1-2.29C9.2 6.48 8.8 6 8 6H4.5C2.79 6 2 6.5 2 8.5a7.71 7.71 0 0 0 2 4.83" />
                <path d="M8 6c0-1.55.24-4-2-4-2 0-2.5 2.17-2.5 4" />
                <path d="m14.5 13.5 2.29 1c.73.3 1.21.7 1.21 1.5v3.5c0 1.71-.5 2.5-2.5 2.5a7.71 7.71 0 0 1-4.83-2" />
                <path d="M18 16c1.55 0 4-.24 4 2 0 2-2.17 2.5-4 2.5" />
            </>
        ),
    },
    {
        label: "ألبان وبيض",
        paths: (
            <>
                <path d="M8 2h8" />
                <path d="M9 2v2.789a4 4 0 0 1-.672 2.219l-.656.984A4 4 0 0 0 7 10.212V20a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-9.789a4 4 0 0 0-.672-2.219l-.656-.984A4 4 0 0 1 15 4.788V2" />
                <path d="M7 15a6.472 6.472 0 0 1 5 0 6.47 6.47 0 0 0 5 0" />
            </>
        ),
    },
    {
        label: "مشروبات",
        paths: (
            <>
                <path d="m6 8 1.75 12.28a2 2 0 0 0 2 1.72h4.54a2 2 0 0 0 2-1.72L18 8" />
                <path d="M5 8h14" />
                <path d="M7 15a6.47 6.47 0 0 1 5 0 6.47 6.47 0 0 0 5 0" />
                <path d="m12 8 1-6h2" />
            </>
        ),
    },
    {
        label: "مجمدات",
        paths: (
            <>
                <line x1="2" x2="22" y1="12" y2="12" />
                <line x1="12" x2="12" y1="2" y2="22" />
                <path d="m20 16-4-4 4-4" />
                <path d="m4 8 4 4-4 4" />
                <path d="m16 4-4 4-4-4" />
                <path d="m8 20 4-4 4 4" />
            </>
        ),
    },
    {
        label: "حبوب ومعلبات",
        paths: (
            <>
                <path d="M2 22 16 8" />
                <path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
                <path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
                <path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
                <path d="M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z" />
                <path d="M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z" />
                <path d="M15.47 13.47 17 15l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z" />
                <path d="M19.47 9.47 21 11l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L13 11l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z" />
            </>
        ),
    },
    {
        label: "منظفات",
        paths: (
            <>
                <path d="M3 3h.01" />
                <path d="M7 5h.01" />
                <path d="M11 7h.01" />
                <path d="M3 7h.01" />
                <path d="M7 9h.01" />
                <path d="M3 11h.01" />
                <rect width="4" height="4" x="15" y="5" />
                <path d="m19 9 2 2v10c0 .6-.4 1-1 1h-6c-.6 0-1-.4-1-1V11l2-2" />
                <path d="m13 14 8-2" />
                <path d="m13 19 8-2" />
            </>
        ),
    },
    {
        label: "وجبات خفيفة",
        paths: (
            <>
                <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
                <path d="M8.5 8.5v.01" />
                <path d="M16 15.5v.01" />
                <path d="M12 12v.01" />
                <path d="M11 17v.01" />
                <path d="M7 14v.01" />
            </>
        ),
    },
    {
        label: "توابل وزيوت",
        paths: (
            <>
                <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" />
                <path d="M8.5 2h7" />
                <path d="M7 16h10" />
            </>
        ),
    },
    {
        label: "عناية منزلية",
        paths: (
            <>
                <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
                <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            </>
        ),
    },
];

function renderCategoryItems(keyPrefix) {
    return GROCERY_CATEGORIES.map((cat, i) => (
        <div className="home-v2-cat-item" key={`${keyPrefix}-${cat.label}-${i}`}>
            <div className="home-v2-cat-ico">
                <IconStroke className="home-v2-cat-svg">{cat.paths}</IconStroke>
            </div>
            <span className="home-v2-cat-label">{cat.label}</span>
        </div>
    ));
}

function HomeCategoryMarquee() {
    const stripRef = useRef(null);
    const seqRef = useRef(null);
    const [seqWidthPx, setSeqWidthPx] = useState(0);
    const [stripWidthPx, setStripWidthPx] = useState(0);

    useLayoutEffect(() => {
        const strip = stripRef.current;
        const seq = seqRef.current;
        if (!strip || !seq) return;

        function measure() {
            const sw = strip.clientWidth;
            const qw = seq.getBoundingClientRect().width;
            const rounded = Math.round(qw * 100) / 100;
            if (rounded > 0) setSeqWidthPx(rounded);
            if (sw > 0) setStripWidthPx(sw);
        }

        measure();
        if (typeof document !== "undefined" && document.fonts?.ready) {
            document.fonts.ready.then(measure);
        }
        const ro = new ResizeObserver(measure);
        ro.observe(strip);
        ro.observe(seq);
        return () => ro.disconnect();
    }, []);

    /** نسخ كافية لتغطية عرض الشريط (إن كان 2W أصغر من العرض يبقى فراغ على الجانب) */
    const copyCount = useMemo(() => {
        if (seqWidthPx <= 0 || stripWidthPx <= 0) return 2;
        const needed = Math.ceil(stripWidthPx / seqWidthPx);
        return Math.max(2, needed + 1);
    }, [seqWidthPx, stripWidthPx]);

    const trackStyle =
        seqWidthPx > 0
            ? { "--marquee-seq-w": `${seqWidthPx}px` }
            : undefined;

    return (
        <section className="home-v2-cat-wrap" aria-label="أصناف البقالة المتوفرة">
            <div ref={stripRef} className="home-v2-cat-strip" aria-hidden="true">
                <div
                    className={`home-v2-cat-track${seqWidthPx > 0 ? " home-v2-cat-track--ready" : ""}`}
                    style={trackStyle}
                >
                    {Array.from({ length: copyCount }, (_, i) => (
                        <div
                            key={i}
                            ref={i === 0 ? seqRef : undefined}
                            className="home-v2-cat-seq"
                            aria-hidden={i > 0 ? true : undefined}
                        >
                            {renderCategoryItems(`c${i}`)}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

/** بيانات موقع التوصيل من الحساب */
function parseDeliveryLocation(parsed) {
    const city = typeof parsed.city === "string" ? parsed.city.trim() : "";
    const detail = typeof parsed.locationDesc === "string" ? parsed.locationDesc.trim() : "";
    const fallback = typeof parsed.address === "string" ? parsed.address.trim() : "";
    const line2 = detail || fallback;
    if (!city && !line2) return null;
    return { city, detail: line2 };
}

function formatLocationLine(loc) {
    if (!loc) return "";
    if (loc.city && loc.detail && loc.detail !== loc.city) return `${loc.city} · ${loc.detail}`;
    return loc.city || loc.detail || "";
}

function formatRecentWhen(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 864e5);
    if (diffDays < 0) return d.toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
    if (diffDays === 0) return "اليوم";
    if (diffDays === 1) return "أمس";
    if (diffDays < 7) return `منذ ${diffDays} أيام`;
    return d.toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" });
}

export default function HomePage() {
    const [userName, setUserName] = useState("");
    const [userUid, setUserUid] = useState("");
    const [deliveryLocation, setDeliveryLocation] = useState(null);
    const [loaded, setLoaded] = useState(false);
    const [lastOrder, setLastOrder] = useState(null);
    const router = useRouter();

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
            const name =
                typeof parsed.name === "string"
                    ? parsed.name
                    : parsed.name != null
                      ? String(parsed.name)
                      : "";
            const uid = typeof parsed.id === "string" ? parsed.id : "";
            const loc = parseDeliveryLocation(parsed);
            queueMicrotask(() => {
                setUserName(name);
                setUserUid(uid);
                setDeliveryLocation(loc);
                setLoaded(true);
            });
        } catch (e) {
            router.replace("/login");
        }
    }, [router]);

    useEffect(() => {
        if (!loaded || !userUid) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`/api/orders/recent?uid=${encodeURIComponent(userUid)}`);
                const data = await res.json();
                if (!cancelled && data.order) setLastOrder(data.order);
            } catch {
                /* ignore */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [loaded, userUid]);

    if (!loaded) return null;

    function getGreeting() {
        const hour = new Date().getHours();
        if (hour < 12) return "صباح الخير";
        if (hour < 18) return "مساء الخير";
        return "مساء الخير";
    }

    return (
        <div className="page-wrapper home-page home-v2">
            <header className="home-v2-topbar">
                <div className="home-v2-topbar-row">
                    <div className="home-v2-user">
                        <div className="home-v2-avatar">
                            <IconStroke className="home-v2-avatar-svg">
                                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </IconStroke>
                        </div>
                        <div className="home-v2-user-text">
                            <span className="home-v2-greet">{getGreeting()}</span>
                            <span className="home-v2-name">{userName}</span>
                        </div>
                    </div>
                    <Link href="/" className="home-v2-brand">
                        <Image src="/logo3.png" alt="يسلمو" width={48} height={48} className="home-v2-logo" priority />
                    </Link>
                </div>
                {deliveryLocation ? (
                    <div className="home-v2-location" role="region" aria-label="موقع التوصيل">
                        <IconStroke className="home-v2-location-icon">
                            <path d="M12 22s7-4.5 7-10a7 7 0 10-14 0c0 5.5 7 10 7 10z" />
                            <path d="M12 13a3 3 0 100-6 3 3 0 000 6z" />
                        </IconStroke>
                        <span className="home-v2-location-text" title={formatLocationLine(deliveryLocation)}>
                            {formatLocationLine(deliveryLocation)}
                        </span>
                    </div>
                ) : null}
            </header>

            <main className="home-v2-main">
                <div className="home-v2-shell">
                    <HomeCategoryMarquee />

                    <section className="home-v2-hero" aria-labelledby="home-v2-title">
                        <div className="home-v2-hero-inner">
                            <p className="home-v2-eyebrow">توصيل من البقالة</p>
                            <h1 id="home-v2-title" className="home-v2-title">
                                طلبك يبدأ من هنا
                            </h1>
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <Link href="/create-order" className="home-v2-cta">
                                    <span className="home-v2-cta-inner">
                                        <IconStroke className="home-v2-cta-icon">
                                            <path d="M7 7h10l1 14H6L7 7Z" />
                                            <path d="M9 7V5a3 3 0 0 1 6 0v2" />
                                        </IconStroke>
                                        ابدأ الطلب
                                    </span>
                                    <IconStroke className="home-v2-cta-chevron">
                                        <path d="M15 18l-6-6 6-6" />
                                    </IconStroke>
                                </Link>

                                <div className="home-v2-cta-or" aria-hidden="true">
                                    أو
                                </div>

                                <div className="home-v2-call-note">
                                    اطلب أغراضك عبر مكالمة صوتية مع المندوب
                                </div>

                                <Link href="/create-order?mode=call" className="home-v2-cta home-v2-cta--secondary">
                                    <span className="home-v2-cta-inner">
                                        <IconStroke className="home-v2-cta-icon">
                                            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                                        </IconStroke>
                                        اتصل بالمندوب
                                    </span>
                                    <IconStroke className="home-v2-cta-chevron">
                                        <path d="M15 18l-6-6 6-6" />
                                    </IconStroke>
                                </Link>
                            </div>
                        </div>
                    </section>


                </div>
            </main>
        </div>
    );
}
