"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, kb, upload, type BrandBook, type BrandDTO, type FileDTO } from "@/lib/client";
import { useBrand } from "./BrandCtx";
import { Palette } from "./BrandMark";
import { I } from "./Icons";

type TextKey = Exclude<keyof BrandBook, "colors">;
const ROLES: Record<string, string> = { primary: "أساسي", secondary: "ثانوي", accent: "مميز (Accent)", background: "خلفية", text: "نص", other: "تاني" };

const SECTIONS: { title: string; icon: string; fields: { k: TextKey; label: string; hint?: string; long?: boolean }[] }[] = [
  { title: "البراند", icon: "book", fields: [
    { k: "tagline", label: "التاجلاين / السلوجان" },
    { k: "industry", label: "المجال" },
    { k: "description", label: "عن البراند", hint: "البراند بيبيع إيه، وإيه اللي يميزه", long: true },
    { k: "audience", label: "الجمهور المستهدف", hint: "مين، السن، الاهتمامات، المستوى", long: true },
    { k: "markets", label: "الأسواق", hint: "مثلاً: مصر والسعودية" },
    { k: "personality", label: "شخصية البراند", hint: "مثلاً: جريء، فخم، قريب من الناس" },
  ] },
  { title: "الصوت والكلام", icon: "chat", fields: [
    { k: "toneOfVoice", label: "نبرة الكلام", hint: "إزاي البراند بيتكلم", long: true },
    { k: "languages", label: "لغة الكوبي", hint: "مثلاً: عامية مصرية + إنجليزي" },
    { k: "ctaStyle", label: "الـ CTA المعتادة", hint: "مثلاً: اطلب دلوقتي، تسوق الآن" },
    { k: "hashtags", label: "هاشتاجات البراند" },
  ] },
  { title: "الشكل والصور", icon: "image", fields: [
    { k: "visualStyle", label: "الستايل البصري", hint: "المود، الإضاءة، التكوين، الإحساس العام", long: true },
    { k: "photography", label: "التصوير والصور", hint: "الموديلز، اللوكيشنز، الستايلنج، الألوان والجريدنج", long: true },
    { k: "layoutRules", label: "قواعد اللاي أوت والتايبوجرافي", long: true },
    { k: "logoRules", label: "قواعد اللوجو", hint: "مكانه، المساحة حواليه، نسخة الفاتح والغامق", long: true },
  ] },
  { title: "القواعد", icon: "shield", fields: [
    { k: "dos", label: "دايماً ✓", hint: "قاعدة في كل سطر", long: true },
    { k: "donts", label: "ممنوع ✕", hint: "قاعدة في كل سطر", long: true },
    { k: "competitors", label: "المنافسين وإزاي نختلف عنهم", long: true },
    { k: "notes", label: "ملاحظات تانية", long: true },
  ] },
];

