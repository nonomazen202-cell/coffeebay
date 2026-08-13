export interface AuditLogData {
  requestId: string;
  ip: string;
  userAgent: string;
  action: string;
  result: 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'ERROR';
  details?: Record<string, unknown>;
}

export class AuditLogger {
  log(data: AuditLogData): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      ...data,
    };

    // Output a structured JSON log prefix with [AUDIT]
    console.log(`[AUDIT] ${JSON.stringify(logEntry)}`);
  }
}

export const auditLogger = new AuditLogger();
