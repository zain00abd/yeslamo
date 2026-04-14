"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getUnreadNotificationsCount, notificationsEventName } from "@/lib/customerNotifications";

function isHiddenRoute(pathname) {
    if (!pathname) return true;
    return (
        pathname.startsWith("/home") ||
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/driver") ||
        pathname.startsWith("/login") ||
        pathname.startsWith("/register") ||
        pathname.startsWith("/terms") ||
        pathname.startsWith("/privacy")
    );
}

export default function TopNotificationsButton() {
    const pathname = usePathname();
    const [user, setUser] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        const refresh = () => {
            try {
                const stored = localStorage.getItem("yaslamo_user");
                setUser(stored ? JSON.parse(stored) : null);
            } catch {
                setUser(null);
            }
            setUnreadCount(getUnreadNotificationsCount());
        };

        refresh();
        window.addEventListener("storage", refresh);
        window.addEventListener("yaslamo_auth", refresh);
        window.addEventListener(notificationsEventName(), refresh);
        return () => {
            window.removeEventListener("storage", refresh);
            window.removeEventListener("yaslamo_auth", refresh);
            window.removeEventListener(notificationsEventName(), refresh);
        };
    }, []);

    useEffect(() => {
        setUnreadCount(getUnreadNotificationsCount());
    }, [pathname]);

    if (!user || isHiddenRoute(pathname) || pathname.startsWith("/notifications")) return null;

    return (
        <div className="top-notifications">
            <div className="top-notifications__inner">
                <div className="top-notifications__title">مركز الإشعارات</div>
                <Link
                    href="/notifications"
                    aria-label="فتح الإشعارات"
                    className="top-notifications__btn"
                >
                    <svg viewBox="0 0 24 24" aria-hidden className="top-notifications__icon">
                        <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22z" />
                        <path d="M4 18h16l-1.6-2.4a4 4 0 0 1-.67-2.22V10a5.73 5.73 0 0 0-4.27-5.61V4a1.46 1.46 0 0 0-2.92 0v.39A5.73 5.73 0 0 0 6.27 10v3.38a4 4 0 0 1-.67 2.22L4 18Z" />
                    </svg>
                    إشعارات
                    {unreadCount > 0 ? (
                        <span className="top-notifications__badge">
                            {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                    ) : null}
                </Link>
            </div>
        </div>
    );
}