const FILE_KINDS: { k: string; title: string; hint: string; accept: string; photo?: boolean }[] = [
  { k: "logo", title: "اللوجو", hint: "PNG شفاف أو SVG. أول لوجو بيتحط على التصاميم.", accept: "image/*,.svg" },
  { k: "product", title: "صور المنتجات", hint: "بيستخدمها المصمم كمرجع عشان المنتج يطلع مظبوط.", accept: "image/*", photo: true },
  { k: "reference", title: "مراجع الستايل", hint: "شغل قديم أو مود بورد للشكل اللي عايزه.", accept: "image/*", photo: true },
  { k: "font", title: "ملفات الخطوط", hint: "TTF / OTF / WOFF — بتتستخدم في نصوص الإعلانات.", accept: ".ttf,.otf,.woff,.woff2" },
  { k: "guideline", title: "الجايدلاين", hint: "PDF أو صور الجايدلاين.", accept: ".pdf,image/*" },
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
      updateBrand(out); setBook(out.book); setFilled(false); say("البراند بوك اتحفظ");
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
    if (!confirm(`تمسح ${f.name}؟`)) return;
    await api(`/api/files/${f.id}`, { method: "DELETE" });
    await reloadFiles();
    if (f.kind === "logo") updateBrand(await api<BrandDTO>(`/api/brands/${brand.id}`));
  }

  async function autofill() {
    if (!ready.claude) { say("ضيف مفتاح Claude API من الإعدادات الأول"); return; }
    setExtracting(true);
    try {
      const ids = files.filter((f) => f.kind === "guideline" || f.kind === "logo" || f.kind === "reference").map((f) => f.id);
      const out = await api<BrandBook>(`/api/brands/${brand.id}/extract`, { method: "POST", json: { fileIds: ids, notes } });
      setBook(out); setFilled(true); say("اتملا — راجعه واحفظ");
    } catch (e) { say((e as Error).message); }
    setExtracting(false);
  }

  async function deleteBrand() {
    if (prompt(`هيتمسح البراند وكل التصاميم والمحادثات بتاعته. اكتب اسم البراند للتأكيد: ${brand.name}`) !== brand.name) return;
    await api(`/api/brands/${brand.id}`, { method: "DELETE" });
    router.push("/"); router.refresh();
  }

  return (
    <div className="page">
      <div className="book">
        <div className="stack" style={{ gap: 16 }}>
          {filled && <div className="notice"><I name="wand" /><span className="grow">المصمم ملا البراند بوك من الملفات. راجع كل حاجة وعدّل اللي محتاج، وبعدين احفظ.</span></div>}
          <div className="card book-section">
            <h3><I name="spark" />الاسم ولون التاب</h3>
            <div className="row">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="لون التاب" style={{ width: 44, height: 40, border: 0, background: "none", cursor: "pointer" }} />
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="اسم البراند" />
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
            <h3><I name="spark" />الألوان</h3>
            <small className="muted">المصمم مش هيستخدم غير الألوان دي في النصوص والأشكال، وهيبني ألوان الصور عليها.</small>
            <Palette colors={book.colors} />
            <div className="colors">
              {book.colors.map((c, i) => (
                <div key={i} className="color-row">
                  <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : "#000000"} onChange={(e) => setColorAt(i, { hex: e.target.value.toUpperCase() })} aria-label="اللون" />
                  <input className="input mono" value={c.hex} onChange={(e) => setColorAt(i, { hex: e.target.value.toUpperCase() })} aria-label="HEX" />
                  <input className="input c-name" value={c.name} onChange={(e) => setColorAt(i, { name: e.target.value })} placeholder="اسم اللون" />
                  <select className="select c-role" value={c.role} onChange={(e) => setColorAt(i, { role: e.target.value as BrandBook["colors"][number]["role"] })}>
                    {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <button type="button" className="btn sm icon ghost" onClick={() => setBook((b) => ({ ...b, colors: b.colors.filter((_, j) => j !== i) }))} aria-label="مسح"><I name="trash" /></button>
                </div>
              ))}
            </div>
            <div><button type="button" className="btn sm" onClick={() => setBook((b) => ({ ...b, colors: [...b.colors, { name: "", hex: "#7C6CFF", role: b.colors.length ? "secondary" : "primary" }] }))}><I name="plus" />ضيف لون</button></div>
          </div>

          <div className="card book-section">
            <h3><I name="edit" />الخطوط</h3>
            <div className="grid2">
              <label className="field"><span>خط العناوين</span><input className="input" value={book.headingFont} onChange={(e) => set("headingFont", e.target.value)} placeholder="مثلاً: Cairo" /></label>
              <label className="field"><span>خط النص</span><input className="input" value={book.bodyFont} onChange={(e) => set("bodyFont", e.target.value)} placeholder="مثلاً: Tajawal" /></label>
            </div>
            <small className="muted">لو رفعت ملف الخط بنفس الاسم هيتستخدم هو. لو لأ، بيتجاب من Google Fonts بالاسم.</small>
          </div>

          {dirty && (
            <div className="sticky-save">
              <span className="muted grow" style={{ alignSelf: "center" }}>فيه تعديلات مش متحفظة</span>
              <button type="button" className="btn ghost" onClick={() => { setBook(brand.book); setName(brand.name); setColor(brand.color); setFilled(false); }}>تراجع</button>
              <button type="button" className="btn primary" onClick={save} disabled={saving}>{saving ? "بيحفظ…" : "حفظ البراند بوك"}</button>
            </div>
          )}
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className="card book-section" style={{ borderColor: "color-mix(in srgb, var(--accent) 40%, transparent)" }}>
            <h3><I name="wand" />املاه أوتوماتيك</h3>
            <small className="muted">ارفع الجايدلاين (PDF أو صور) واللوجو تحت، أو اكتب وصف للبراند، والمصمم يملا البراند بوك كله.</small>
            <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="اختياري: اكتب أي حاجة عن البراند…" />
            <button type="button" className="btn primary" onClick={autofill} disabled={extracting}>{extracting ? "بيقرا الملفات…" : "املا البراند بوك"}</button>
          </div>

          {FILE_KINDS.map((fk) => {
            const list = files.filter((f) => f.kind === fk.k);
            return (
              <div key={fk.k} className="card book-section">
                <h3 className="row">{fk.title}<span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>{list.length || ""}</span></h3>
                <small className="muted">{fk.hint}{(fk.k === "product" || fk.k === "reference") && !ready.publicUrl ? " (عشان Higgsfield يستخدمها لازم التطبيق يكون مرفوع و APP_URL متحدد.)" : ""}</small>
                <div className="files-grid">
                  {list.map((f) => (
                    <div key={f.id} className={`file-tile ${fk.photo ? "photo" : ""}`} title={`${f.name} · ${kb(f.size)}`}>
                      {f.mime.startsWith("image/") ? <img src={f.url} alt={f.name} /> : <a href={f.url} target="_blank" rel="noreferrer" style={{ overflowWrap: "anywhere" }}>{f.name}</a>}
                      <button type="button" className="x" onClick={() => removeFile(f)} aria-label="مسح">×</button>
                    </div>
                  ))}
                  <label className="file-tile add">
                    <I name={busyKind === fk.k ? "upload" : "plus"} />{busyKind === fk.k ? "بيرفع…" : "ارفع"}
                    <input type="file" hidden multiple accept={fk.accept} onChange={(e) => { addFiles(fk.k, e.target.files); e.target.value = ""; }} />
                  </label>
                </div>
              </div>
            );
          })}

          <button type="button" className="btn danger ghost" onClick={deleteBrand}><I name="trash" />مسح البراند</button>
        </div>
      </div>
    </div>
  );
}
