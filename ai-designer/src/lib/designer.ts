import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { prisma } from "./db";
import { getConfig, type Config } from "./settings";
import { brandBrief, parseBook, FORMATS, LAYOUTS, LOGO_POSITIONS, type BrandAssetLink } from "./brand";
import { fileToken } from "./auth";
import { downloadImage, readStored } from "./storage";
import { forVision } from "./vision";
import { designDTO } from "./dto";

export const MODEL = "claude-opus-5-5";
const MCP_NAME = "higgsfield";
const BETAS: Anthropic.Beta.AnthropicBeta[] = ["mcp-client-2025-11-20", "server-side-fallback-2026-07-01"];
const MAX_STEPS = 16;

export function client(cfg: Config) {
  if (!cfg.anthropicKey) throw new Error("Add your Claude API key in Settings first");
  return new Anthropic({ apiKey: cfg.anthropicKey });
}

export const mcpServers = (cfg: Config): Anthropic.Beta.BetaRequestMCPServerURLDefinition[] =>
  cfg.mcpUrl ? [{ type: "url", url: cfg.mcpUrl, name: MCP_NAME, ...(cfg.mcpToken ? { authorization_token: cfg.mcpToken } : {}) }] : [];

// ---------- the designer's standing instructions ----------

const PERSONA = `You are the senior in-house creative team for one brand: art director, graphic designer, copywriter and performance-marketing (media buying) strategist in one. You work inside a design app. The user briefs you; you deliver finished, on-brand ads, social posts, key visuals and full campaigns.

# How you work
1. Read the brief. If something essential is missing and can't be reasonably assumed (product, offer, goal), ask at most 2-3 short questions. Otherwise go ahead and state your assumptions in one line.
2. Concept: one sharp idea per design, with a clear hook that lands in the first second of a scroll.
3. Copy: headline (max ~7 words), optional subheadline, CTA (1-3 words), and a ready-to-post caption with hashtags. Write in the brand's language and dialect, natively — never translated-sounding. Arabic copy should read naturally to the brand's market.
4. Visual: generate the image with the image tools (Higgsfield), then deliver everything with the present_designs tool. Every deliverable ends in a present_designs call — never only describe a design in text.

# The brand book is law
The brand section below is binding. Use only the brand palette for type, shapes, overlays and dominant tones in the imagery; respect the tone of voice, the photography style, the logo rules and every ALWAYS / NEVER line. If the user asks for something that breaks the brand, say so briefly and offer the closest on-brand option. Before presenting, check each design against the brand book; fix anything off.

# Generating visuals
- The app composes the final ad: it lays the headline, subheadline, CTA and the real logo over your visual using the brand fonts and colors. So generated visuals must contain NO text, letters, numbers, logos or watermarks — unless the user explicitly asks for text inside the image.
- Leave clean negative space where the chosen layout puts the text: "bottom" = lower third, "top" = upper third, "center" = calm middle, "split" = the image fills the top ~62% only, "minimal" = a quiet corner, "clean" = no text overlay at all.
- Match the aspect ratio to the format (1:1, 4:5, 9:16, 16:9) and pick the highest-quality model the tools offer that fits the job (photoreal product/lifestyle vs. illustration).
- Write image prompts in English, concrete and art-directed: subject, styling, setting, lighting, lens/angle, composition, color grading tied to the palette, mood.
- When the brand has product, logo or reference image URLs and the tool accepts reference images, pass the relevant ones so the product and look stay accurate.
- If a generation returns a job/request id, keep checking its status until the image is ready, then use the final image URL. Never present an unfinished job.
- If no image tool is available (or generation fails), still call present_designs with a detailed image_prompt and no image_url, and tell the user in one line that they can generate it and attach it.

# Media-buying know-how you apply
- Placements: Feed 1:1 or 4:5, Stories/Reels/TikTok 9:16 (keep the top 14% and bottom 20% free of key elements), YouTube/Display/Web 16:9.
- Funnel: awareness (bold brand moment), consideration (benefit/proof), conversion (offer + urgency + clear CTA). Say which stage each design targets.
- Give variations that test different angles or hooks (not just color swaps) when it helps A/B testing.
- For campaigns: big idea, key message, objective, audience/targeting suggestions, channels and placements, timeline/phasing, budget split, KPIs — then the asset set, consistent as one family.

# Talking to the user
Reply in the user's language (Egyptian Arabic if they write Egyptian Arabic). Keep chat replies short and useful — the designs carry the work. Don't repeat the copy in the chat; it shows on the design cards.`;

