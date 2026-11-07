import { cache } from "react";
import { cookies } from "next/headers";
import {
  drinkCampaignService,
  type PublicCampaignData,
} from "../../../../services/drink-rewards/drink-campaign-service";
import {
  drinkOtpService,
  type ResolvedRewardJourneyState,
} from "../../../../services/drink-rewards/drink-otp-service";

export interface LoadedCampaignJourney {
  campaign: PublicCampaignData | null;
  journey: ResolvedRewardJourneyState | null;
}

/**
 * Request-scoped deduplicated loader (`React.cache`).
 * Ensures `layout.tsx` and the active stage `page.tsx` share a single
 * campaign lookup (from Next.js tag cache, zero TTL) and a single PostgreSQL
 * session verification check per HTTP request.
 */
export const loadCampaignJourneyForRequest = cache(
  async (slug: string): Promise<LoadedCampaignJourney> => {
    const normalizedSlug = slug.trim();
    const campaign =
      await drinkCampaignService.getPublicCampaignWithMenu(normalizedSlug);

    if (!campaign) {
      return { campaign: null, journey: null };
    }

    const cookieStore = await cookies();
    const cookieName = drinkOtpService.getJourneyCookieName(campaign.slug);
    const rawCookie = cookieStore.get(cookieName)?.value;

    const journey = await drinkOtpService.resolveJourneyState(
      {
        id: campaign.id,
        slug: campaign.slug,
        title: campaign.title,
      },
      rawCookie,
    );

    return { campaign, journey };
  },
);

