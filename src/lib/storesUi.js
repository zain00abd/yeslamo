/**
 * شريط التصنيفات في صفحة المتاجر (تطبيق الزبائن).
 * كل عنصر يربط واجهة المستخدم بـ categoryId المخزّن في Firestore.
 */
export const STORE_FILTER_CHIPS = [
    {
        id: "all",
        label: "الكل",
        /** @type {string[] | null} */
        categoryIds: null,
    },
    {
        id: "restaurant",
        label: "مطاعم",
        categoryIds: ["restaurant", "cafe"],
    },
    {
        id: "supermarket",
        label: "سوبرماركت",
        categoryIds: ["supermarket", "groceries"],
    },
    {
        id: "bakery",
        label: "مخابز",
        categoryIds: ["bakery"],
    },
    {
        id: "pastry",
        label: "معجنات",
        categoryIds: ["sweets"],
    },
    {
        id: "meat",
        label: "لحوم",
        categoryIds: ["meat_fish"],
    },
    {
        id: "veg",
        label: "خضراوات",
        categoryIds: ["fruits_veg"],
    },
];

/** @param {{ categoryId?: string }} store */
/** @param {string} filterId */
export function storeMatchesCategoryFilter(store, filterId) {
    if (filterId === "all") return true;
    const chip = STORE_FILTER_CHIPS.find((c) => c.id === filterId);
    if (!chip || !chip.categoryIds || chip.categoryIds.length === 0) return true;
    const cid = typeof store.categoryId === "string" ? store.categoryId : "";
    return chip.categoryIds.includes(cid);
}

/**
 * بحث بسيط في الحقول النصية (عربي بدون تحويل حالة فعّال).
 * @param {string} q
 * @param {string[]} fields
 */
export function storeMatchesSearch(q, fields) {
    const needle = q.replace(/\s+/g, " ").trim();
    if (!needle) return true;
    const hay = fields
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    return hay.includes(needle.toLowerCase());
}
