import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import Studio from "@/components/Studio";

export const dynamic = "force-dynamic";

export default async function Home() {
  const me = await currentUser();
  if (!me) redirect("/login");
  return <Studio me={me} />;
}
