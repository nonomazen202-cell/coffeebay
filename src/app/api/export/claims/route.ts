 
import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '../../../../payload.config';
import { getAuthUser } from '../../../../lib/security/auth-helper';
import { securityService } from '../../../../services/security-service';
import type { PrizeClaim } from '../../../../payload-types';

export async function GET() {
  const requestId = securityService.generateRequestId();

  try {
    // 1. Authenticate user
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, errors: ['Unauthorized'], requestId },
        { status: 401 }
      );
    }

    // 2. Authorize role (must be ADMIN)
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, errors: ['Forbidden'], requestId },
        { status: 403 }
      );
    }

    // 3. Retrieve prize claims records
    const payload = await getPayload({ config });
    const result = await payload.find({
      collection: 'prize-claims',
      limit: 10000,
      depth: 1,
    });

    // 4. Construct CSV structure
    const csvHeader =
      'id,entryId,verificationCode,status,verified,verifiedBy,verifiedAt,createdAt\n';
    const csvRows = result.docs.map((doc: PrizeClaim) => {
      const entryId = doc.entry && typeof doc.entry === 'object' ? doc.entry.id : doc.entry || '';
      const verifiedBy =
        doc.verified_by && typeof doc.verified_by === 'object'
          ? doc.verified_by.id
          : doc.verified_by || '';
      return `${doc.id},"${entryId}","${doc.verification_code}","${doc.status}",${Boolean(
        doc.verified
      )},"${verifiedBy}","${doc.verified_at || ''}","${doc.createdAt}"`;
    });

    const csvContent = csvHeader + csvRows.join('\n');

    // 5. Stream download response
    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="export-claims.csv"',
      },
    });
  } catch (err: unknown) {
    console.error(`[API ERROR] GET /api/export/claims - Request ID: ${requestId}`, err);
    return NextResponse.json(
      { success: false, errors: ['Internal Server Error'], requestId },
      { status: 500 }
    );
  }
}
