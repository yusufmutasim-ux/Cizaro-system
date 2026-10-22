import type { Design, Campaign } from "@prisma/client";
import { parseLayout } from "./brand";
import type { Check } from "./review";

export function designDTO(d: Design) {
  let check: (Check & { at?: string }) | null = null;
  try { check = d.check ? JSON.parse(d.check) : null; } catch {}
  return {
    id: d.id, brandId: d.brandId, chatId: d.chatId, campaignId: d.campaignId, title: d.title, format: d.format, placement: d.placement,
    headline: d.headline, subheadline: d.subheadline, cta: d.cta, caption: d.caption, hashtags: d.hashtags,
    imagePrompt: d.imagePrompt, rationale: d.rationale, sourceUrl: d.sourceUrl,
    image: d.imageKey ? `/api/designs/${d.id}/image?v=${d.updatedAt.getTime()}` : null,
    layout: parseLayout(d.layout), check, favorite: d.favorite, createdAt: d.createdAt.toISOString(),
  };
}
export type DesignDTO = ReturnType<typeof designDTO>;

export function campaignDTO(c: Campaign & { _count?: { designs: number } }) {
  let plan: Record<string, string> = {};
  try { plan = JSON.parse(c.plan); } catch {}
  return { id: c.id, brandId: c.brandId, chatId: c.chatId, name: c.name, bigIdea: c.bigIdea, plan, designs: c._count?.designs ?? 0, createdAt: c.createdAt.toISOString() };
}
export type CampaignDTO = ReturnType<typeof campaignDTO>;
