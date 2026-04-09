import { auth } from "@/lib/firebase";

export async function getCurrentUserIdToken() {
    await auth.authStateReady();
    return auth.currentUser?.getIdToken() || null;
}
