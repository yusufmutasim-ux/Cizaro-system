"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "./Avatar";
import type { User } from "@/lib/client";

export function Nav({ me, children }: { me: User; children?: React.ReactNode }) {
  const path = usePathname();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/login";
  }
  return (
    <header className="nav">
      <div className="wrap">
        <div className="brand"><span className="brand-mark">C</span><span>Cizaro <small>Studio</small></span></div>
        <nav className="nav-links">
          <Link href="/" aria-current={path === "/" ? "page" : undefined}>التاسكات</Link>
          {me.role === "MANAGER" && <Link href="/team" aria-current={path === "/team" ? "page" : undefined}>الفريق</Link>}
          <button type="button" onClick={logout}>خروج</button>
        </nav>
        {children ?? <span style={{ marginInlineStart: "auto" }} />}
        <Avatar user={me} className="me" />
      </div>
    </header>
  );
}
