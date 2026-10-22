import { prisma } from "./db";
import { brandDTO } from "./brands";

export async function allBrands() {
  const rows = await prisma.brand.findMany({
    orderBy: [{ sort: "asc" }, { createdAt: "asc" }],
    include: { files: { where: { kind: "logo" }, orderBy: { createdAt: "asc" }, take: 1 }, _count: { select: { designs: { where: { archived: false } }, campaigns: true } } },
  });
  return rows.map(brandDTO);
}
