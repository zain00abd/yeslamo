"use client";

import { usePathname } from "next/navigation";
import AdminShell from "./AdminShell";

export default function DashboardRoot({ children }) {
    const path = usePathname();
    if (path === "/dashboard/login" || path?.startsWith("/dashboard/login/")) {
        return <div className="admin-root">{children}</div>;
    }
    return (
        <div className="admin-root">
            <AdminShell>{children}</AdminShell>
        </div>
    );
}
