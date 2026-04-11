/** رسوم التوصيل الافتراضية (ل.س جديدة) — متّسقة بين إنشاء الطلب وعرض السعر للزبون والمندوب */
export const DEFAULT_DELIVERY_FEE_SYP = 120;

/** نسبة الخصم من رصيد المندوب عند قبول الطلب (من رسوم التوصيل فقط) */
export const DRIVER_DELIVERY_COMMISSION_RATE = 0.2;

/** أقصى طلبات «نشطة» (مقبول أو في الطريق) يُسمح بها قبل قبول طلب جديد */
export const DRIVER_MAX_ACTIVE_ORDERS_BEFORE_ACCEPT = 2;

export function getDeliveryFeeForOrder(order) {
    const n = order?.deliveryFeeSyp;
    if (typeof n === "number" && !Number.isNaN(n) && n >= 0) return n;
    return DEFAULT_DELIVERY_FEE_SYP;
}

/** المبلغ المخصوم من رصيد المندوب = 20% × رسوم التوصيل */
export function getAcceptCommissionSyp(order) {
    const fee = getDeliveryFeeForOrder(order);
    return Math.round(fee * DRIVER_DELIVERY_COMMISSION_RATE * 100) / 100;
}
