import { NextRequest, NextResponse } from 'next/server';
import { securityService } from '../../../services/security-service';
import type { SecurityCheckRequest } from '../../../services/security-service';
import { redeemService } from '../../../services/redeem-service';
import { telemetry } from '../../../lib/telemetry';
import { getPayloadClient } from '../../../lib/payload';
import { validateAndNormalizePhone } from '../../../lib/validators/phone-validator';
import { alertEmailService } from '../../../services/alert-email-service';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const action = searchParams.get('action');
  const secret = searchParams.get('secret');

  // Enforce security block in production unless a valid TELEMETRY_SECRET_KEY is provided
  const isProd = process.env.NODE_ENV === 'production';
  const configuredSecret = process.env.TELEMETRY_SECRET_KEY;

  if (isProd && (!configuredSecret || secret !== configuredSecret)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  // If telemetry is not enabled, initialize it if query param is set
  if (action === 'init') {
    process.env.ENABLE_TELEMETRY = 'true';
    telemetry.initialize();
    return NextResponse.json({ success: true, message: 'Telemetry initialized' });
  }

  if (action === 'summary') {
    telemetry.printSummary();
    return NextResponse.json({ success: true, message: 'Summary printed to server console' });
  }

  if (action === 'reset') {
    telemetry.reset();
    return NextResponse.json({ success: true, message: 'Telemetry reset' });
  }

  return NextResponse.json({
    success: true,
    telemetryEnabled: telemetry.isEnabled(),
    message: 'Redeem GET endpoint. Use action=init, action=summary, or action=reset for telemetry control.',
  });
}

export async function POST(req: NextRequest) {
  console.log({
    host: req.headers.get("host"),
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    forwardedHost: req.headers.get("x-forwarded-host"),
    forwardedProto: req.headers.get("x-forwarded-proto"),
    url: req.url,
    nextUrl: req.nextUrl.toString(),
  });

  const timer = telemetry.onRequestEnter();
  const requestId = securityService.generateRequestId();
  let ip =
    (req as { ip?: string }).ip ||
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1';
  if (ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }
  const userAgent = req.headers.get('user-agent') || 'Unknown';

  try {
    let body: SecurityCheckRequest['payload'];
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, errors: ['Malformed JSON payload'], requestId },
        { status: 400 }
      );
    }
    console.log(`[${requestId}] START ${body?.serialCode}`);

    // 1. Perform security checks (honeypot, request validation, rate limiting, Turnstile)
    timer.startStep('security_check');
    const securityResult = await securityService.performSecurityCheck(requestId, {
      ip,
      userAgent,
      payload: body,
    });
    timer.endStep('security_check');

    if (!securityResult.success) {
      const isRateLimited = securityResult.retryAfterSeconds !== undefined;
      return NextResponse.json(
        {
          success: false,
          errors: securityResult.errors || ['Security validation failed'],
          requestId,
          ...(isRateLimited ? { retryAfterSeconds: securityResult.retryAfterSeconds } : {}),
        },
        { status: isRateLimited ? 429 : 400 }
      );
    }

    const payload = await getPayloadClient();

    // 2. Validate and normalize the target phone
    const normalizedPayload = securityResult.normalizedPayload!;
    const phoneResult = validateAndNormalizePhone(normalizedPayload.phone || '');
    if (!phoneResult.valid) {
      return NextResponse.json(
        { success: false, errors: [phoneResult.error || 'Invalid phone number format.'], requestId },
        { status: 400 }
      );
    }
    const phone = phoneResult.normalized;

    // 3. Query the participant's verification state
    const participantResult = await payload.find({
      collection: 'participants',
      where: { phone: { equals: phone } },
    });

    if (participantResult.docs.length === 0 || !participantResult.docs[0].verified) {
      return NextResponse.json(
        { success: false, result: 'UNVERIFIED', errors: ['Phone number verification is required.'], requestId },
        { status: 403 }
      );
    }

    const participant = participantResult.docs[0];

    // 4. Enforce administrative block check
    if (participant.blocked) {
      return NextResponse.json(
        { success: false, result: 'BLOCKED', errors: [participant.blockedReason || 'This phone number has been blocked.'], requestId },
        { status: 403 }
      );
    }

    // 5. Update participant name dynamically if it changed
    const participantName = normalizedPayload.name && normalizedPayload.name.trim().length > 0
      ? normalizedPayload.name.trim()
      : participant.name;

    if (participant.name !== participantName) {
      await payload.update({
        collection: 'participants',
        id: participant.id,
        data: { name: participantName },
      });
    }

    // 6. Delegate to redeem business service
    const redeemResult = await redeemService.redeemCode({
      ...normalizedPayload,
      phone, // Override with the normalized phone variable
      ip,
      userAgent,
      requestId,
      timer, // Pass timer for inner service measurements
    });

    if (!redeemResult.success) {
      return NextResponse.json(
        {
          success: false,
          errors: [redeemResult.message || 'Redemption process failed'],
          requestId,
        },
        { status: 400 }
      );
    }

    console.log(`[${requestId}] END SUCCESS`);
    // 7. Return successful redemption status response
    return NextResponse.json({
      success: true,
      result: redeemResult.result,
      participantId: redeemResult.participantId,
      entryId: redeemResult.entryId,
      prizeName: redeemResult.prizeName,
      prizeImageUrl: redeemResult.prizeImageUrl,
      verificationCode: redeemResult.verificationCode,
      message: redeemResult.message,
      requestId,
    });
  } catch (err: unknown) {
    console.error(`[${requestId}] ROUTE ERROR`, err);
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    const stack = err instanceof Error ? err.stack : undefined;

    void alertEmailService.sendDeveloperAlert({
      severity: 'CRITICAL',
      title: 'Redemption Route Crash (500)',
      message,
      component: 'redeem-route',
      operation: 'Redeem Code POST',
      requestId,
      occurredAt: new Date(),
      environment: process.env.NODE_ENV || 'development',
      stack,
    });

    return NextResponse.json(
      { success: false, errors: [message], requestId },
      { status: 500 }
    );
  } finally {
    telemetry.onRequestComplete(timer);
  }
}
