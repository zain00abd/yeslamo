import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";

const IMGBB_URL = "https://api.imgbb.com/1/upload";
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * رفع صورة إلى imgbb — من لوحة الإدارة فقط.
 * multipart/form-data، الحقل: file
 */
export async function POST(request) {
    const { error } = await requireAdmin(request);
    if (error) return error;

    const key = process.env.IMGBB_API_KEY;
    if (!key) {
        return NextResponse.json({ error: "مفتاح imgbb غير مضبوط (IMGBB_API_KEY)" }, { status: 500 });
    }

    let formData;
    try {
        formData = await request.formData();
    } catch {
        return NextResponse.json({ error: "جسم غير صالح" }, { status: 400 });
    }

    const file = formData.get("file");
    if (!file || typeof file === "string") {
        return NextResponse.json({ error: "أرفق ملف صورة" }, { status: 400 });
    }

    const size = "size" in file ? file.size : 0;
    if (size > MAX_BYTES) {
        return NextResponse.json({ error: "حجم الصورة يجب ألا يتجاوز 8 ميجابايت" }, { status: 400 });
    }

    const mime = "type" in file ? file.type : "";
    if (mime && !mime.startsWith("image/")) {
        return NextResponse.json({ error: "الملف يجب أن يكون صورة" }, { status: 400 });
    }

    let buffer;
    try {
        buffer = Buffer.from(await file.arrayBuffer());
    } catch {
        return NextResponse.json({ error: "تعذر قراءة الملف" }, { status: 400 });
    }

    const base64 = buffer.toString("base64");
    const params = new URLSearchParams();
    params.append("key", key);
    params.append("image", base64);

    let imgbbRes;
    try {
        imgbbRes = await fetch(IMGBB_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString(),
        });
    } catch (e) {
        console.error("imgbb fetch:", e);
        return NextResponse.json({ error: "تعذر الاتصال بخدمة الرفع" }, { status: 502 });
    }

    let json;
    try {
        json = await imgbbRes.json();
    } catch {
        return NextResponse.json({ error: "استجابة غير صالحة من خدمة الرفع" }, { status: 502 });
    }

    if (!json.success || !json.data?.url) {
        const msg = json.error?.message || json.error || "فشل الرفع";
        return NextResponse.json({ error: typeof msg === "string" ? msg : "فشل الرفع" }, { status: 400 });
    }

    return NextResponse.json({
        url: json.data.url,
        displayUrl: json.data.display_url || json.data.url,
        deleteUrl: json.data.delete_url || null,
    });
}
