import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import Team from "@/components/Team";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "MANAGER") redirect("/");
  return <Team me={me} />;
}
