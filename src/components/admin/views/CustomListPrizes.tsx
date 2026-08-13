import React from 'react';
import { getPayload } from 'payload';
import config from '@payload-config';
import { PrizesManager } from './PrizesManager';

export async function CustomListPrizes() {
  // Query all prizes dynamically from PostgreSQL via Payload Local API
  const payload = await getPayload({ config });

  const prizesResult = await payload.find({
    collection: 'prizes',
    limit: 100,
    depth: 1, // Populate the media image relationship field
    sort: 'name',
  });

  const claimsResult = await payload.count({
    collection: 'prize-claims',
  });

  const prizes = prizesResult.docs.map(doc => ({
    id: doc.id,
    name: doc.name,
    quantity: doc.quantity,
    description: doc.description || undefined,
    image: doc.image || null,
    active: Boolean(doc.active),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }));

  return <PrizesManager initialPrizes={prizes} totalClaims={claimsResult.totalDocs} />;
}
