import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireAuthUid } from "@/lib/serverAuth";
import { validateProfileUpdatePayload } from "@/lib/auth/profileValidation";

export async function POST(request) {
    try {
        const { uid: authUid, error: authError } = await requireAuthUid(request);
        if (authError) return authError;

        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: "جسم الطلب غير صالح" }, { status: 400 });
        }

        const validated = validateProfileUpdatePayload(body);
        if (validated.error) {
            return NextResponse.json({ error: validated.error }, { status: 400 });
        }

        const { id, updateData } = validated.data;
        if (id !== authUid) {
            return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
        }
        updateData.updatedAt = FieldValue.serverTimestamp();

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
