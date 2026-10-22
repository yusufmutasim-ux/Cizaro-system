import { prisma } from "@/lib/db";
import { route, json, type Params } from "@/lib/api";
import { designDTO, campaignDTO } from "@/lib/dto";

export const GET = route<Params>(async (_r, { params }) => {
  const brandId = (await params).id;
  const [designs, campaigns] = await Promise.all([
    prisma.design.findMany({ where: { brandId, archived: false }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.campaign.findMany({ where: { brandId }, orderBy: { createdAt: "desc" }, include: { _count: { select: { designs: { where: { archived: false } } } } } }),
  ]);
  return json({ designs: designs.map(designDTO), campaigns: campaigns.map(campaignDTO) });
});
