import React from 'react';
import { getPayload, type Payload } from 'payload';
import config from '@payload-config';
import { DrinksManager, type SerializedDrink, type SerializedCategory } from './DrinksManager';

export async function CustomListDrinks({ payload: propPayload }: { payload?: Payload } = {}) {
  const payload = propPayload || (await getPayload({ config }));

  // Fetch categories and drinks concurrently to cut cross-datacenter RTT in half
  const [categoriesResult, drinksResult] = await Promise.all([
    payload.find({
      collection: 'drink-categories',
      limit: 100,
      sort: 'name',
      select: {
        id: true,
        name: true,
      },
    }),
    payload.find({
      collection: 'drinks',
      limit: 200,
      depth: 1,
      sort: 'name',
    }),
  ]);

  const categories: SerializedCategory[] = categoriesResult.docs.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  const drinks: SerializedDrink[] = drinksResult.docs.map((doc) => {
    let catInfo = null;
    if (doc.category && typeof doc.category === 'object') {
      catInfo = {
        id: doc.category.id,
        name: doc.category.name,
        slug: doc.category.slug,
      };
    }

    let imgInfo = null;
    if (doc.image && typeof doc.image === 'object') {
      imgInfo = {
        id: doc.image.id,
        url: doc.image.url || undefined,
        alt: doc.image.alt || undefined,
      };
    }

    return {
      id: doc.id,
      name: doc.name,
      category: catInfo,
      image: imgInfo,
      description: doc.description || null,
      active: Boolean(doc.active),
      updatedAt: doc.updatedAt,
      createdAt: doc.createdAt,
    };
  });

  return <DrinksManager initialDrinks={drinks} categories={categories} />;
}

