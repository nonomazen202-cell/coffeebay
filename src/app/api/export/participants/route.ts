import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '../../../../payload.config';
import { getAuthUser } from '../../../../lib/security/auth-helper';
import { securityService } from '../../../../services/security-service';
import type { Participant } from '../../../../payload-types';

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

    // 3. Retrieve participants records
    const payload = await getPayload({ config });
    const result = await payload.find({
      collection: 'participants',
      limit: 10000,
      depth: 1,
    });

    // 4. Construct CSV structure
    const csvHeader = 'id,name,phone,createdAt\n';
    const csvRows = result.docs.map((doc: Participant) => {
      return `${doc.id},"${doc.name}","${doc.phone}","${doc.createdAt}"`;
    });

    const csvContent = csvHeader + csvRows.join('\n');

    // 5. Stream download response
    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="export-participants.csv"',
      },
    });
  } catch (err: unknown) {
    console.error(
      `[API ERROR] GET /api/export/participants - Request ID: ${requestId}`,
      err
    );
    return NextResponse.json(
      { success: false, errors: ['Internal Server Error'], requestId },
      { status: 500 }
    );
  }
}
