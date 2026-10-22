import type { BrandDTO } from "@/lib/client";

export function BrandMark({ brand, size = 24 }: { brand: Pick<BrandDTO, "name" | "color" | "logo">; size?: number }) {
  return (
    <span className="bmark" style={{ width: size, height: size, borderRadius: size * 0.3, fontSize: size * 0.45, ["--bc" as string]: brand.color }}>
      {brand.logo ? <img src={brand.logo} alt="" /> : brand.name.trim()[0]?.toUpperCase()}
    </span>
  );
}

export function Palette({ colors }: { colors: { hex: string }[] }) {
  if (!colors.length) return null;
  return <div className="palette-strip">{colors.map((c, i) => <span key={i} style={{ background: c.hex }} />)}</div>;
}
