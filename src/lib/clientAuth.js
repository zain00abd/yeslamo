import { auth } from "@/lib/firebase";

export async function getCurrentUserIdToken() {
    await auth.authStateReady();
    return auth.currentUser?.getIdToken() || null;
}

/**
 * يجلب التوكن، وإن لم تتوفر جلسة صالحة:
 * - يمسح بيانات المستخدم المحلية
 * - يحوّل مباشرة إلى صفحة تسجيل الدخول
 */
export async function getTokenOrRedirect(router) {
    const token = await getCurrentUserIdToken();
    if (token) return token;
    try {
        localStorage.removeItem("yaslamo_user");
        window.dispatchEvent(new Event("yaslamo_auth"));
    } catch {}
    router.replace("/login");
    return null;
}
