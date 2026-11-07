import React from 'react';
import { getPayload } from 'payload';
import config from '@payload-config';
import { DrinksManager, type SerializedDrink, type SerializedCategory } from './DrinksManager';

export async function CustomListDrinks() {
  const payload = await getPayload({ config });

  // 1. Fetch all drink categories for filter tabs
  const categoriesResult = await payload.find({
    collection: 'drink-categories',
    limit: 100,
    sort: 'name',
    select: {
      id: true,
      name: true,
    },
  });

  const categories: SerializedCategory[] = categoriesResult.docs.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  // 2. Fetch drinks with category & media image populated (depth: 1)
  const drinksResult = await payload.find({
    collection: 'drinks',
    limit: 200,
    depth: 1,
    sort: 'name',
  });

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

