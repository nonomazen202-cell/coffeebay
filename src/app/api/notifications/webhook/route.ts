import { NextRequest, NextResponse } from 'next/server';
import { createNotificationProvider } from '../../../../services/notification-provider';
import { webhookProcessor } from '../../../../services/webhook-processor';

async function handleRequest(req: NextRequest) {
  try {
    const provider = createNotificationProvider();

    // 1. Extract request details
    const method = req.method;
    const headers = req.headers;
    const searchParams: Record<string, string> = {};
    req.nextUrl.searchParams.forEach((val, key) => {
      searchParams[key] = val;
    });

    const rawBody = method === 'POST' ? await req.text() : '';

    // 2. Delegate validation and parsing to the active provider
    const validationResult = await provider.validateAndParseWebhook({
      method,
      headers,
      searchParams,
      rawBody,
    });

    if (!validationResult.verified) {
      return NextResponse.json(
        { success: false, error: validationResult.error || 'Webhook validation failed' },
        { status: method === 'GET' ? 403 : 401 },
      );
    }

    // 3. Handle GET challenge handshake (if present, e.g. Meta verification)
    if (method === 'GET' && validationResult.challenge !== undefined) {
      return new Response(validationResult.challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // 4. If there is a valid parsed event, process it using the generic processor
    if (validationResult.event) {
      const processResult = await webhookProcessor.processEvent(validationResult.event);
      if (!processResult.success) {
        return NextResponse.json(
          { success: false, error: processResult.error || 'Failed processing webhook event' },
          { status: 500 },
        );
      }
    }

    // 5. Return success acknowledgement
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[WebhookRoute] Exception in route handler:', err);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return handleRequest(req);
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}
