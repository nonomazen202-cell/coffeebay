import React from 'react';
import { getPayload, type Payload } from 'payload';
import config from '@payload-config';
import { PrizesManager } from './PrizesManager';

export async function CustomListPrizes({ payload: propPayload }: { payload?: Payload } = {}) {
  const payload = propPayload || (await getPayload({ config }));

  const [prizesResult, claimsResult] = await Promise.all([
    payload.find({
      collection: 'prizes',
      limit: 100,
      depth: 1,
      sort: 'name',
    }),
    payload.count({
      collection: 'prize-claims',
    }),
  ]);

  const prizes = prizesResult.docs.map(doc => ({
    id: doc.id,
    name: doc.name,
    quantity: doc.quantity,
    description: doc.description || undefined,
    image: doc.image || null,
    active: Boolean(doc.active),
    winner_notification_enabled: doc.winner_notification_enabled !== false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }));

  return <PrizesManager initialPrizes={prizes} totalClaims={claimsResult.totalDocs} />;
}
