import React from 'react';
import { redirect } from 'next/navigation';
import { getAuthUser } from '@/lib/security/auth-helper';
import { CashierDrinkTerminal } from '@/components/admin/CashierDrinkTerminal';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Drink Redemption Terminal | Coffee Bay Admin',
  description: 'Cashier Terminal for verifying and dispensing complimentary drink reward vouchers.',
};

export default async function DrinkRedemptionPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect('/admin/login');
  }

  return (
    <div className="py-6 px-4 sm:px-6">
      <CashierDrinkTerminal />
    </div>
  );
}
