"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, kb, upload, type BrandBook, type BrandDTO, type FileDTO } from "@/lib/client";
import { useBrand } from "./BrandCtx";
import { Palette } from "./BrandMark";
import { I } from "./Icons";

type TextKey = Exclude<keyof BrandBook, "colors">;
const ROLES: Record<string, string> = { primary: "Primary", secondary: "Secondary", accent: "Accent", background: "Background", text: "Text", other: "Other" };

const SECTIONS: { title: string; icon: string; fields: { k: TextKey; label: string; hint?: string; long?: boolean }[] }[] = [
  { title: "Brand", icon: "book", fields: [
    { k: "tagline", label: "Tagline / slogan" },
    { k: "industry", label: "Industry" },
    { k: "description", label: "About the brand", hint: "What the brand sells and what makes it different", long: true },
    { k: "audience", label: "Target audience", hint: "Who they are: age, interests, income level", long: true },
    { k: "markets", label: "Markets", hint: "e.g. Egypt and Saudi Arabia" },
    { k: "personality", label: "Brand personality", hint: "e.g. bold, premium, down-to-earth" },
  ] },
  { title: "Voice & copy", icon: "chat", fields: [
    { k: "toneOfVoice", label: "Tone of voice", hint: "How the brand talks", long: true },
    { k: "languages", label: "Copy language", hint: "e.g. Egyptian Arabic + English" },
    { k: "ctaStyle", label: "Usual CTAs", hint: "e.g. Order now, Shop the drop" },
    { k: "hashtags", label: "Brand hashtags" },
  ] },
  { title: "Look & imagery", icon: "image", fields: [
    { k: "visualStyle", label: "Visual style", hint: "Mood, lighting, composition, overall feel", long: true },
    { k: "photography", label: "Photography & imagery", hint: "Models, locations, styling, color grading", long: true },
    { k: "layoutRules", label: "Layout & typography rules", long: true },
    { k: "logoRules", label: "Logo rules", hint: "Placement, clear space, light and dark versions", long: true },
  ] },
  { title: "Rules", icon: "shield", fields: [
    { k: "dos", label: "Always ✓", hint: "One rule per line", long: true },
    { k: "donts", label: "Never ✕", hint: "One rule per line", long: true },
    { k: "competitors", label: "Competitors and how we stand apart", long: true },
    { k: "notes", label: "Other notes", long: true },
  ] },
];

const FILE_KINDS: { k: string; title: string; hint: string; accept: string; photo?: boolean }[] = [
  { k: "logo", title: "Logo", hint: "Transparent PNG or SVG. The first logo is placed on designs.", accept: "image/*,.svg" },
  { k: "product", title: "Product photos", hint: "Used as references so the product comes out accurate.", accept: "image/*", photo: true },
  { k: "reference", title: "Style references", hint: "Past work or a mood board of the look you want.", accept: "image/*", photo: true },
  { k: "font", title: "Font files", hint: "TTF / OTF / WOFF — used for the text on your ads.", accept: ".ttf,.otf,.woff,.woff2" },
  { k: "guideline", title: "Brand guidelines", hint: "Guideline PDF or images.", accept: ".pdf,image/*" },
];

