"use client";
import { useEffect, useRef, useState } from "react";
import { api, copyText, type DesignDTO, type Layout } from "@/lib/client";
import { compose, loadBrandFonts, loadImage, canvasBlob, sizeOf } from "@/lib/compose";
import { FORMATS, LAYOUTS, LOGO_POSITIONS } from "@/lib/brand";
import { useBrand } from "./BrandCtx";
import { I } from "./Icons";

type Draft = Pick<DesignDTO, "format" | "headline" | "subheadline" | "cta" | "layout" | "image">;

/** Renders a design into a canvas with the brand fonts and logo. */
function useCompose(canvas: React.RefObject<HTMLCanvasElement | null>, d: Draft) {
  const { brand, files } = useBrand();
  const [ready, setReady] = useState(false);
  const logoFile = files.find((f) => f.kind === "logo" && f.mime.startsWith("image/"));
  useEffect(() => {
    let live = true;
    (async () => {
      const [image, logo, fonts] = await Promise.all([loadImage(d.image), loadImage(logoFile?.url), loadBrandFonts(brand.id, brand.book, files)]);
      if (!live || !canvas.current) return;
      compose(canvas.current, { ...d, image, logo, fonts, brandName: brand.name, book: brand.book });
      setReady(true);
    })();
    return () => { live = false; };
  }, [canvas, d.image, d.format, d.headline, d.subheadline, d.cta, d.layout, brand, files, logoFile?.url]); // eslint-disable-line react-hooks/exhaustive-deps
  return ready;
}

const scoreCls = (s: number) => (s >= 80 ? "good" : s >= 60 ? "mid" : "bad");

