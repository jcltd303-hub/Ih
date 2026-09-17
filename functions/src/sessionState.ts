import * as admin from 'firebase-admin';

export type ServerSessionState = {
  userId: string;
  sessionId: string;
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  payoutTable: Record<string, unknown>;
  payoutTableVersion: string;
  createdAt?: unknown;
  closedAt?: unknown;
};

export function serverSessionStateRef(
  db: FirebaseFirestore.Firestore,
  userId: string,
  sessionId: string
): FirebaseFirestore.DocumentReference {
  return db.collection('serverSessionState').doc(userId).collection('sessions').doc(sessionId);
}

export async function getServerSessionState(
  userId: string,
  sessionId: string
): Promise<ServerSessionState | null> {
  const db = admin.firestore();
  const snap = await serverSessionStateRef(db, userId, sessionId).get();
  if (!snap.exists) return null;
  return snap.data() as ServerSessionState;
}

export function createServerSessionState(
  userId: string,
  sessionId: string,
  state: Omit<ServerSessionState, 'userId' | 'sessionId'>
): ServerSessionState {
  return { userId, sessionId, ...state };
}
