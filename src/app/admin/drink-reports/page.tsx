import React from 'react';
import { redirect } from 'next/navigation';
import { getAuthUser } from '@/lib/security/auth-helper';
import { DrinkRewardsReports } from '@/components/admin/DrinkRewardsReports';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'تقارير المشروبات المصروفة | Coffee Bay Admin',
  description: 'لوحة تقارير وإحصائيات تشغيلية لحركة صرف قسائم المشروبات المجانية في كوفي باي.',
};

export default async function DrinkReportsPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect('/admin/login');
  }

  if (user.role !== 'ADMIN') {
    redirect('/admin');
  }

  return (
    <div className="py-6 px-4 sm:px-6">
      <DrinkRewardsReports />
    </div>
  );
}