// ---------- the tool that hands finished work to the app ----------

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const DesignInput = z.object({
  title: z.string().max(120).describe("Short internal name, e.g. 'Ramadan offer — feed'"),
  format: z.enum(Object.keys(FORMATS) as [keyof typeof FORMATS, ...(keyof typeof FORMATS)[]]),
  placement: z.string().max(80).describe("Where it runs, e.g. 'Instagram feed', 'Stories', 'Facebook ad', 'TikTok'"),
  image_url: z.string().url().optional().describe("Final URL of the generated visual. Omit if no image was generated."),
  image_prompt: z.string().max(4000).describe("The exact prompt used (or to use) for the visual"),
  headline: z.string().max(200),
  subheadline: z.string().max(300).optional(),
  cta: z.string().max(60).optional(),
  caption: z.string().max(3000).optional().describe("Ready-to-post caption"),
  hashtags: z.string().max(500).optional(),
  layout: z.enum(LAYOUTS).describe("Text layout over the visual"),
  text_color: hex.describe("Headline color — from the brand palette"),
  accent_color: hex.describe("CTA / shape color — from the brand palette"),
  logo_position: z.enum(LOGO_POSITIONS),
  rationale: z.string().max(1200).describe("Why it works: idea, funnel stage, how it follows the brand"),
});
const PresentInput = z.object({
  campaign: z.object({
    name: z.string().max(120),
    big_idea: z.string().max(1500),
    key_message: z.string().max(800).optional(),
    objective: z.string().max(400).optional(),
    audience: z.string().max(1200).optional(),
    channels: z.string().max(800).optional(),
    timeline: z.string().max(1500).optional(),
    budget_split: z.string().max(1200).optional(),
    kpis: z.string().max(800).optional(),
  }).optional().describe("Only when delivering a new campaign"),
  campaign_id: z.string().optional().describe("Add these designs to an existing campaign (id from an earlier result)"),
  replaces: z.array(z.string()).optional().describe("Ids of earlier designs these replace (they are removed)"),
  designs: z.array(DesignInput).min(1).max(12),
});
type PresentInput = z.infer<typeof PresentInput>;

const schema = (() => {
  const s = z.toJSONSchema(PresentInput) as Record<string, unknown>;
  delete s.$schema;
  return s as Anthropic.Beta.BetaTool.InputSchema;
})();

const PRESENT_TOOL: Anthropic.Beta.BetaTool = {
  name: "present_designs",
  description:
    "Deliver finished designs to the user's board. Call this whenever you have one or more ads/posts/visuals ready (after the images are generated), and for every asset of a campaign. The app renders each design with the brand fonts, logo and your copy, and saves it to the brand library. Pass `campaign` the first time you deliver a campaign; pass `campaign_id` to add to it later; pass `replaces` when revising earlier designs.",
  input_schema: schema,
  eager_input_streaming: true,
};

// ---------- conversation storage ----------

// Images are stored as references ({type:"image", fileId} for uploads, {type:"image", storageKey} for generated
// visuals) and turned into base64 when sent. Stored files never change, so replayed history stays byte-identical
// (which keeps prompt caching and Claude's preserved thinking valid).
type ImageRef = { type: "image"; fileId?: string; storageKey?: string };
type Stored = Anthropic.Beta.BetaContentBlockParam | ImageRef;

const visionCache = new Map<string, string>();
async function imageBlock(ref: ImageRef): Promise<Anthropic.Beta.BetaImageBlockParam | Anthropic.Beta.BetaTextBlockParam> {
  const storageKey = ref.storageKey ?? (await prisma.brandFile.findUnique({ where: { id: ref.fileId ?? "" }, select: { storageKey: true } }))?.storageKey;
  let data = storageKey ? visionCache.get(storageKey) : undefined;
  if (!data && storageKey) {
    const buf = await readStored(storageKey).catch(() => null);
    data = buf ? await forVision(buf).catch(() => "") : "";
    if (data) {
      if (visionCache.size > 200) visionCache.clear();
      visionCache.set(storageKey, data);
    }
  }
  if (!data) return { type: "text", text: "[image no longer available]" };
  return { type: "image", source: { type: "base64", media_type: "image/jpeg", data } };
}

const isRef = (b: Stored): b is ImageRef => b.type === "image" && ("fileId" in b || "storageKey" in b);

