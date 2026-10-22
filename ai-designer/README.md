# Studio AI — AI ad designer

A web app that works like a full creative team: art director, graphic designer, copywriter and media buyer in one.
Ask it for any ad, post, image or full campaign, and it delivers it **exactly on brand**.

## What it does

- **Every brand gets its own tab** across the top, and each brand has:
  - **A brand book**: tagline, audience, tone of voice, copy language and dialect, colors (with roles: primary, secondary, background…), fonts, image style, logo and layout rules, "always" and "never" lists, competitors.
  - **Files**: logos, product photos, style references, font files and brand guidelines.
  - **Auto-fill**: upload your guidelines (PDF or images) and the designer fills in the whole brand book for you to review and save.
- **Studio**: chat with the designer. Write a brief (or pick a starter: social ad, full campaign, story, 3 A/B angles…) and attach product photos if you like.
  The designer comes up with the idea, writes the copy in the brand's voice, generates the visual on **Higgsfield** through MCP, and hands you finished designs.
- **The final ad is composed inside the app**: visuals are generated without any text, then the app lays the headline, CTA and your **real logo** on top using the brand fonts and colors,
  so Arabic and English copy render correctly and the identity stays consistent. In the editor you can change the copy, text position, colors (brand palette only), logo position and size (1:1, 4:5, 9:16, 16:9), then download a PNG.
- **Brand check**: one click reviews the finished design against the brand book and gives it a score out of 100 with notes and suggested fixes.
- **Campaigns**: big idea, key message, objective, audience and targeting, channels, timeline, budget split, KPIs, plus a consistent set of ads.
- **Library**: every design and campaign is saved per brand, with favorites, filters, and captions and hashtags ready to copy.
- **Request changes** on any design takes you back to the chat so the designer can revise it.

## How it works

| Part | Role |
|---|---|
| **Claude** (`claude-opus-5-5`) | The brain: ideas, copy, art direction, following the brand book, reviewing the work |
| **Higgsfield MCP** | Image generation. Claude connects to it directly through the MCP connector, picks the model and aspect ratio, and follows each generation until the image is ready |
| **The app** | Saves the images, composes the final ad with the brand's fonts, colors and logo, and stores everything |

The brand book is sent to the designer with every request as binding rules, and the designer looks at each generated image and redoes any that break the brand before delivering.

## Running it

Requires Node.js 20+.

```bash
cd ai-designer
npm install
cp .env.example .env      # set ANTHROPIC_API_KEY and SESSION_SECRET
npm run setup             # creates the database
npm run dev               # http://localhost:3000
```

Then open **Settings** (the gear icon) and add:

1. **Claude API key** — from console.anthropic.com.
2. **Higgsfield MCP URL** and **token** — from your Higgsfield account. Click "Test connection" to see the generation tools it found.
3. **APP_URL** (once deployed) — lets Higgsfield use your logo and product photos as references while generating.

Any of these can be set as server environment variables instead (`ANTHROPIC_API_KEY`, `HIGGSFIELD_MCP_URL`, `HIGGSFIELD_MCP_TOKEN`, `APP_URL`).
If Higgsfield isn't connected, the designer still delivers the copy and the image prompt; you can generate the image yourself and upload it to the design.

> **Important:** if the app is reachable from the internet, set `APP_PASSWORD` so nobody else can spend your Claude credits.

## Deploying on Railway

1. **New Project → Deploy from GitHub repo**, pick this repo, and under **Settings → Root Directory** enter `ai-designer`.
2. Under **Variables** add `ANTHROPIC_API_KEY`, `SESSION_SECRET` (a long random string), `APP_PASSWORD` and `APP_URL` (your domain), and optionally `HIGGSFIELD_MCP_URL` and `HIGGSFIELD_MCP_TOKEN`.
3. **Attach a volume** at `/data` (the database and images live there; without it they are wiped on every deploy).
4. **Settings → Networking → Generate Domain**.

Or with Docker on any server:

```bash
docker build -t studio-ai .
docker run -d -p 3000:3000 --env-file .env -v studio-data:/data studio-ai
```

## Stack

Next.js 15 · React 19 · Prisma + SQLite · Claude API (`@anthropic-ai/sdk`, MCP connector, structured outputs) · sharp · Canvas for ad composition.

```
src/lib/designer.ts      The designer: instructions, the present_designs tool, the Higgsfield MCP connection, the chat loop
src/lib/brand.ts         The brand book and how it becomes rules for the designer
src/lib/review.ts        Filling the brand book from guidelines, and reviewing designs
src/lib/compose.ts       Composing the final ad (visual + copy + logo in the brand fonts)
src/components/          Studio, editor, library, brand book, settings
```
