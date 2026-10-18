"use client";
import { useEffect } from "react";
import type { Brand } from "@/lib/client";

type B = Pick<Brand, "name" | "color" | "logoId"> & { slug?: string };

/** Square brand mark: uploaded logo, else the built-in identity for known brands, else the initial on the brand color. */
export function BrandMark({ brand, size = 24 }: { brand: B; size?: number }) {
  const style = { width: size, height: size, borderRadius: size * 0.28, fontSize: size * 0.48 };
  if (brand.logoId) return <img className="bmark" src={`/api/brand-assets/${brand.logoId}`} alt="" style={{ ...style, objectFit: "contain" }} />;
  if (brand.slug === "cizaro") return <img className="bmark" src="/brands/cizaro-mark.svg" alt="" style={style} />;
  if (brand.slug === "dym") return (
    <span className="dym-word" style={{ height: size * 0.62 }}>
      <img className="on-light" src="/brands/dym-wordmark.png" alt="" /><img className="on-dark" src="/brands/dym-wordmark-white.png" alt="" />
    </span>
  );
  return <span className="bmark" style={{ ...style, background: brand.color }}>{brand.name.trim()[0]?.toUpperCase()}</span>;
}

/** Large brand signature for page headers. */
export function BrandSignature({ brand }: { brand: B }) {
  if (brand.slug === "dym") return <span className="brand-sig dym"><img className="on-light" src="/brands/dym-wordmark.png" alt="DYM" /><img className="on-dark" src="/brands/dym-wordmark-white.png" alt="" /><em>Wear your mood</em></span>;
  return <span className="brand-sig"><BrandMark brand={brand} size={26} /><b>{brand.name}</b></span>;
}

const THEMED = ["cizaro", "dym"];

/** Applies a brand's identity to the whole app (tokens live in globals.css under [data-brand]). */
export function useBrandTheme(brand: B | null | undefined) {
  useEffect(() => {
    const root = document.documentElement;
    const slug = brand?.slug && THEMED.includes(brand.slug) ? brand.slug : brand ? "custom" : "cizaro";
    root.dataset.brand = slug;
    if (slug === "custom" && brand) root.style.setProperty("--brand-custom", brand.color);
    else root.style.removeProperty("--brand-custom");
  }, [brand?.slug, brand?.color, brand]);
}
