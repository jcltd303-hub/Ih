"use strict";
/**
 * Server-side economy config. Clients may read packages; never trust client amounts.
 * SC bonus is 1:1 USD (bonusSc = priceUsd * bonusPct/100).
 * Highest tier 10% SC bonus, decreasing per lower tier. $5 pack is GC-only.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PACKAGES = exports.TARGET_RTP = void 0;
exports.scBonusForPackage = scBonusForPackage;
exports.getDefaultPackage = getDefaultPackage;
exports.TARGET_RTP = 85;
/** Defaults; admin can override via Firestore config/packages */
exports.DEFAULT_PACKAGES = [
    {
        id: 'pack_5',
        priceUsd: 4.99,
        gcAmount: 5000,
        scBonusPct: 0, // GC only
        label: '$4.99 Starter',
        active: true
    },
    {
        id: 'pack_10',
        priceUsd: 9.99,
        gcAmount: 12000,
        scBonusPct: 3,
        label: '$9.99 Plus',
        active: true
    },
    {
        id: 'pack_20',
        priceUsd: 19.99,
        gcAmount: 28000,
        scBonusPct: 5,
        label: '$19.99 Pro',
        active: true
    },
    {
        id: 'pack_50',
        priceUsd: 49.99,
        gcAmount: 80000,
        scBonusPct: 7,
        label: '$49.99 Elite',
        active: true
    },
    {
        id: 'pack_100',
        priceUsd: 99.99,
        gcAmount: 180000,
        scBonusPct: 10, // highest tier
        label: '$99.99 Ultimate',
        active: true
    }
];
function scBonusForPackage(pkg) {
    if (!pkg.scBonusPct)
        return 0;
    // 1:1 USD → SC
    return Math.round(pkg.priceUsd * (pkg.scBonusPct / 100) * 100) / 100;
}
function getDefaultPackage(packageId) {
    return exports.DEFAULT_PACKAGES.find((p) => p.id === packageId && p.active);
}
//# sourceMappingURL=economyConfig.js.map