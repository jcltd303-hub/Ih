import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const RESTRICTED_REGIONS = new Set(["WA", "ID", "MI", "QU"]);

export const validatePlayerRegion = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required for region verification.');
  }

  const userId = request.auth.uid;
  const rawCountry = request.rawRequest.headers['x-vercel-ip-country'] || 
                     request.rawRequest.headers['cf-ipcountry'] || 
                     'US';
                     
  const rawState = request.rawRequest.headers['x-vercel-ip-state'] || 
                   request.rawRequest.headers['cf-ip-country-subdivision'] || 
                   (request.data as { clientClaimedState?: string }).clientClaimedState || 
                   'UNKNOWN';

  if (rawCountry !== 'US') {
    throw new HttpsError('permission-denied', 'Access restricted: Sweepstakes play is available only within authorized U.S. jurisdictions.');
  }

  const normalizedState = String(rawState).toUpperCase().trim();
  if (RESTRICTED_REGIONS.has(normalizedState)) {
    await admin.firestore().collection('compliance_audit_logs').add({
      userId,
      state: normalizedState,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      action: 'blocked_restricted_jurisdiction'
    });

    throw new HttpsError('permission-denied', `Access restricted: Sweepstakes participation is prohibited in your current jurisdiction (${normalizedState}).`);
  }

  return { compliant: true, authorizedState: normalizedState, timestamp: Date.now() };
});