async function hydrate(content: Stored[]): Promise<Anthropic.Beta.BetaContentBlockParam[]> {
  const out: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const b of content) {
    if (isRef(b)) out.push(await imageBlock(b));
    else if (b.type === "tool_result" && Array.isArray(b.content)) {
      const inner = [];
      for (const c of b.content as Stored[]) inner.push(isRef(c) ? await imageBlock(c) : c);
      out.push({ ...b, content: inner as Anthropic.Beta.BetaToolResultBlockParam["content"] });
    } else out.push(b);
  }
  return out;
}

export async function brandAssets(brandId: string, cfg: Config): Promise<BrandAssetLink[]> {
  const files = await prisma.brandFile.findMany({ where: { brandId, kind: { not: "attachment" } }, orderBy: { createdAt: "asc" } });
  return Promise.all(files.map(async (f) => ({
    id: f.id, kind: f.kind, name: f.name,
    url: cfg.appUrl && f.mime.startsWith("image/") ? `${cfg.appUrl}/api/public/${await fileToken(f.id)}` : null,
  })));
}

export async function systemFor(brandId: string, cfg: Config): Promise<Anthropic.Beta.BetaTextBlockParam[]> {
  const brand = await prisma.brand.findUniqueOrThrow({ where: { id: brandId } });
  const brief = brandBrief(brand.name, parseBook(brand.book), await brandAssets(brandId, cfg));
  return [
    { type: "text", text: PERSONA },
    { type: "text", text: brief + (cfg.mcpUrl ? "" : "\n\n(No image-generation tool is connected right now.)"), cache_control: { type: "ephemeral" } },
  ];
}

async function nextSeq(chatId: string) {
  const last = await prisma.chatMessage.findFirst({ where: { chatId }, orderBy: { seq: "desc" }, select: { seq: true } });
  return (last?.seq ?? -1) + 1;
}

export async function appendMessage(chatId: string, role: "user" | "assistant", content: Stored[]) {
  await prisma.chatMessage.create({ data: { chatId, role, content: JSON.stringify(content), seq: await nextSeq(chatId) } });
  await prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
}

// ---------- running a turn ----------

export type DesignerEvent =
  | { t: "text"; d: string }
  | { t: "thinking"; d: string }
  | { t: "tool"; name: string; phase: "start" | "done" | "error" }
  | { t: "designs"; designs: ReturnType<typeof designDTO>[]; replaced: string[] }
  | { t: "step" }
  | { t: "error"; message: string }
  | { t: "done" };

async function present(brandId: string, chatId: string, input: PresentInput) {
  let campaignId: string | null = null;
  if (input.campaign_id) {
    const c = await prisma.campaign.findFirst({ where: { id: input.campaign_id, brandId } });
    campaignId = c?.id ?? null;
  }
  if (!campaignId && input.campaign) {
    const { name, big_idea, ...plan } = input.campaign;
    campaignId = (await prisma.campaign.create({ data: { brandId, chatId, name, bigIdea: big_idea, plan: JSON.stringify(plan) } })).id;
  }
  const replaced: string[] = [];
  if (input.replaces?.length) {
    const old = await prisma.design.findMany({ where: { id: { in: input.replaces }, brandId, archived: false }, select: { id: true } });
    await prisma.design.updateMany({ where: { id: { in: old.map((o) => o.id) } }, data: { archived: true } });
    replaced.push(...old.map((o) => o.id));
  }
  const created = [];
  const problems: string[] = [];
  for (const d of input.designs) {
    let imageKey: string | null = null;
    if (d.image_url) {
      try { imageKey = (await downloadImage(d.image_url)).key; }
      catch (e) { problems.push(`"${d.title}": could not download image_url (${(e as Error).message})`); }
    }
    created.push(await prisma.design.create({
      data: {
        brandId, chatId, campaignId, title: d.title, format: d.format, placement: d.placement,
        headline: d.headline, subheadline: d.subheadline ?? "", cta: d.cta ?? "", caption: d.caption ?? "", hashtags: d.hashtags ?? "",
        imagePrompt: d.image_prompt, rationale: d.rationale, imageKey, sourceUrl: d.image_url ?? null,
        layout: JSON.stringify({ preset: d.layout, textColor: d.text_color.toUpperCase(), accentColor: d.accent_color.toUpperCase(), logoPosition: d.logo_position }),
      },
    }));
  }
  return { created, campaignId, replaced, problems };
}

