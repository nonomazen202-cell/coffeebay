import React from 'react';
import { redirect } from 'next/navigation';
import { getAuthUser } from '@/lib/security/auth-helper';
import { isSuperAdmin, isPromotionsAdmin } from '@/lib/security/roles';
import { DrinkRewardsReports } from '@/components/admin/DrinkRewardsReports';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'تقارير الحملات والعروض المصروفة | Coffee Bay Admin',
  description: 'لوحة تقارير وإحصائيات تشغيلية لحركة صرف قسائم المشروبات المجانية في كوفي باي.',
};

export default async function DrinkReportsPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect('/admin/login');
  }

  if (!isSuperAdmin(user) && !isPromotionsAdmin(user)) {
    redirect('/admin');
  }

  return (
    <div className="py-6 px-4 sm:px-6">
      <DrinkRewardsReports />
    </div>
  );
}
