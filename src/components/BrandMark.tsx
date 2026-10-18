"use client";
import type { Brand } from "@/lib/client";

/** The brand's uploaded logo, or its initial on the brand color. */
export function BrandMark({ brand, size = 24 }: { brand: Pick<Brand, "name" | "color" | "logoId">; size?: number }) {
  const style = { width: size, height: size, borderRadius: size * 0.28, fontSize: size * 0.48 };
  if (brand.logoId) return <img className="bmark" src={`/api/brand-assets/${brand.logoId}`} alt="" style={{ ...style, objectFit: "contain" }} />;
  return <span className="bmark" style={{ ...style, background: brand.color }}>{brand.name.trim()[0]?.toUpperCase()}</span>;
}
