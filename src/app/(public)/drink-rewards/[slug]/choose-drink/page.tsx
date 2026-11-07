import React from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { drinkOtpService } from "../../../../../services/drink-rewards/drink-otp-service";
import { ChooseDrinkStepClient } from "../../../../../components/drink-rewards/steps/ChooseDrinkStepClient";
import { loadCampaignJourneyForRequest } from "../journey-loader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ChooseDrinkPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ChooseDrinkPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { campaign } = await loadCampaignJourneyForRequest(slug);
  if (!campaign) {
    return { title: "Choose Your Drink | Coffee Bay" };
  }
  return {
    title: `Choose Your Drink — ${campaign.title} | Coffee Bay`,
  };
}

export default async function DrinkRewardChooseDrinkStagePage({
  params,
}: ChooseDrinkPageProps) {
  const { slug } = await params;
  const { campaign, journey } = await loadCampaignJourneyForRequest(slug);

  if (!campaign || !journey) {
    return notFound();
  }

  const access = drinkOtpService.evaluateRouteAccess(
    campaign.slug,
    "CHOOSE_DRINK",
    journey,
  );

  if (!access.allowed) {
    return redirect(access.redirectTo);
  }

  return (
    <ChooseDrinkStepClient
      serverCampaign={campaign}
      serverJourney={journey}
    />
  );
}

