import React from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DrinkRewardsJourneyShell } from "../../../../components/drink-rewards/CustomerDrinkRewardsFlow";
import { loadCampaignJourneyForRequest } from "./journey-loader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { campaign } = await loadCampaignJourneyForRequest(slug);

  if (!campaign) {
    return {
      title: "عرض غير متوفر | Coffee Bay",
    };
  }

  return {
    title: `${campaign.title} | Coffee Bay Drink Rewards`,
    description:
      campaign.description || "احصل على مشروبك المجاني المفضل من كوفي باي.",
  };
}

export default async function DrinkRewardCampaignLayout({
  children,
  params,
}: LayoutProps) {
  const { slug } = await params;
  const { campaign, journey } = await loadCampaignJourneyForRequest(slug);

  if (!campaign || !journey) {
    return notFound();
  }

  const hasIssuedVoucherForBrowser =
    journey.stage === "CLAIMED" && journey.voucher !== null;

  const isBlockedForVisitor =
    !campaign.active ||
    !campaign.hasStarted ||
    campaign.isExpired ||
    (campaign.isExhausted && !hasIssuedVoucherForBrowser);

  if (isBlockedForVisitor) {
    const isExpired = campaign.isExpired;
    const isExhausted = campaign.isExhausted;
    const hasNotStarted = campaign.active && !campaign.hasStarted;

    return (
      <main
        dir="rtl"
        className="relative min-h-screen bg-[#070420] text-white flex items-center justify-center p-4 overflow-hidden selection:bg-sky-500/30 selection:text-white"
      >
        <div className="absolute inset-0 pointer-events-none z-0">
          <Image
            src="/drink-rewards/cosmic-bg.png"
            alt="Coffee Bay Background"
            fill
            priority
            className="object-cover object-center opacity-40 mix-blend-screen"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#070420]/80 via-[#0A052E]/90 to-[#070420]" />
        </div>

        <div className="relative z-10 max-w-md w-full text-center p-8 sm:p-10 rounded-3xl bg-[#0C0738]/80 border border-sky-400/30 shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_30px_rgba(56,189,248,0.2)] backdrop-blur-2xl space-y-5">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-sky-500/10 border border-sky-400/40 text-sky-400 flex items-center justify-center shadow-[0_0_20px_rgba(56,189,248,0.3)]">
            {isExpired || hasNotStarted ? (
              <svg
                className="w-8 h-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ) : (
              <svg
                className="w-8 h-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            )}
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white">{campaign.title}</h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              {isExpired
                ? "عذراً، لقد انتهت صلاحية هذا العرض الترويجي."
                : hasNotStarted
                  ? "هذا العرض لم يبدأ بعد. ترقبوا الافتتاح قريباً!"
                  : isExhausted
                    ? "عذراً، اكتمل الحد الأقصى للمشروبات المجانية المخصصة لهذا العرض."
                    : "عذراً، هذا العرض غير مفعل حالياً من قبل الإدارة."}
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-colors shadow-lg shadow-sky-600/30"
            >
              Back to Coffee Bay
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <DrinkRewardsJourneyShell campaign={campaign} initialJourney={journey}>
      {children}
    </DrinkRewardsJourneyShell>
  );
}

