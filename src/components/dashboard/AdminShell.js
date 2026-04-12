"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
    { href: "/dashboard", label: "الرئيسية" },
    { href: "/dashboard/orders", label: "الطلبات" },
    { href: "/dashboard/drivers", label: "المندوبون" },
    { href: "/dashboard/users", label: "المستخدمون" },
    { href: "/dashboard/stores", label: "المتاجر" },
    { href: "/dashboard/settings", label: "الإعدادات" },
];

export default function AdminShell({ children }) {
    const pathname = usePathname();
    const router = useRouter();

    async function logout() {
        await fetch("/api/admin/auth/logout", { method: "POST", credentials: "include" });
        router.push("/dashboard/login");
        router.refresh();
    }

    return (
        <div className="admin-shell">
            <aside className="admin-sidebar">
                <div className="admin-sidebar-brand">يسلمو — إدارة</div>
                <nav>
                    {NAV.map((item) => {
                        const active =
                            item.href === "/dashboard/drivers"
                                ? pathname === "/dashboard/drivers" || pathname?.startsWith("/dashboard/drivers/")
                                : pathname === item.href;
                        return (
                            <Link key={item.href} href={item.href} className={`admin-nav-link${active ? " active" : ""}`}>
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
                <div className="admin-sidebar-foot">
                    <button type="button" className="admin-btn secondary" style={{ width: "100%" }} onClick={logout}>
                        تسجيل الخروج
                    </button>
                    <Link
                        href="/"
                        style={{
                            display: "block",
                            textAlign: "center",
                            marginTop: "0.65rem",
                            fontSize: "0.82rem",
                            color: "#94a3b8",
                        }}
                    >
                        ← الموقع
                    </Link>
                </div>
            </aside>
            <main className="admin-main">{children}</main>
        </div>
    );
}
