import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "admin_session";

function getSecret() {
    const s = process.env.ADMIN_SESSION_SECRET;
    if (!s || s.length < 16) {
        throw new Error("ADMIN_SESSION_SECRET must be set (min 16 chars)");
    }
    return new TextEncoder().encode(s);
}

/** @param {string} uid */
export async function signAdminSession(uid) {
    return new SignJWT({ sub: uid, role: "admin" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("365d")
        .sign(getSecret());
}

/** @param {string} token */
export async function verifyAdminSessionToken(token) {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    if (payload.role !== "admin" || typeof payload.sub !== "string") {
        throw new Error("INVALID_ADMIN_TOKEN");
    }
    return { uid: payload.sub, role: payload.role };
}

export { COOKIE_NAME };