export function DesignCard({ design, onOpen }: { design: DesignDTO; onOpen: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { w, h } = sizeOf(design.format);
  useCompose(ref, design);
  return (
    <button type="button" className="design-card" onClick={onOpen}>
      <div className="preview" style={{ aspectRatio: `${w}/${h}` }}><canvas ref={ref} /></div>
      <div className="meta">
        <b>{design.title}</b>
        <div className="row">
          <span>{design.format}</span>{design.placement && <><span>·</span><span>{design.placement}</span></>}
          {design.favorite && <I name="star" />}
          {design.check && <span className={`score ${scoreCls(design.check.score)}`}>{design.check.score}</span>}
          {!design.image && <span className="badge">No image</span>}
        </div>
      </div>
    </button>
  );
}

export function DesignEditor({ design, onClose, onChange, onRemove, onRevise }: {
  design: DesignDTO;
  onClose: () => void;
  onChange: (d: DesignDTO) => void;
  onRemove: (id: string) => void;
  onRevise?: (d: DesignDTO) => void;
}) {
  const { brand, say } = useBrand();
  const [d, setD] = useState(design);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLCanvasElement>(null);
  useCompose(ref, d);
  const dirty = JSON.stringify(pick(d)) !== JSON.stringify(pick(design));

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && close();
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  });

  function pick(x: DesignDTO) { return { f: x.format, h: x.headline, s: x.subheadline, c: x.cta, cap: x.caption, tag: x.hashtags, l: x.layout, t: x.title }; }
  const set = (p: Partial<DesignDTO>) => setD((x) => ({ ...x, ...p }));
  const setL = (p: Partial<Layout>) => setD((x) => ({ ...x, layout: { ...x.layout, ...p } }));

  async function save() {
    if (!dirty) return design;
    setSaving(true);
    try {
      const out = await api<DesignDTO>(`/api/designs/${d.id}`, { method: "PATCH", json: { title: d.title, format: d.format, headline: d.headline, subheadline: d.subheadline, cta: d.cta, caption: d.caption, hashtags: d.hashtags, layout: d.layout } });
      onChange(out); return out;
    } catch (e) { say((e as Error).message); } finally { setSaving(false); }
  }
  async function close() { await save(); onClose(); }

  async function download() {
    if (!ref.current) return;
    const blob = await canvasBlob(ref.current);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${brand.name}-${d.title}-${d.format.replace(":", "x")}.png`.replace(/[\\/:*?"<>|]+/g, "-");
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  async function check() {
    if (!ref.current) return;
    setChecking(true);
    try {
      await save();
      const fd = new FormData();
      fd.set("file", await canvasBlob(ref.current, "image/jpeg", 0.9), "ad.jpg");
      const res = await api<NonNullable<DesignDTO["check"]>>(`/api/designs/${d.id}/check`, { method: "POST", body: fd });
      const next = { ...d, check: res };
      setD(next); onChange({ ...design, ...next });
    } catch (e) { say((e as Error).message); }
    setChecking(false);
  }

  async function attach(list: FileList | null) {
    if (!list?.[0]) return;
    const fd = new FormData(); fd.set("file", list[0]);
    try { const out = await api<DesignDTO>(`/api/designs/${d.id}/image`, { method: "POST", body: fd }); set({ image: out.image }); onChange({ ...out, ...pickBack(d) }); say("Image updated"); }
    catch (e) { say((e as Error).message); }
  }
  const pickBack = (x: DesignDTO) => ({ headline: x.headline, subheadline: x.subheadline, cta: x.cta, layout: x.layout, format: x.format });

  async function fav() {
    const out = await api<DesignDTO>(`/api/designs/${d.id}`, { method: "PATCH", json: { favorite: !d.favorite } });
    set({ favorite: out.favorite }); onChange({ ...design, favorite: out.favorite });
  }
  async function remove() {
    if (!confirm("Remove this design from the library?")) return;
    await api(`/api/designs/${d.id}`, { method: "DELETE" });
    onRemove(d.id); onClose();
  }

  const palette = brand.book.colors;
  const textChoices = [...palette.map((c) => c.hex), "#FFFFFF", "#111111"].filter((v, i, a) => a.indexOf(v) === i);
  const accentChoices = palette.length ? palette.map((c) => c.hex) : [d.layout.accentColor];
  const LAYOUT_LABEL: Record<string, string> = { bottom: "Bottom", top: "Top", center: "Center", split: "Split", minimal: "Minimal", clean: "Image only" };
  const LOGO_LABEL: Record<string, string> = { "top-right": "Top right", "top-left": "Top left", "bottom-right": "Bottom right", "bottom-left": "Bottom left", none: "None" };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal" role="dialog" aria-label={d.title}>
        <div className="stage"><canvas ref={ref} /></div>
        <div className="side">
          <div className="row">
            <input className="input" value={d.title} onChange={(e) => set({ title: e.target.value })} style={{ fontWeight: 700 }} aria-label="Design name" />
            <button type="button" className="btn icon ghost" onClick={fav} aria-label="Favorite" style={{ color: d.favorite ? "var(--warn)" : undefined }}><I name="star" /></button>
            <button type="button" className="btn icon ghost" onClick={close} aria-label="Close"><I name="x" /></button>
          </div>

          <div className="row" style={{ flexWrap: "wrap" }}>
            <button type="button" className="btn primary" onClick={download}><I name="download" />Download PNG</button>
            <button type="button" className="btn" onClick={check} disabled={checking}><I name="shield" />{checking ? "Reviewing…" : "Brand check"}</button>
            {onRevise && <button type="button" className="btn" onClick={async () => { await save(); onRevise(d); onClose(); }}><I name="wand" />Request changes</button>}
          </div>

          {d.check && (
            <div className="check-box">
              <div className="row"><span className={`score ${scoreCls(d.check.score)}`} style={{ fontSize: 15 }}>{d.check.score}/100</span><b className="grow">{d.check.verdict === "approved" ? "On brand" : d.check.verdict === "needs_changes" ? "Needs changes" : "Off brand"}</b></div>
              <div style={{ fontSize: 14 }}>{d.check.summary}</div>
              {d.check.checks.map((c, i) => (
                <div key={i} className="check-item"><span className={c.pass ? "ok" : "no"}>{c.pass ? "✓" : "✕"}</span><span><b>{c.area}:</b> {c.note}</span></div>
              ))}
              {d.check.fixes.length > 0 && <details className="details"><summary>Suggested fixes</summary><ol style={{ margin: "6px 0 0", paddingInlineStart: 18 }}>{d.check.fixes.map((f, i) => <li key={i}>{f}</li>)}</ol></details>}
            </div>
          )}

          <div className="section-t">Copy</div>
          <label className="field"><span>Headline</span><textarea className="textarea" rows={2} style={{ minHeight: 60 }} value={d.headline} onChange={(e) => set({ headline: e.target.value })} /></label>
          <label className="field"><span>Subheadline</span><textarea className="textarea" rows={2} style={{ minHeight: 56 }} value={d.subheadline} onChange={(e) => set({ subheadline: e.target.value })} /></label>
          <label className="field"><span>CTA button</span><input className="input" value={d.cta} onChange={(e) => set({ cta: e.target.value })} /></label>

          <div className="section-t">Design</div>
          <div className="field"><span>Size</span><div className="seg">{Object.entries(FORMATS).map(([k, v]) => <button key={k} type="button" className="chip" aria-pressed={d.format === k} onClick={() => set({ format: k })} title={v.label}>{k}</button>)}</div></div>
          <div className="field"><span>Text position</span><div className="seg">{LAYOUTS.map((k) => <button key={k} type="button" className="chip" aria-pressed={d.layout.preset === k} onClick={() => setL({ preset: k })}>{LAYOUT_LABEL[k]}</button>)}</div></div>
          <div className="field"><span>Headline color</span><div className="swatches">{textChoices.map((c) => <button key={c} type="button" className="swatch" style={{ background: c }} aria-pressed={d.layout.textColor.toUpperCase() === c.toUpperCase()} onClick={() => setL({ textColor: c })} aria-label={c} />)}</div></div>
          <div className="field"><span>Button color</span><div className="swatches">{accentChoices.map((c) => <button key={c} type="button" className="swatch" style={{ background: c }} aria-pressed={d.layout.accentColor.toUpperCase() === c.toUpperCase()} onClick={() => setL({ accentColor: c })} aria-label={c} />)}</div>{!palette.length && <small>Add brand colors in the brand book to choose from them.</small>}</div>
          <div className="field"><span>Logo</span><div className="seg">{LOGO_POSITIONS.map((k) => <button key={k} type="button" className="chip" aria-pressed={d.layout.logoPosition === k} onClick={() => setL({ logoPosition: k })}>{LOGO_LABEL[k]}</button>)}</div></div>

          <div className="section-t">Image</div>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <label className="btn sm"><I name="upload" />{d.image ? "Replace image" : "Upload image"}<input type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => { attach(e.target.files); e.target.value = ""; }} /></label>
            <button type="button" className="btn sm" onClick={async () => say((await copyText(d.imagePrompt)) ? "Prompt copied" : "Couldn't copy")}><I name="copy" />Copy prompt</button>
            {d.sourceUrl && <a className="btn sm ghost" href={d.sourceUrl} target="_blank" rel="noreferrer">Original</a>}
          </div>
          <details className="details"><summary>Image prompt</summary><p className="mono" style={{ whiteSpace: "pre-wrap", fontSize: 12.5, direction: "ltr", textAlign: "left" }}>{d.imagePrompt}</p></details>

          <div className="section-t">Post</div>
          <label className="field"><span>Caption</span><textarea className="textarea" rows={5} value={d.caption} onChange={(e) => set({ caption: e.target.value })} /></label>
          <label className="field"><span>Hashtags</span><input className="input" value={d.hashtags} onChange={(e) => set({ hashtags: e.target.value })} /></label>
          <button type="button" className="btn sm" onClick={async () => say((await copyText([d.caption, d.hashtags].filter(Boolean).join("\n\n"))) ? "Caption copied" : "Couldn't copy")}><I name="copy" />Copy caption</button>
          {d.rationale && <details className="details"><summary>Why this design?</summary><p style={{ whiteSpace: "pre-wrap" }}>{d.rationale}</p></details>}

          <div className="row" style={{ marginTop: "auto", paddingTop: 8 }}>
            <button type="button" className="btn danger ghost" onClick={remove}><I name="trash" />Remove</button>
            <span className="grow" />
            {dirty && <button type="button" className="btn primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
