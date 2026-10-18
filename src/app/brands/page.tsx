import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import BrandKit from "@/components/BrandKit";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  return <BrandKit me={me} />;
}