export default function BrandBookEditor() {
  const { brand, files, reloadFiles, updateBrand, say, ready } = useBrand();
  const router = useRouter();
  const [book, setBook] = useState<BrandBook>(brand.book);
  const [name, setName] = useState(brand.name);
  const [color, setColor] = useState(brand.color);
  const [saving, setSaving] = useState(false);
  const [busyKind, setBusyKind] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [notes, setNotes] = useState("");
  const [filled, setFilled] = useState(false);

  useEffect(() => { setBook(brand.book); setName(brand.name); setColor(brand.color); }, [brand.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(book) !== JSON.stringify(brand.book) || name !== brand.name || color !== brand.color;

  const set = (k: TextKey, v: string) => setBook((b) => ({ ...b, [k]: v }));
  const setColorAt = (i: number, p: Partial<BrandBook["colors"][number]>) => setBook((b) => ({ ...b, colors: b.colors.map((c, j) => (j === i ? { ...c, ...p } : c)) }));

  async function save() {
    setSaving(true);
    try {
      const out = await api<BrandDTO>(`/api/brands/${brand.id}`, { method: "PATCH", json: { name, color, book: { ...book, colors: book.colors.filter((c) => /^#[0-9a-fA-F]{6}$/.test(c.hex)) } } });
      updateBrand(out); setBook(out.book); setFilled(false); say("Brand book saved");
      router.refresh();
    } catch (e) { say((e as Error).message); }
    setSaving(false);
  }

  async function addFiles(kind: string, list: FileList | null) {
    if (!list?.length) return;
    setBusyKind(kind);
    try { await upload(brand.id, kind, list); await reloadFiles(); if (kind === "logo") { updateBrand(await api<BrandDTO>(`/api/brands/${brand.id}`)); router.refresh(); } }
    catch (e) { say((e as Error).message); }
    setBusyKind("");
  }
  async function removeFile(f: FileDTO) {
    if (!confirm(`Delete ${f.name}?`)) return;
    await api(`/api/files/${f.id}`, { method: "DELETE" });
    await reloadFiles();
    if (f.kind === "logo") updateBrand(await api<BrandDTO>(`/api/brands/${brand.id}`));
  }

  async function autofill() {
    if (!ready.claude) { say("Add your Claude API key in Settings first"); return; }
    setExtracting(true);
    try {
      const ids = files.filter((f) => f.kind === "guideline" || f.kind === "logo" || f.kind === "reference").map((f) => f.id);
      const out = await api<BrandBook>(`/api/brands/${brand.id}/extract`, { method: "POST", json: { fileIds: ids, notes } });
      setBook(out); setFilled(true); say("Filled in — review it and save");
    } catch (e) { say((e as Error).message); }
    setExtracting(false);
  }

  async function deleteBrand() {
    if (prompt(`This deletes the brand with all its designs and chats. Type the brand name to confirm: ${brand.name}`) !== brand.name) return;
    await api(`/api/brands/${brand.id}`, { method: "DELETE" });
    router.push("/"); router.refresh();
  }

  return (
    <div className="page">
      <div className="book">
        <div className="stack" style={{ gap: 16 }}>
          {filled && <div className="notice"><I name="wand" /><span className="grow">The designer filled in the brand book from your files. Review everything, adjust what you need, then save.</span></div>}
          <div className="card book-section">
            <h3><I name="spark" />Name & tab color</h3>
            <div className="row">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Tab color" style={{ width: 44, height: 40, border: 0, background: "none", cursor: "pointer" }} />
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Brand name" />
            </div>
          </div>

          {SECTIONS.map((s) => (
            <div key={s.title} className="card book-section">
              <h3><I name={s.icon} />{s.title}</h3>
              <div className="grid2">
                {s.fields.map((f) => (
                  <label key={f.k} className="field" style={f.long ? { gridColumn: "1 / -1" } : undefined}>
                    <span>{f.label}</span>
                    {f.long ? <textarea className="textarea" value={book[f.k]} onChange={(e) => set(f.k, e.target.value)} placeholder={f.hint} /> : <input className="input" value={book[f.k]} onChange={(e) => set(f.k, e.target.value)} placeholder={f.hint} />}
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="card book-section">
            <h3><I name="spark" />Colors</h3>
            <small className="muted">The designer only uses these colors for type and shapes, and builds the imagery around them.</small>
            <Palette colors={book.colors} />
            <div className="colors">
              {book.colors.map((c, i) => (
                <div key={i} className="color-row">
                  <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : "#000000"} onChange={(e) => setColorAt(i, { hex: e.target.value.toUpperCase() })} aria-label="Color" />
                  <input className="input mono" value={c.hex} onChange={(e) => setColorAt(i, { hex: e.target.value.toUpperCase() })} aria-label="HEX" />
                  <input className="input c-name" value={c.name} onChange={(e) => setColorAt(i, { name: e.target.value })} placeholder="Color name" />
                  <select className="select c-role" value={c.role} onChange={(e) => setColorAt(i, { role: e.target.value as BrandBook["colors"][number]["role"] })}>
                    {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <button type="button" className="btn sm icon ghost" onClick={() => setBook((b) => ({ ...b, colors: b.colors.filter((_, j) => j !== i) }))} aria-label="Delete"><I name="trash" /></button>
                </div>
              ))}
            </div>
            <div><button type="button" className="btn sm" onClick={() => setBook((b) => ({ ...b, colors: [...b.colors, { name: "", hex: "#7C6CFF", role: b.colors.length ? "secondary" : "primary" }] }))}><I name="plus" />Add color</button></div>
          </div>

          <div className="card book-section">
            <h3><I name="edit" />Fonts</h3>
            <div className="grid2">
              <label className="field"><span>Heading font</span><input className="input" value={book.headingFont} onChange={(e) => set("headingFont", e.target.value)} placeholder="e.g. Montserrat" /></label>
              <label className="field"><span>Body font</span><input className="input" value={book.bodyFont} onChange={(e) => set("bodyFont", e.target.value)} placeholder="e.g. Inter" /></label>
            </div>
            <small className="muted">If you upload a font file with that name, it is used. Otherwise the font is loaded from Google Fonts by name.</small>
          </div>

          {dirty && (
            <div className="sticky-save">
              <span className="muted grow" style={{ alignSelf: "center" }}>You have unsaved changes</span>
              <button type="button" className="btn ghost" onClick={() => { setBook(brand.book); setName(brand.name); setColor(brand.color); setFilled(false); }}>Discard</button>
              <button type="button" className="btn primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save brand book"}</button>
            </div>
          )}
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className="card book-section" style={{ borderColor: "color-mix(in srgb, var(--accent) 40%, transparent)" }}>
            <h3><I name="wand" />Auto-fill</h3>
            <small className="muted">Upload your guidelines (PDF or images) and logo below, or describe the brand, and the designer fills in the whole brand book.</small>
            <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional: tell us anything about the brand…" />
            <button type="button" className="btn primary" onClick={autofill} disabled={extracting}>{extracting ? "Reading files…" : "Fill brand book"}</button>
          </div>

          {FILE_KINDS.map((fk) => {
            const list = files.filter((f) => f.kind === fk.k);
            return (
              <div key={fk.k} className="card book-section">
                <h3 className="row">{fk.title}<span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>{list.length || ""}</span></h3>
                <small className="muted">{fk.hint}{(fk.k === "product" || fk.k === "reference") && !ready.publicUrl ? " (Higgsfield can use them once the app is deployed with APP_URL set.)" : ""}</small>
                <div className="files-grid">
                  {list.map((f) => (
                    <div key={f.id} className={`file-tile ${fk.photo ? "photo" : ""}`} title={`${f.name} · ${kb(f.size)}`}>
                      {f.mime.startsWith("image/") ? <img src={f.url} alt={f.name} /> : <a href={f.url} target="_blank" rel="noreferrer" style={{ overflowWrap: "anywhere" }}>{f.name}</a>}
                      <button type="button" className="x" onClick={() => removeFile(f)} aria-label="Delete">×</button>
                    </div>
                  ))}
                  <label className="file-tile add">
                    <I name={busyKind === fk.k ? "upload" : "plus"} />{busyKind === fk.k ? "Uploading…" : "Upload"}
                    <input type="file" hidden multiple accept={fk.accept} onChange={(e) => { addFiles(fk.k, e.target.files); e.target.value = ""; }} />
                  </label>
                </div>
              </div>
            );
          })}

          <button type="button" className="btn danger ghost" onClick={deleteBrand}><I name="trash" />Delete brand</button>
        </div>
      </div>
    </div>
  );
}
