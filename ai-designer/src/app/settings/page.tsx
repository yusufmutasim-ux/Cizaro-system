import { allBrands } from "@/lib/queries";
import { authEnabled } from "@/lib/auth";
import Settings from "@/components/Settings";

export const dynamic = "force-dynamic";

export default async function Page() {
  return <Settings brands={await allBrands()} auth={authEnabled()} />;
}
