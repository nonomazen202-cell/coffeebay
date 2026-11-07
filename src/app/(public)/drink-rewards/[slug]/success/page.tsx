import React from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { drinkOtpService } from "../../../../../services/drink-rewards/drink-otp-service";
import { SuccessStepClient } from "../../../../../components/drink-rewards/steps/SuccessStepClient";
import { loadCampaignJourneyForRequest } from "../journey-loader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface SuccessPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: SuccessPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { campaign } = await loadCampaignJourneyForRequest(slug);
  if (!campaign) {
    return { title: "Your Free Drink Voucher | Coffee Bay" };
  }
  return {
    title: `Your Free Drink Voucher — ${campaign.title} | Coffee Bay`,
  };
}

export default async function DrinkRewardSuccessStagePage({
  params,
}: SuccessPageProps) {
  const { slug } = await params;
  const { campaign, journey } = await loadCampaignJourneyForRequest(slug);

  if (!campaign || !journey) {
    return notFound();
  }

  const access = drinkOtpService.evaluateRouteAccess(
    campaign.slug,
    "SUCCESS",
    journey,
  );

  if (!access.allowed) {
    return redirect(access.redirectTo);
  }

  return (
    <SuccessStepClient serverCampaign={campaign} serverJourney={journey} />
  );
}

