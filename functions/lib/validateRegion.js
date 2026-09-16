"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePlayerRegion = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const RESTRICTED_REGIONS = new Set(["WA", "ID", "MI", "QU"]);
function firstHeader(headers, ...keys) {
    for (const key of keys) {
        const v = headers[key];
        if (typeof v === "string" && v.length > 0)
            return v;
        if (Array.isArray(v) && v.length > 0 && v[0])
            return v[0];
    }
    return null;
}
/**
 * Verified geo signal only, in priority order. Never trust a
 * client-supplied region for a legal/compliance gate — only headers
 * injected by a trusted edge count.
 *
 * IMPORTANT: confirm with your infra which of these your production
 * deployment actually populates. `x-vercel-ip-*` / `cf-ip*` only appear if
 * Vercel/Cloudflare sits in front of this function; a bare Firebase Cloud
 * Function behind Firebase Hosting needs the App Engine-style headers
 * instead. If none of these are populated in your logs today, this check
 * has been failing open — verify this in staging before relying on it.
 */
function getVerifiedCountry(headers) {
    const v = firstHeader(headers, "cf-ipcountry", "x-vercel-ip-country", "x-appengine-country");
    return v ? v.toUpperCase() : null;
}
function getVerifiedState(headers) {
    const v = firstHeader(headers, "cf-ip-country-subdivision", "x-vercel-ip-country-region", "x-appengine-region");
    return v ? v.toUpperCase().trim() : null;
}
exports.validatePlayerRegion = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required for region verification.");
    }
    const userId = request.auth.uid;
    const headers = request.rawRequest.headers;
    const country = getVerifiedCountry(headers);
    const state = getVerifiedState(headers);
    // Fail closed: if we can't verify location from a trusted edge header, we
    // don't know where the player is, so we don't let them in. A
    // client-claimed state is not evidence of anything and must never grant
    // access here — that was the previous behavior and it's the bug this
    // fixes.
    if (!country || country !== "US" || !state) {
        await admin
            .firestore()
            .collection("compliance_audit_logs")
            .add({
            userId,
            country: country || "UNVERIFIED",
            state: state || "UNVERIFIED",
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            action: "blocked_unverified_location"
        });
        throw new https_1.HttpsError("permission-denied", "Access restricted: unable to verify you are in an authorized U.S. jurisdiction.");
    }
    if (RESTRICTED_REGIONS.has(state)) {
        await admin
            .firestore()
            .collection("compliance_audit_logs")
            .add({
            userId,
            state,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            action: "blocked_restricted_jurisdiction"
        });
        throw new https_1.HttpsError("permission-denied", `Access restricted: Sweepstakes participation is prohibited in your current jurisdiction (${state}).`);
    }
    await admin
        .firestore()
        .collection("compliance_audit_logs")
        .add({
        userId,
        state,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        action: "allowed"
    });
    return { compliant: true, authorizedState: state, timestamp: Date.now() };
});
//# sourceMappingURL=validateRegion.js.map