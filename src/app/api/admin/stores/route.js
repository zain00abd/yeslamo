import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/auth/require-admin";
import { serializeDoc } from "@/lib/admin/firestoreSerialize";
import { isValidStoreCategoryId, getStoreCategoryLabel } from "@/lib/admin/storeConstants";
import { DRIVER_CITY_OPTIONS } from "@/lib/admin/driverConstants";

const CITY_SET = new Set(DRIVER_CITY_OPTIONS);

function isValidImgbbHttpsUrl(url) {
    if (typeof url !== "string" || url.length > 2048) return false;
    try {
        const u = new URL(url);
        if (u.protocol !== "https:") return false;
        const h = u.hostname.toLowerCase();
        return h === "i.ibb.co" || h.endsWith(".ibb.co");
    } catch {
        return false;
    }
}

function isValidLocationCoords(c) {
    if (!c || typeof c !== "object") return false;
    const { lat, lng } = c;
    if (typeof lat !== "number" || typeof lng !== "number") return false;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export async function GET(request) {
    const { error } = await requireAdmin(request);
    if (error) return error;

    try {
        const snap = await adminDb.collection("stores").limit(200).get();
        const stores = snap.docs
            .map((docSnap) => ({
                id: docSnap.id,
                ...serializeDoc(docSnap.data()),
            }))
            .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
        return NextResponse.json({ stores });
    } catch (e) {
        console.error("admin stores:", e);
        return NextResponse.json({ error: "تعذر تحميل المتاجر" }, { status: 500 });
    }
}

/** إنشاء متجر جديد — من لوحة الإدارة فقط */
export async function POST(request) {
    const { error } = await requireAdmin(request);
    if (error) return error;

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "جسم غير صالح" }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const categoryId = typeof body.categoryId === "string" ? body.categoryId.trim() : "";
    const city = typeof body.city === "string" ? body.city.trim() : "";
    const locationDesc = typeof body.locationDesc === "string" ? body.locationDesc.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
    const locationCoords = body.locationCoords;

    if (!name || name.length > 200) {
        return NextResponse.json({ error: "اسم المتجر مطلوب (بحد أقصى 200 حرف)" }, { status: 400 });
    }
    if (!isValidStoreCategoryId(categoryId)) {
        return NextResponse.json({ error: "تصنيف المتجر غير صالح" }, { status: 400 });
    }
    if (!city || !CITY_SET.has(city)) {
        return NextResponse.json({ error: "المدينة مطلوبة ويجب اختيارها من القائمة" }, { status: 400 });
    }
    if (!locationDesc || locationDesc.length > 2000) {
        return NextResponse.json({ error: "العنوان التفصيلي للموقع مطلوب" }, { status: 400 });
    }
    if (!isValidLocationCoords(locationCoords)) {
        return NextResponse.json({ error: "إحداثيات الموقع مطلوبة وغير صالحة" }, { status: 400 });
    }
    if (!phone || phone.length > 32) {
        return NextResponse.json({ error: "هاتف المتجر مطلوب" }, { status: 400 });
    }
    if (!isValidImgbbHttpsUrl(imageUrl)) {
        return NextResponse.json({ error: "رابط صورة المتجر مطلوب ويجب أن يكون رابطاً صالحاً من الرفع" }, { status: 400 });
    }

    const areaId = "default";
    const address = `${city}، ${locationDesc}`.slice(0, 800);
    const typeLabel = getStoreCategoryLabel(categoryId);

    const shortDescription =
        typeof body.shortDescription === "string" ? body.shortDescription.trim().slice(0, 280) : "";
    const featured = body.featured === true;
    const isOpenNow = body.isOpenNow !== false;

    const payload = {
        name,
        categoryId,
        type: typeLabel,
        city,
        locationDesc,
        locationCoords: { lat: locationCoords.lat, lng: locationCoords.lng },
        address,
        area: city,
        areaId,
        phone: phone.slice(0, 32),
        imageUrl,
        isActive: true,
        featured,
        isOpenNow,
        ...(shortDescription ? { shortDescription } : {}),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    };

    try {
        const ref = await adminDb.collection("stores").add(payload);
        const snap = await ref.get();
        const store = { id: snap.id, ...serializeDoc(snap.data()) };
        return NextResponse.json({ ok: true, storeId: snap.id, store });
    } catch (e) {
        console.error("admin store create:", e);
        return NextResponse.json({ error: "تعذر إنشاء المتجر" }, { status: 500 });
    }
}

export async function PATCH(request) {
    const { error } = await requireAdmin(request);
    if (error) return error;

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "جسم غير صالح" }, { status: 400 });
    }

    const storeId = typeof body.storeId === "string" ? body.storeId.trim() : "";
    const isActive = body.isActive;
    if (!storeId || typeof isActive !== "boolean") {
        return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    try {
        await adminDb
            .collection("stores")
            .doc(storeId)
            .update({ isActive, updatedAt: FieldValue.serverTimestamp() });
        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error("admin store patch:", e);
        return NextResponse.json({ error: "تعذر التحديث" }, { status: 500 });
    }
}
