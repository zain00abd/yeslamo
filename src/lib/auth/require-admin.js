import { NextResponse } from "next/server";
import { verifyAdminSessionToken } from "./admin-session";

/**
 * @param {import("next/server").NextRequest} request
 * @returns {Promise<{ admin: { uid: string } } | { error: import("next/server").NextResponse }>}
 */
export async function requireAdmin(request) {
    const token = request.cookies.get("admin_session")?.value;
    if (!token) {
        return { error: NextResponse.json({ error: "غير مصرح" }, { status: 401 }) };
    }
    try {
        const { uid } = await verifyAdminSessionToken(token);
        return { admin: { uid } };
    } catch {
        return { error: NextResponse.json({ error: "جلسة غير صالحة" }, { status: 401 }) };
    }
}
