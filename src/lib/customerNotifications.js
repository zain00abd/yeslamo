"use client";

const EVENT_NAME = "yaslamo_notifications";

function getCurrentUid() {
    try {
        const raw = localStorage.getItem("yaslamo_user");
        if (!raw) return "guest";
        const u = JSON.parse(raw);
        return typeof u?.id === "string" && u.id ? u.id : "guest";
    } catch {
        return "guest";
    }
}

function keyFor(uid, suffix) {
    return `yaslamo_notifications:${uid}:${suffix}`;
}

function emitNotificationsChanged() {
    try {
        window.dispatchEvent(new Event(EVENT_NAME));
    } catch {}
}

function readJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

function writeJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {}
}

export function getCustomerNotifications() {
    if (typeof window === "undefined") return [];
    const uid = getCurrentUid();
    const list = readJson(keyFor(uid, "list"), []);
    return Array.isArray(list) ? list : [];
}

export function getUnreadNotificationsCount() {
    return getCustomerNotifications().filter((n) => !n.read).length;
}

export function markAllNotificationsRead() {
    if (typeof window === "undefined") return;
    const uid = getCurrentUid();
    const key = keyFor(uid, "list");
    const list = getCustomerNotifications().map((n) => ({ ...n, read: true }));
    writeJson(key, list);
    emitNotificationsChanged();
}

export function markNotificationRead(id) {
    if (typeof window === "undefined") return;
    const uid = getCurrentUid();
    const key = keyFor(uid, "list");
    const list = getCustomerNotifications().map((n) =>
        n.id === id ? { ...n, read: true } : n
    );
    writeJson(key, list);
    emitNotificationsChanged();
}

export function clearAllNotifications() {
    if (typeof window === "undefined") return;
    const uid = getCurrentUid();
    writeJson(keyFor(uid, "list"), []);
    emitNotificationsChanged();
}

export function pushCustomerNotification(notification) {
    if (typeof window === "undefined") return null;
    const uid = getCurrentUid();
    const key = keyFor(uid, "list");
    const list = getCustomerNotifications();
    const now = new Date().toISOString();
    const item = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        createdAt: now,
        read: false,
        ...notification,
    };
    const next = [item, ...list].slice(0, 200);
    writeJson(key, next);
    emitNotificationsChanged();
    return item;
}

function statusText(status) {
    if (status === "pending") return "تم استلام طلبك وهو الآن قيد الانتظار.";
    if (status === "accepted") return "تم قبول طلبك من المندوب.";
    if (status === "on_the_way") return "المندوب في طريقه إليك الآن.";
    if (status === "delivered") return "تم توصيل طلبك بنجاح.";
    if (status === "cancelled") return "تم إلغاء الطلب.";
    return "";
}

/**
 * يسجّل إشعاراً عند تغيّر حالة الطلب.
 * - لا يكرر الإشعار لنفس الطلب/الحالة
 */
export function syncOrderStatusNotification(order, options = {}) {
    if (typeof window === "undefined" || !order?.id || !order?.status) return;
    const uid = getCurrentUid();
    const cacheKey = keyFor(uid, "statusCache");
    const cache = readJson(cacheKey, {});
    const prev = cache[order.id] || null;
    const current = order.status;

    let shouldNotify = false;
    if (prev && prev !== current) {
        shouldNotify = true;
    } else if (!prev && options.notifyOnFirst === true && current !== "pending") {
        shouldNotify = true;
    }

    cache[order.id] = current;
    writeJson(cacheKey, cache);

    if (!shouldNotify) return;
    const text = statusText(current);
    if (!text) return;

    const list = getCustomerNotifications();
    const duplicate = list.find((n) => n.orderId === order.id && n.status === current);
    if (duplicate) return;

    pushCustomerNotification({
        kind: "order_status",
        title: "تحديث حالة الطلب",
        body: text,
        orderId: order.id,
        orderNumber: order.orderNumber || null,
        status: current,
    });
}

export function notifyOrderCreatedPending(order) {
    if (!order?.id) return;
    pushCustomerNotification({
        kind: "order_status",
        title: "تم إنشاء الطلب",
        body: "تم إنشاء طلبك بنجاح وهو الآن بانتظار قبول المندوب.",
        orderId: order.id,
        orderNumber: order.orderNumber || null,
        status: "pending",
    });
    syncOrderStatusNotification(order, { notifyOnFirst: false });
}

export function notificationsEventName() {
    return EVENT_NAME;
}
