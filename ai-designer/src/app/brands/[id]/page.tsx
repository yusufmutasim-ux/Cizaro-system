import { notFound } from "next/navigation";
import { allBrands } from "@/lib/queries";
import { getConfig } from "@/lib/settings";
import Workspace from "@/components/Workspace";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [brands, cfg] = await Promise.all([allBrands(), getConfig()]);
  const brand = brands.find((b) => b.id === id);
  if (!brand) notFound();
  return <Workspace brands={brands} brand={brand} ready={{ claude: !!cfg.anthropicKey, mcp: !!cfg.mcpUrl, publicUrl: !!cfg.appUrl }} />;
}
