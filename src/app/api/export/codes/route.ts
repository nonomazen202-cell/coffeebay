 
import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '../../../../payload.config';
import { getAuthUser } from '../../../../lib/security/auth-helper';
import { securityService } from '../../../../services/security-service';
import type { Code } from '../../../../payload-types';

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

    // 3. Retrieve database codes records
    const payload = await getPayload({ config });
    const result = await payload.find({
      collection: 'codes',
      limit: 10000,
      depth: 1,
    });

    // 4. Construct CSV structure
    const csvHeader = 'id,serialCode,isWinner,prizeId,claimed,claimedAt,createdAt\n';
    const csvRows = result.docs.map((doc: Code) => {
      const prizeId =
        doc.prize_id && typeof doc.prize_id === 'object' ? doc.prize_id.id : doc.prize_id || '';
      return `${doc.id},"${doc.serial_code}",${Boolean(doc.is_winner)},"${prizeId}",${Boolean(
        doc.claimed
      )},"${doc.claimed_at || ''}","${doc.createdAt}"`;
    });

    const csvContent = csvHeader + csvRows.join('\n');

    // 5. Stream download response
    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="export-codes.csv"',
      },
    });
  } catch (err: unknown) {
    console.error(`[API ERROR] GET /api/export/codes - Request ID: ${requestId}`, err);
    return NextResponse.json(
      { success: false, errors: ['Internal Server Error'], requestId },
      { status: 500 }
    );
  }
}
