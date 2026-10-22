import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { BrandBookSchema, brandBrief, parseBook, type BrandBook } from "./brand";
import { client, MODEL, brandAssets } from "./designer";
import { getConfig } from "./settings";
import { prisma } from "./db";
import { readStored } from "./storage";
import { forVision } from "./vision";

const BETAS: Anthropic.Beta.AnthropicBeta[] = ["server-side-fallback-2026-07-01"];

function explain(err: unknown): never {
  if (err instanceof Anthropic.AuthenticationError) throw new Error("مفتاح Claude API مش صحيح — راجعه في الإعدادات");
  if (err instanceof Anthropic.RateLimitError) throw new Error("فيه ضغط على Claude دلوقتي، جرّب كمان دقيقة");
  if (err instanceof Anthropic.APIError) throw new Error(`Claude: ${err.message}`);
  throw err;
}

/** Reads uploaded brand guidelines (PDFs, images) and fills in the brand book. Existing values are kept unless the files say otherwise. */
export async function extractBrandBook(brandId: string, fileIds: string[], extra: string): Promise<BrandBook> {
  const cfg = await getConfig();
  const brand = await prisma.brand.findUniqueOrThrow({ where: { id: brandId } });
  const files = await prisma.brandFile.findMany({ where: { brandId, id: { in: fileIds } } });
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const f of files) {
    const buf = await readStored(f.storageKey).catch(() => null);
    if (!buf) continue;
    if (f.mime === "application/pdf") {
      if (buf.length > 30 * 1024 * 1024) continue;
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") }, title: f.name });
    } else if (/^image\/(png|jpeg|webp|gif)$/.test(f.mime)) {
      content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: await forVision(buf) } });
    }
  }
  if (!content.length && !extra.trim()) throw new Error("ارفع ملف جايدلاين (PDF أو صور) أو اكتب وصف للبراند");
  content.push({
    type: "text",
    text: `Build the brand book for "${brand.name}" from the material above${extra.trim() ? " and these notes from the user:\n" + extra.trim() : ""}.

Current brand book (keep what is already filled unless the material clearly says otherwise):
${JSON.stringify(parseBook(brand.book))}

Be specific and practical — these rules will steer an AI designer making ads. Colors: exact HEX values with a role. Leave a field empty rather than inventing facts; for style fields you may infer from the visuals. Write dos/donts one rule per line. Write the fields in the language the material uses (Arabic or English).`,
  });

  try {
    const res = await client(cfg).beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: BETAS,
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(BrandBookSchema) },
      messages: [{ role: "user", content }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("مقدرتش أقرا الملفات، جرّب ملف تاني");
    return parseBook(JSON.stringify(res.parsed_output));
  } catch (e) { explain(e); }
}

export const CheckSchema = z.object({
  score: z.number().describe("0-100: how well the design follows the brand book and works as an ad"),
  verdict: z.enum(["approved", "needs_changes", "off_brand"]),
  summary: z.string().describe("One or two sentences, in the user's language (Arabic if the brand copy is Arabic)"),
  checks: z.array(z.object({
    area: z.string().describe("e.g. Colors, Typography, Logo, Tone of voice, Imagery, Layout & hierarchy, CTA, Legibility, Placement safe zones"),
    pass: z.boolean(),
    note: z.string(),
  })),
  fixes: z.array(z.string()).describe("Concrete changes, most important first"),
});
export type Check = z.infer<typeof CheckSchema>;

/** Reviews a finished, composed ad (PNG from the editor) against the brand book. */
export async function checkDesign(designId: string, png: Buffer): Promise<Check> {
  const cfg = await getConfig();
  const d = await prisma.design.findUniqueOrThrow({ where: { id: designId }, include: { brand: true } });
  const brief = brandBrief(d.brand.name, parseBook(d.brand.book), await brandAssets(d.brandId, cfg));
  const logos = await prisma.brandFile.findMany({ where: { brandId: d.brandId, kind: "logo", mime: { in: ["image/png", "image/jpeg", "image/webp"] } }, take: 1 });
  const logoBlocks: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const l of logos) {
    const buf = await readStored(l.storageKey).catch(() => null);
    if (buf) logoBlocks.push({ type: "text", text: "The official logo:" }, { type: "image", source: { type: "base64", media_type: "image/jpeg", data: await forVision(buf) } });
  }
  try {
    const res = await client(cfg).beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: BETAS,
      fallbacks: "default",
      output_config: { effort: "high", format: betaZodOutputFormat(CheckSchema) },
      system: [{ type: "text", text: "You are a strict brand guardian and senior art director reviewing an ad before it goes live. Judge it against the brand book and against ad craft (hierarchy, legibility, hook, CTA clarity, placement safe zones). Be concrete and fair." }, { type: "text", text: brief }],
      messages: [{
        role: "user",
        content: [
          ...logoBlocks,
          { type: "text", text: `The ad to review — "${d.title}" (${d.format}, ${d.placement || "social"}):` },
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: await forVision(png) } },
          { type: "text", text: `Copy on it — headline: ${d.headline}\nsubheadline: ${d.subheadline}\nCTA: ${d.cta}\nCaption: ${d.caption}` },
        ],
      }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("مقدرتش أراجع التصميم ده");
    const out = res.parsed_output;
    return { ...out, score: Math.max(0, Math.min(100, Math.round(out.score))) };
  } catch (e) { explain(e); }
}
