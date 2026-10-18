import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser, storageAtRisk } from "@/lib/auth";
import Studio from "@/components/Studio";

export const dynamic = "force-dynamic";

export default async function Home() {
  const me = await currentUser();
  if (!me) redirect("/login");
  return <Suspense><Studio me={me} storageWarning={me.role === "MANAGER" && storageAtRisk()} /></Suspense>;
}
