import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE = "admin_session";

function secretKey() {
    const s = process.env.ADMIN_SESSION_SECRET;
    if (!s || s.length < 16) return null;
    return new TextEncoder().encode(s);
}

export async function middleware(request) {
    const { pathname } = request.nextUrl;
    const isLoginPage = pathname === "/dashboard/login" || pathname.startsWith("/dashboard/login/");
    const isSessionApi = pathname === "/api/admin/auth/session";
    const key = secretKey();

    if (!key) {
        if (isLoginPage || isSessionApi) return NextResponse.next();
        if (pathname.startsWith("/api/admin")) {
            return NextResponse.json({ error: "إعدادات الخادم ناقصة (ADMIN_SESSION_SECRET)" }, { status: 503 });
        }
        return NextResponse.redirect(new URL("/dashboard/login", request.url));
    }

    if (isSessionApi) {
        return NextResponse.next();
    }

    const token = request.cookies.get(COOKIE)?.value;

    if (isLoginPage) {
        if (token && key) {
            try {
                const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
                if (payload.role === "admin") {
                    return NextResponse.redirect(new URL("/dashboard", request.url));
                }
            } catch {
                // invalid cookie — show login
            }
        }
        return NextResponse.next();
    }

    if (!token) {
        if (pathname.startsWith("/api/admin")) {
            return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
        }
        return NextResponse.redirect(new URL("/dashboard/login", request.url));
    }

    try {
        const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
        if (payload.role !== "admin") {
            if (pathname.startsWith("/api/admin")) {
                return NextResponse.json({ error: "ممنوع" }, { status: 403 });
            }
            return NextResponse.redirect(new URL("/", request.url));
        }
        return NextResponse.next();
    } catch {
        if (pathname.startsWith("/api/admin")) {
            return NextResponse.json({ error: "جلسة غير صالحة" }, { status: 401 });
        }
        return NextResponse.redirect(new URL("/dashboard/login", request.url));
    }
}

export const config = {
    matcher: ["/dashboard/:path*", "/api/admin/:path*"],
};
