/** رسوم التوصيل الافتراضية (ل.س جديدة) — متّسقة بين إنشاء الطلب وعرض السعر للزبون والمندوب */
export const DEFAULT_DELIVERY_FEE_SYP = 120;

export function getDeliveryFeeForOrder(order) {
    const n = order?.deliveryFeeSyp;
    if (typeof n === "number" && !Number.isNaN(n) && n >= 0) return n;
    return DEFAULT_DELIVERY_FEE_SYP;
}
