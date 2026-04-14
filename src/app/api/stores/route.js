import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * قائمة المتاجر النشطة للتطبيق (زبائن) — بدون مصادقة.
 * يُرجع حقولاً عامة فقط.
 */
export async function GET() {
    try {
        const snap = await adminDb.collection("stores").limit(200).get();
        const stores = [];
        for (const docSnap of snap.docs) {
            const d = docSnap.data();
            if (d.isActive === false) continue;
            const coords = d.locationCoords;
            const locationCoords =
                coords &&
                typeof coords.lat === "number" &&
                typeof coords.lng === "number" &&
                Number.isFinite(coords.lat) &&
                Number.isFinite(coords.lng)
                    ? { lat: coords.lat, lng: coords.lng }
                    : null;

            const rawDesc =
                typeof d.shortDescription === "string" && d.shortDescription.trim()
                    ? d.shortDescription.trim()
                    : typeof d.locationDesc === "string"
                      ? d.locationDesc.trim()
                      : typeof d.address === "string"
                        ? d.address.trim()
                        : "";

            const description =
                rawDesc.length > 120 ? `${rawDesc.slice(0, 118).trim()}…` : rawDesc;

            stores.push({
                id: docSnap.id,
                name: typeof d.name === "string" ? d.name : "",
                type: typeof d.type === "string" ? d.type : "",
                categoryId: typeof d.categoryId === "string" ? d.categoryId : "",
                city: typeof d.city === "string" ? d.city : typeof d.area === "string" ? d.area : "",
                imageUrl: typeof d.imageUrl === "string" ? d.imageUrl : "",
                phone: typeof d.phone === "string" ? d.phone : "",
                address: typeof d.address === "string" ? d.address : "",
                locationDesc: typeof d.locationDesc === "string" ? d.locationDesc : "",
                description,
                locationCoords,
                featured: d.featured === true,
                isOpenNow: d.isOpenNow !== false,
            });
        }
        stores.sort((a, b) => {
            const fa = a.featured ? 0 : 1;
            const fb = b.featured ? 0 : 1;
            if (fa !== fb) return fa - fb;
            return (a.name || "").localeCompare(b.name || "", "ar");
        });
        return NextResponse.json({ stores });
    } catch (e) {
        console.error("public stores:", e);
        return NextResponse.json({ error: "تعذر تحميل المتاجر" }, { status: 500 });
    }
}
