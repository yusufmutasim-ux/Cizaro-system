import { z } from "zod";

// The brand book: everything the designer must follow for one brand.
export const ColorSchema = z.object({
  name: z.string().describe("Color name, e.g. Midnight Navy"),
  hex: z.string().describe("#RRGGBB"),
  role: z.enum(["primary", "secondary", "accent", "background", "text", "other"]).describe("How the color is used"),
});

export const BrandBookSchema = z.object({
  tagline: z.string().describe("Slogan / tagline, empty if none"),
  description: z.string().describe("What the brand is and sells, 1-3 sentences"),
  industry: z.string(),
  audience: z.string().describe("Target audience: who, age, market, lifestyle"),
  markets: z.string().describe("Countries / cities / dialect, e.g. Egypt, Egyptian Arabic"),
  personality: z.string().describe("Brand personality adjectives"),
  toneOfVoice: z.string().describe("How copy should sound"),
  languages: z.string().describe("Copy languages and dialect, e.g. Egyptian Arabic + English"),
  colors: z.array(ColorSchema),
  headingFont: z.string().describe("Heading typeface name"),
  bodyFont: z.string().describe("Body typeface name"),
  visualStyle: z.string().describe("Overall look: mood, lighting, composition, art direction"),
  photography: z.string().describe("Photography / imagery rules: subjects, models, settings, styling, color grading"),
  logoRules: z.string().describe("Logo usage: placement, clear space, versions on light/dark"),
  layoutRules: z.string().describe("Layout and typography rules for ads"),
  ctaStyle: z.string().describe("Typical calls to action"),
  dos: z.string().describe("Always do — one per line"),
  donts: z.string().describe("Never do — one per line"),
  hashtags: z.string(),
  competitors: z.string().describe("Competitors and how to stand apart"),
  notes: z.string().describe("Anything else"),
});
export type BrandBook = z.infer<typeof BrandBookSchema>;
export type BrandColor = z.infer<typeof ColorSchema>;

export const emptyBook = (): BrandBook => ({
  tagline: "", description: "", industry: "", audience: "", markets: "", personality: "", toneOfVoice: "", languages: "",
  colors: [], headingFont: "", bodyFont: "", visualStyle: "", photography: "", logoRules: "", layoutRules: "", ctaStyle: "",
  dos: "", donts: "", hashtags: "", competitors: "", notes: "",
});

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Reads a stored brand book, tolerating old or partial JSON. */
export function parseBook(raw: string | null | undefined): BrandBook {
  const base = emptyBook();
  let v: Record<string, unknown> = {};
  try { v = JSON.parse(raw || "{}"); } catch {}
  for (const k of Object.keys(base) as (keyof BrandBook)[]) {
    if (k === "colors") continue;
    if (typeof v[k] === "string") (base[k] as string) = (v[k] as string).slice(0, 4000);
  }
  if (Array.isArray(v.colors)) {
    base.colors = v.colors
      .filter((c): c is BrandColor => !!c && typeof c === "object" && HEX.test((c as BrandColor).hex))
      .slice(0, 16)
      .map((c) => ({ name: String(c.name || c.hex).slice(0, 60), hex: c.hex.toUpperCase(), role: ColorSchema.shape.role.safeParse(c.role).success ? c.role : "other" }));
  }
  return base;
}

export const BOOK_LABELS: Record<Exclude<keyof BrandBook, "colors">, string> = {
  tagline: "Tagline",
  description: "About the brand",
  industry: "Industry",
  audience: "Target audience",
  markets: "Markets",
  personality: "Personality",
  toneOfVoice: "Tone of voice",
  languages: "Copy languages",
  headingFont: "Heading font",
  bodyFont: "Body font",
  visualStyle: "Visual style",
  photography: "Photography & imagery",
  logoRules: "Logo rules",
  layoutRules: "Layout & typography rules",
  ctaStyle: "Calls to action",
  dos: "ALWAYS",
  donts: "NEVER",
  hashtags: "Hashtags",
  competitors: "Competitors",
  notes: "Other notes",
};

export type BrandAssetLink = { id: string; kind: string; name: string; url: string | null };

/** The brand section of the system prompt. Deterministic for a given brand so prompt caching holds. */
export function brandBrief(name: string, book: BrandBook, assets: BrandAssetLink[]) {
  const lines = [`# BRAND: ${name}`, ""];
  for (const [k, label] of Object.entries(BOOK_LABELS) as [Exclude<keyof BrandBook, "colors">, string][]) {
    const v = book[k].trim();
    if (v) lines.push(`## ${label}`, v, "");
  }
  if (book.colors.length) {
    lines.push("## Color palette (the ONLY colors allowed for type, shapes and overlays)");
    for (const c of book.colors) lines.push(`- ${c.hex} — ${c.name} (${c.role})`);
    lines.push("");
  }
  const refs = assets.filter((a) => a.kind !== "attachment" && a.kind !== "font" && a.kind !== "guideline");
  if (refs.length) {
    lines.push("## Brand image assets");
    for (const a of refs) lines.push(`- [${a.kind}] ${a.name}${a.url ? ` — public URL: ${a.url}` : " — (no public URL; app not deployed with APP_URL)"}`);
    lines.push("");
  }
  if (lines.length <= 2) lines.push("(The brand book is still empty. Ask the user for the essentials — audience, tone, colors — before committing to final designs, or make sensible, clearly stated assumptions.)");
  return lines.join("\n");
}

export const FORMATS = {
  "1:1": { w: 1080, h: 1080, label: "Square 1:1" },
  "4:5": { w: 1080, h: 1350, label: "Portrait 4:5" },
  "9:16": { w: 1080, h: 1920, label: "Story / Reel 9:16" },
  "16:9": { w: 1920, h: 1080, label: "Landscape 16:9" },
} as const;
export type Format = keyof typeof FORMATS;

export const LAYOUTS = ["bottom", "top", "center", "split", "minimal", "clean"] as const;
export const LOGO_POSITIONS = ["top-left", "top-right", "bottom-left", "bottom-right", "none"] as const;
export type Layout = { preset: (typeof LAYOUTS)[number]; textColor: string; accentColor: string; logoPosition: (typeof LOGO_POSITIONS)[number] };

export function parseLayout(raw: string | null | undefined, book?: BrandBook): Layout {
  let v: Partial<Layout> = {};
  try { v = JSON.parse(raw || "{}"); } catch {}
  const primary = book?.colors.find((c) => c.role === "primary")?.hex ?? book?.colors[0]?.hex ?? "#6D5EFC";
  return {
    preset: LAYOUTS.includes(v.preset as Layout["preset"]) ? v.preset! : "bottom",
    textColor: HEX.test(v.textColor ?? "") ? v.textColor! : "#FFFFFF",
    accentColor: HEX.test(v.accentColor ?? "") ? v.accentColor! : primary,
    logoPosition: LOGO_POSITIONS.includes(v.logoPosition as Layout["logoPosition"]) ? v.logoPosition! : "top-right",
  };
}
