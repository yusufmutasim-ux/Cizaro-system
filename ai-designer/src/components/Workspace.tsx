"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { api, type BrandDTO, type FileDTO } from "@/lib/client";
import { TopBar } from "./TopBar";
import { BrandMark } from "./BrandMark";
import { I } from "./Icons";
import Studio from "./Studio";
import Library from "./Library";
import BrandBookEditor from "./BrandBookEditor";
import { BrandCtx, type Ready } from "./BrandCtx";

type Tab = "studio" | "library" | "book";

export default function Workspace(props: { brands: BrandDTO[]; brand: BrandDTO; ready: Ready }) {
  return <Suspense><Inner {...props} /></Suspense>;
}

function Inner({ brands: initialBrands, brand: initial, ready }: { brands: BrandDTO[]; brand: BrandDTO; ready: Ready }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [brand, setBrand] = useState(initial);
  const [brands, setBrands] = useState(initialBrands);
  const [files, setFiles] = useState<FileDTO[]>([]);
  const tab = (["studio", "library", "book"].includes(sp.get("tab") ?? "") ? sp.get("tab") : "studio") as Tab;
  const [toast, setToast] = useState("");

  useEffect(() => { setBrand(initial); setBrands(initialBrands); }, [initial, initialBrands]);
  const reloadFiles = useCallback(() => api<FileDTO[]>(`/api/brands/${initial.id}/files`).then(setFiles).catch(() => {}), [initial.id]);
  useEffect(() => { reloadFiles(); }, [reloadFiles]);

  const say = useCallback((m: string) => { setToast(m); setTimeout(() => setToast((t) => (t === m ? "" : t)), 2600); }, []);
  const updateBrand = useCallback((b: BrandDTO) => { setBrand(b); setBrands((bs) => bs.map((x) => (x.id === b.id ? b : x))); }, []);
  const go = (t: Tab) => router.replace(`/brands/${brand.id}${t === "studio" ? "" : `?tab=${t}`}`, { scroll: false });

  return (
    <BrandCtx.Provider value={{ brand, files, reloadFiles, updateBrand, ready, say }}>
      <div style={uiAccent(brand.color)}>
        <TopBar current={brand.id} brands={brands} />
        <div className="ws-head">
          <BrandMark brand={brand} size={40} />
          <div>
            <h1>{brand.name}</h1>
            <div className="muted" style={{ fontSize: 13 }}>{brand.book.tagline || "مصمم البراند جاهز"}</div>
          </div>
          <div className="sections" role="tablist">
            <button type="button" aria-pressed={tab === "studio"} onClick={() => go("studio")}><I name="chat" />الاستوديو</button>
            <button type="button" aria-pressed={tab === "library"} onClick={() => go("library")}><I name="grid" />المكتبة</button>
            <button type="button" aria-pressed={tab === "book"} onClick={() => go("book")}><I name="book" />البراند بوك</button>
          </div>
        </div>
        {tab === "studio" && <Studio key={brand.id} />}
        {tab === "library" && <Library key={brand.id} />}
        {tab === "book" && <BrandBookEditor key={brand.id} />}
        <div className={`toast ${toast ? "on" : ""}`} role="status" aria-live="polite">{toast}</div>
      </div>
    </BrandCtx.Provider>
  );
}

/** The brand color as the UI accent: lightened when too dark for the dark UI, with readable text on top. */
function uiAccent(hex: string): React.CSSProperties {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  const dark = lum < 0.35;
  return { ["--accent" as string]: dark ? `color-mix(in srgb, ${hex} 55%, #ffffff)` : hex, ["--accent-ink" as string]: dark || lum > 0.62 ? "#0b0b10" : "#ffffff" };
}
