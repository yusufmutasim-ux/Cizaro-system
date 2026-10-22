"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type BrandDTO } from "@/lib/client";
import { BrandMark } from "./BrandMark";
import { I } from "./Icons";

/** Every brand gets its own tab across the top. */
export function TopBar({ current, brands: initial }: { current?: string; brands?: BrandDTO[] }) {
  const [brands, setBrands] = useState<BrandDTO[]>(initial ?? []);
  useEffect(() => { if (!initial) api<BrandDTO[]>("/api/brands").then(setBrands).catch(() => {}); }, [initial]);
  useEffect(() => { if (initial) setBrands(initial); }, [initial]);
  return (
    <header className="topbar">
      <Link href="/" className="logo"><span className="logo-mark" /><span>Studio AI</span></Link>
      <nav className="brand-tabs" aria-label="البراندات">
        {brands.map((b) => (
          <Link key={b.id} href={`/brands/${b.id}`} className="brand-tab" aria-current={b.id === current ? "page" : undefined} style={{ ["--bc" as string]: b.color }}>
            <BrandMark brand={b} size={24} />{b.name}
          </Link>
        ))}
        <Link href="/?new=1" className="brand-tab" title="براند جديد"><I name="plus" /></Link>
      </nav>
      <Link href="/settings" className="btn ghost icon" aria-label="الإعدادات"><I name="gear" /></Link>
    </header>
  );
}
