import { getPayload as getPayloadCMS, type Payload } from 'payload';
import config from '../payload.config';

let testingClient: Payload | null = null;

export async function getPayloadClient(): Promise<Payload> {
  if (testingClient) {
    return testingClient;
  }

  const payload = await getPayloadCMS({ config });

  // Guard against concurrent initialization / HMR reload race where payload.db.drizzle
  // may still be initializing when another RSC or API route accesses payload.db.drizzle.execute
  if (
    payload.db &&
    !payload.db.drizzle &&
    typeof payload.db.connect === 'function'
  ) {
    await payload.db.connect();
  }

  return payload;
}

export function setPayloadClientForTesting(client: Payload | null): void {
  testingClient = client;
}
