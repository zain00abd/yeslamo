import { adminDb } from "@/lib/firebase-admin";

/** 8 أرقام — للاستعلام وشحن الرصيد */
const DIGITS = 8;

/**
 * يولّد رقم حساب فريداً لمندوب (يُخزَّن في users.driverAccountNumber).
 * @returns {Promise<string>}
 */
export async function allocateDriverAccountNumber() {
    for (let attempt = 0; attempt < 30; attempt++) {
        const n = String(10 ** (DIGITS - 1) + Math.floor(Math.random() * 9 * 10 ** (DIGITS - 1)));
        const dup = await adminDb.collection("users").where("driverAccountNumber", "==", n).limit(1).get();
        if (dup.empty) return n;
    }
    throw new Error("ACCOUNT_NUMBER_ALLOC_FAILED");
}
