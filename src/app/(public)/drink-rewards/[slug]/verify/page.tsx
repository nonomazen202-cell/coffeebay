import React from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { drinkOtpService } from "../../../../../services/drink-rewards/drink-otp-service";
import { VerifyStepClient } from "../../../../../components/drink-rewards/steps/VerifyStepClient";
import { loadCampaignJourneyForRequest } from "../journey-loader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface VerifyPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: VerifyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { campaign } = await loadCampaignJourneyForRequest(slug);
  if (!campaign) {
    return { title: "Verify Phone | Coffee Bay" };
  }
  return {
    title: `Verify Phone — ${campaign.title} | Coffee Bay`,
  };
}

export default async function DrinkRewardVerifyStagePage({
  params,
}: VerifyPageProps) {
  const { slug } = await params;
  const { campaign, journey } = await loadCampaignJourneyForRequest(slug);

  if (!campaign || !journey) {
    return notFound();
  }

  const access = drinkOtpService.evaluateRouteAccess(
    campaign.slug,
    "VERIFY",
    journey,
  );

  if (!access.allowed) {
    return redirect(access.redirectTo);
  }

  return <VerifyStepClient serverCampaign={campaign} serverJourney={journey} />;
}

