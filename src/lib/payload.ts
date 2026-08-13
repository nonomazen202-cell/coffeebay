import { getPayload as getPayloadCMS, type Payload } from 'payload';
import config from '../payload.config';

let cachedPromise: Promise<Payload> | null = null;

export async function getPayloadClient(): Promise<Payload> {
  if (!cachedPromise) {
    cachedPromise = getPayloadCMS({ config });
  }
  return cachedPromise;
}
