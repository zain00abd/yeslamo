"use client";

import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";

/** يخفي شريط التنقل السفلي في لوحة الإدارة */
export default function ConditionalBottomNav() {
    const pathname = usePathname();
    if (pathname?.startsWith("/dashboard")) {
        return null;
    }
    return <BottomNav />;
}
