import React from "react";
import { notFound, redirect } from "next/navigation";
import { drinkOtpService } from "../../../../services/drink-rewards/drink-otp-service";
import type { RootSubView } from "../../../../components/drink-rewards/CustomerDrinkRewardsFlow";
import { DetailsStepClient } from "../../../../components/drink-rewards/steps/DetailsStepClient";
import { loadCampaignJourneyForRequest } from "./journey-loader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ step?: string; welcome?: string }>;
}

export default async function DrinkRewardDetailsStagePage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const resolvedSearch = await searchParams;
  const { campaign, journey } = await loadCampaignJourneyForRequest(slug);

  if (!campaign || !journey) {
    return notFound();
  }

  const isExplicitWelcome = resolvedSearch.welcome === "1";

  const access = drinkOtpService.evaluateRouteAccess(
    campaign.slug,
    "DETAILS",
    journey,
    { allowWelcomeWhenClaimed: isExplicitWelcome },
  );

  if (!access.allowed) {
    return redirect(access.redirectTo);
  }

  const initialView: RootSubView = isExplicitWelcome
    ? "HERO"
    : resolvedSearch.step === "details" || journey.stage !== "UNINITIALIZED"
      ? "REGISTER"
      : "HERO";

  return (
    <DetailsStepClient
      serverCampaign={campaign}
      serverJourney={journey}
      initialView={initialView}
    />
  );
}