/** Runs the designer until it finishes its turn, streaming progress through `emit`. The user message must already be stored. */
export async function runTurn(chatId: string, emit: (e: DesignerEvent) => void) {
  const cfg = await getConfig();
  const api = client(cfg);
  const chat = await prisma.chat.findUniqueOrThrow({ where: { id: chatId } });
  const system = await systemFor(chat.brandId, cfg);
  const servers = mcpServers(cfg);
  const tools: Anthropic.Beta.BetaToolUnion[] = [PRESENT_TOOL, ...servers.map((s) => ({ type: "mcp_toolset" as const, mcp_server_name: s.name }))];

  for (let step = 0; step < MAX_STEPS; step++) {
    const rows = await prisma.chatMessage.findMany({ where: { chatId }, orderBy: { seq: "asc" } });
    const messages: Anthropic.Beta.BetaMessageParam[] = [];
    for (const r of rows) messages.push({ role: r.role as "user" | "assistant", content: await hydrate(JSON.parse(r.content)) });
    if (step) emit({ t: "step" });

    const stream = api.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: BETAS,
      fallbacks: "default",
      thinking: { type: "adaptive", display: "summarized" },
      output_config: { effort: "high" },
      cache_control: { type: "ephemeral" },
      system,
      tools,
      ...(servers.length ? { mcp_servers: servers } : {}),
      messages,
    });

    let msg: Anthropic.Beta.BetaMessage;
    try {
      for await (const ev of stream) {
        if (ev.type === "content_block_start" && ev.content_block.type === "mcp_tool_use") emit({ t: "tool", name: ev.content_block.name, phase: "start" });
        else if (ev.type === "content_block_start" && ev.content_block.type === "mcp_tool_result") emit({ t: "tool", name: "", phase: ev.content_block.is_error ? "error" : "done" });
        else if (ev.type === "content_block_start" && ev.content_block.type === "tool_use") emit({ t: "tool", name: ev.content_block.name, phase: "start" });
        else if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") emit({ t: "text", d: ev.delta.text });
        else if (ev.type === "content_block_delta" && ev.delta.type === "thinking_delta") emit({ t: "thinking", d: ev.delta.thinking });
      }
      msg = await stream.finalMessage();
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) throw new Error("Invalid Claude API key — check it in Settings");
      if (err instanceof Anthropic.RateLimitError) throw new Error("Claude is busy right now, try again in a minute");
      if (err instanceof Anthropic.APIError) throw new Error(`Claude: ${err.message}`);
      if (err instanceof SyntaxError) { emit({ t: "error", message: "The reply was cut off, try again" }); return; }
      throw err;
    }

    await appendMessage(chatId, "assistant", msg.content as Stored[]);

    if (msg.stop_reason === "refusal") { emit({ t: "error", message: "Claude declined this request. Try rephrasing it." }); break; }
    if (msg.stop_reason === "pause_turn") continue; // server-side tool loop paused; resend to resume

    const uses = msg.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (!uses.length) break;

    const results: Stored[] = [];
    for (const u of uses) {
      if (msg.stop_reason === "max_tokens") {
        results.push({ type: "tool_result", tool_use_id: u.id, is_error: true, content: "The tool input was cut off (max_tokens). Send fewer designs per call." });
        continue;
      }
      if (u.name !== "present_designs") { results.push({ type: "tool_result", tool_use_id: u.id, is_error: true, content: `Unknown tool ${u.name}` }); continue; }
      const parsed = PresentInput.safeParse(u.input);
      if (!parsed.success) {
        results.push({ type: "tool_result", tool_use_id: u.id, is_error: true, content: JSON.stringify({ INVALID_INPUT: z.prettifyError(parsed.error) }) });
        emit({ t: "tool", name: u.name, phase: "error" });
        continue;
      }
      const r = await present(chat.brandId, chatId, parsed.data);
      emit({ t: "designs", designs: r.created.map(designDTO), replaced: r.replaced });
      const summary = {
        shown_to_user: r.created.map((d) => ({ id: d.id, title: d.title, has_image: !!d.imageKey })),
        campaign_id: r.campaignId,
        replaced: r.replaced,
        problems: r.problems,
      };
      const content = [
        { type: "text", text: `design_ids: ${r.created.map((d) => d.id).join(",")}\n${JSON.stringify(summary)}\nThe designs are on the user's board. Look at the visuals below: only if one clearly breaks the brand book (off-palette, text/logo baked into the image, wrong product), regenerate it and call present_designs again with \`replaces\`. Otherwise finish with a short reply.` },
        ...r.created.filter((d) => d.imageKey).slice(0, 6).map((d): ImageRef => ({ type: "image", storageKey: d.imageKey! })),
      ];
      results.push({ type: "tool_result", tool_use_id: u.id, content: content as Anthropic.Beta.BetaToolResultBlockParam["content"] });
    }
    await appendMessage(chatId, "user", results);
  }
  emit({ t: "done" });
}
