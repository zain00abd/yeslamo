import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

function publicStoreFromDoc(docSnap) {
    const d = docSnap.data();
    if (d.isActive === false) return null;
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
              : "";

    return {
        id: docSnap.id,
        name: typeof d.name === "string" ? d.name : "",
        type: typeof d.type === "string" ? d.type : "",
        categoryId: typeof d.categoryId === "string" ? d.categoryId : "",
        city: typeof d.city === "string" ? d.city : typeof d.area === "string" ? d.area : "",
        imageUrl: typeof d.imageUrl === "string" ? d.imageUrl : "",
        phone: typeof d.phone === "string" ? d.phone : "",
        address: typeof d.address === "string" ? d.address : "",
        locationDesc: typeof d.locationDesc === "string" ? d.locationDesc : "",
        description: rawDesc,
        locationCoords,
        featured: d.featured === true,
        isOpenNow: d.isOpenNow !== false,
    };
}

export async function GET(_request, context) {
    const params = await context.params;
    const id = typeof params?.id === "string" ? params.id.trim() : "";
    if (!id) {
        return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });
    }

    try {
        const docSnap = await adminDb.collection("stores").doc(id).get();
        if (!docSnap.exists) {
            return NextResponse.json({ error: "المتجر غير موجود" }, { status: 404 });
        }
        const store = publicStoreFromDoc(docSnap);
        if (!store) {
            return NextResponse.json({ error: "المتجر غير متاح" }, { status: 404 });
        }
        return NextResponse.json({ store });
    } catch (e) {
        console.error("public store by id:", e);
        return NextResponse.json({ error: "تعذر تحميل المتجر" }, { status: 500 });
    }
}
