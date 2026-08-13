import React from 'react';
import type { Metadata } from 'next';
import { LoseClient } from './LoseClient';

export const metadata: Metadata = {
  title: 'Better Luck Next Time — CoffeeBay Lucky Cup',
  description: 'Every cup is a new chance. Come back and try again!',
};

export default function LosePage() {
  return <LoseClient />;
}
