import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireAuthUid } from "@/lib/serverAuth";

export async function POST(request) {
    try {
        const { uid: authUid, error: authError } = await requireAuthUid(request);
        if (authError) return authError;

        const { id, name, address, city, locationDesc, locationCoords } = await request.json();

        if (!id) {
            return NextResponse.json({ error: "المعرف مطلوب" }, { status: 400 });
        }
        if (id !== authUid) {
            return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
        }

        const updateData = {
            updatedAt: FieldValue.serverTimestamp(),
        };

        if (name) updateData.name = name.trim();
        if (address) updateData.address = address.trim();
        if (city !== undefined) updateData.city = city?.trim() || "";
        if (locationDesc !== undefined) updateData.locationDesc = locationDesc?.trim() || "";
        if (locationCoords !== undefined) updateData.locationCoords = locationCoords || null;

        const docRef = adminDb.collection("users").doc(id);
        const existingDoc = await docRef.get();

        if (!existingDoc.exists) {
            return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
        }

        await docRef.update(updateData);

        // Merge existing data with updates locally — no need for a second read
        const existingData = existingDoc.data();
        const merged = { ...existingData, ...updateData };

        return NextResponse.json({
            message: "تم تحديث البيانات بنجاح",
            user: {
                id,
                name: merged.name,
                phone: merged.phone,
                address: merged.address,
                city: merged.city || "",
                locationDesc: merged.locationDesc || "",
                locationCoords: merged.locationCoords || null,
            },
        });
    } catch (error) {
        console.error("Update error:", error);
        return NextResponse.json({ error: "حدث خطأ في تحديث البيانات" }, { status: 500 });
    }
}
