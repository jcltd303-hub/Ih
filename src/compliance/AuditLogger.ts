import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../network/FirebaseClient';

export interface AuditLogEntry {
  id?: string;
  userId: string;
  action: string;
  details: Record<string, unknown>;
  timestamp: number;
  syncedToServer: boolean;
}

export class AuditLogger {
  private static LOCAL_STORAGE_KEY = 'fish_frenzy_compliance_logs';

  public static async logEvent(userId: string, action: string, details: Record<string, unknown>): Promise<void> {
    const entry: AuditLogEntry = {
      userId,
      action,
      details,
      timestamp: Date.now(),
      syncedToServer: false
    };

    // 1. Immediately preserve in local storage to prevent data loss under network partitions
    this.saveToLocal(entry);

    // 2. Dispatch to cloud firestore audit ledger if available
    try {
      const auditRef = collection(db, 'compliance_audit_logs');
      await addDoc(auditRef, {
        userId,
        action,
        details,
        timestamp: serverTimestamp()
      });
      entry.syncedToServer = true;
      this.updateLocalEntrySynced(entry.timestamp);
    } catch (err) {
      console.warn('[AuditLogger] Network offline or Firestore restricted. Log stored locally:', err);
    }
  }

  private static saveToLocal(entry: AuditLogEntry): void {
    try {
      const existing = this.getRecentAuditLogs();
      existing.unshift(entry);
      // Cap at 100 recent entries to prevent storage bloat
      const capped = existing.slice(0, 100);
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(capped));
    } catch (e) {
      console.error('[AuditLogger] Failed to write local compliance log:', e);
    }
  }

  private static updateLocalEntrySynced(timestamp: number): void {
    try {
      const existing = this.getRecentAuditLogs();
      const match = existing.find(e => e.timestamp === timestamp);
      if (match) {
        match.syncedToServer = true;
        localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(existing));
      }
    } catch {}
  }

  public static getRecentAuditLogs(): AuditLogEntry[] {
    try {
      const raw = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}
