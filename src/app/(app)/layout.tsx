import { redirect } from "next/navigation";
import { currentUser, storageAtRisk } from "@/lib/auth";
import { AppProvider } from "@/components/App";

// Signed-in area. The frame (bars, tab bar) lives here so it stays mounted while pages change.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await currentUser();
  if (!me) redirect("/login");
  return <AppProvider me={me} storageWarning={me.role === "MANAGER" && storageAtRisk()}>{children}</AppProvider>;
}
