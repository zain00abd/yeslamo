/**
 * فئات المتاجر — قيمة `id` تُخزَّن في Firestore؛ `label` للعرض.
 * أضف فئات جديدة هنا فقط ثم تظهر تلقائياً في الفورم.
 */
export const STORE_CATEGORY_OPTIONS = [
    { id: "pharmacy", label: "صيدليات" },
    { id: "restaurant", label: "مطاعم" },
    { id: "sweets", label: "حلويات" },
    { id: "bookstore", label: "مكتبات" },
    { id: "bakery", label: "أفران ومخابز" },
    { id: "supermarket", label: "سوبرماركت" },
    { id: "cafe", label: "كافيهات" },
    { id: "beverages", label: "مشروبات وعصائر" },
    { id: "groceries", label: "بقالة عامة" },
    { id: "fruits_veg", label: "خضار وفواكه" },
    { id: "meat_fish", label: "لحوم وأسماك" },
    { id: "other", label: "أخرى" },
];

const byId = new Map(STORE_CATEGORY_OPTIONS.map((o) => [o.id, o]));

/** @param {string} id */
export function getStoreCategoryLabel(id) {
    return byId.get(id)?.label ?? "";
}

/** @param {string} id */
export function isValidStoreCategoryId(id) {
    return typeof id === "string" && byId.has(id);
}
