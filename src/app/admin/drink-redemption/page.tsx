import React from "react";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/security/auth-helper";
import { hasPromotionsAccess } from "@/lib/security/roles";
import { drinkRedemptionService } from "@/services/drink-rewards/drink-redemption-service";
import { CashierDrinkTerminal } from "@/components/admin/CashierDrinkTerminal";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Drink Redemption Terminal | Coffee Bay Admin",
  description:
    "Cashier Terminal for verifying and dispensing complimentary drink reward vouchers.",
};

export default async function DrinkRedemptionPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/admin/login");
  }

  if (!hasPromotionsAccess(user)) {
    redirect("/admin");
  }

  // Fetch initial cashier profile and dashboard metrics directly on the server
  // Eliminates client-side fetch waterfall and prevents visual flash/disappearing data
  const initialData =
    await drinkRedemptionService.getCashierDashboardData(user);

  return (
    <div className="py-6 px-4 sm:px-6">
      <CashierDrinkTerminal initialData={initialData ?? undefined} />
    </div>
  );
}
