import { allBrands } from "@/lib/queries";
import { getConfig } from "@/lib/settings";
import Home from "@/components/Home";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [brands, cfg] = await Promise.all([allBrands(), getConfig()]);
  return <Home brands={brands} ready={{ claude: !!cfg.anthropicKey, mcp: !!cfg.mcpUrl }} />;
}
