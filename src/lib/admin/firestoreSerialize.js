/** @param {FirebaseFirestore.Timestamp | Date | null | undefined} v */
export function toIso(v) {
    if (!v) return null;
    if (typeof v.toDate === "function") return v.toDate().toISOString();
    if (v instanceof Date) return v.toISOString();
    return null;
}

/** @param {Record<string, unknown>} data */
export function serializeDoc(data) {
    const out = { ...data };
    if (out.createdAt) out.createdAt = toIso(/** @type {*} */ (out.createdAt));
    if (out.updatedAt) out.updatedAt = toIso(/** @type {*} */ (out.updatedAt));
    if (out.expiresAt) out.expiresAt = toIso(/** @type {*} */ (out.expiresAt));
    if (out.walletLastDeductionAt) out.walletLastDeductionAt = toIso(/** @type {*} */ (out.walletLastDeductionAt));
    return out;
}
