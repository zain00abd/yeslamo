const PHONE_REGEX = /^\+?[0-9]{7,15}$/;
const MAX_NAME_LEN = 80;
const MAX_ADDRESS_LEN = 200;
const MAX_CITY_LEN = 80;
const MAX_DESC_LEN = 300;

function trimString(value) {
    return typeof value === "string" ? value.trim() : "";
}

export function normalizePhone(value) {
    return trimString(value).replace(/\s/g, "");
}

export function isValidLocationCoords(value) {
    if (!value || typeof value !== "object") return false;

    const { lat, lng } = value;
    if (typeof lat !== "number" || typeof lng !== "number") return false;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function validateRegistrationPayload(body) {
    const name = trimString(body?.name);
    const phone = normalizePhone(body?.phone);
    const password = typeof body?.password === "string" ? body.password : "";
    const address = trimString(body?.address);
    const city = trimString(body?.city);
    const locationDesc = trimString(body?.locationDesc);
    const locationCoords = body?.locationCoords ?? null;

    if (!name || !phone || !password || !address) {
        return { error: "جميع الحقول مطلوبة" };
    }
    if (name.length > MAX_NAME_LEN) {
        return { error: "الاسم طويل جداً" };
    }
    if (address.length > MAX_ADDRESS_LEN) {
        return { error: "العنوان طويل جداً" };
    }
    if (city.length > MAX_CITY_LEN) {
        return { error: "اسم المدينة طويل جداً" };
    }
    if (locationDesc.length > MAX_DESC_LEN) {
        return { error: "وصف الموقع طويل جداً" };
    }
    if (!PHONE_REGEX.test(phone)) {
        return { error: "رقم الهاتف غير صالح" };
    }
    if (password.length < 6) {
        return { error: "كلمة السر يجب أن تكون 6 أحرف على الأقل" };
    }
    if (locationCoords !== null && !isValidLocationCoords(locationCoords)) {
        return { error: "إحداثيات الموقع غير صالحة" };
    }

    return {
        data: {
            name,
            phone,
            password,
            address,
            city,
            locationDesc,
            locationCoords: locationCoords ? { lat: locationCoords.lat, lng: locationCoords.lng } : null,
        },
    };
}

export function validateProfileUpdatePayload(body) {
    const id = trimString(body?.id);
    const updateData = {};

    if (!id) {
        return { error: "المعرف مطلوب" };
    }

    if (body?.name !== undefined) {
        const name = trimString(body.name);
        if (!name) return { error: "الاسم مطلوب" };
        if (name.length > MAX_NAME_LEN) return { error: "الاسم طويل جداً" };
        updateData.name = name;
    }

    if (body?.address !== undefined) {
        const address = trimString(body.address);
        if (!address) return { error: "العنوان مطلوب" };
        if (address.length > MAX_ADDRESS_LEN) return { error: "العنوان طويل جداً" };
        updateData.address = address;
    }

    if (body?.city !== undefined) {
        const city = trimString(body.city);
        if (city.length > MAX_CITY_LEN) return { error: "اسم المدينة طويل جداً" };
        updateData.city = city;
    }

    if (body?.locationDesc !== undefined) {
        const locationDesc = trimString(body.locationDesc);
        if (locationDesc.length > MAX_DESC_LEN) return { error: "وصف الموقع طويل جداً" };
        updateData.locationDesc = locationDesc;
    }

    if (body?.locationCoords !== undefined) {
        if (body.locationCoords === null) {
            updateData.locationCoords = null;
        } else {
            if (!isValidLocationCoords(body.locationCoords)) {
                return { error: "إحداثيات الموقع غير صالحة" };
            }
            updateData.locationCoords = {
                lat: body.locationCoords.lat,
                lng: body.locationCoords.lng,
            };
        }
    }

    return { data: { id, updateData } };
}
