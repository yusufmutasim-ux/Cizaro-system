"use client";
import { Portal } from "./Portal";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "./App";
import { useData } from "@/lib/cache";
import { I, type IconName } from "./Icons";
import { useI18n } from "./I18n";
import { Segmented, useFlip } from "./Motion";
import { BrandMark, BrandSignature, useBrandTheme } from "./BrandMark";
import { api, kb, type Brand, type BrandAsset, type User } from "@/lib/client";
import type { Key } from "@/lib/i18n";

type Cat = "logo" | "font" | "color" | "guideline" | "template" | "other";
const SECTIONS: { k: Cat; icon: IconName; accept?: string }[] = [
  { k: "logo", icon: "photo", accept: "image/*,.svg,.ai,.eps,.pdf" },
  { k: "font", icon: "doc", accept: ".ttf,.otf,.woff,.woff2,.zip" },
  { k: "color", icon: "circle" },
  { k: "guideline", icon: "doc", accept: ".pdf,image/*" },
  { k: "template", icon: "grid" },
  { k: "other", icon: "clip" },
];

const href = (a: BrandAsset, download = false) => `/api/brand-assets/${a.id}${download ? "?download=1" : ""}`;
const ext = (n: string) => (n.split(".").pop() ?? "").toUpperCase().slice(0, 5);

export default function BrandKit() {
  const { me } = useApp();
  const { t } = useI18n();
  const isManager = me.role === "MANAGER";
  const brandsQ = useData<Brand[]>("/api/brands");
  const brands = brandsQ.data ?? [];
  const setBrands = brandsQ.mutate;
  const [picked, setBrandId] = useState(() => { try { return localStorage.getItem("cz-brand") || ""; } catch { return ""; } });
  const brandId = brands.some((b) => b.id === picked) ? picked : brands[0]?.id ?? "";
  const assetsQ = useData<BrandAsset[]>(brandId ? `/api/brands/${brandId}/assets` : null);
  const assets = assetsQ.data ?? null;
  const [toast, setToast] = useState("");
  const [uploading, setUploading] = useState<Partial<Record<Cat, number>>>({});
  const [armed, setArmed] = useState<string | null>(null);
  const [color, setColor] = useState({ name: "", value: "#3B47B0" });
  const [newBrand, setNewBrand] = useState<{ name: string; color: string } | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const colorT = useRef<ReturnType<typeof setTimeout>>(undefined);

  const say = useCallback((m: string) => {
    setToast(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(""), 2400);
  }, []);

  const loadBrands = useCallback(async (select?: string) => {
    await brandsQ.reload();
    if (select) setBrandId(select);
  }, [brandsQ]);

  const loadAssets = useCallback(async () => {
    try { await assetsQ.reload(); } catch (e) { say((e as Error).message); }
  }, [assetsQ, say]);

  const brand = brands.find((b) => b.id === brandId);
  useBrandTheme(brand);
  const by = useMemo(() => {
    const m: Record<Cat, BrandAsset[]> = { logo: [], font: [], color: [], guideline: [], template: [], other: [] };
    (assets ?? []).forEach((a) => (m[a.category as Cat] ?? m.other).push(a));
    return m;
  }, [assets]);
  const flipRef = useFlip<HTMLDivElement>(brandId + "|" + (assets ?? []).map((a) => a.id).join(","));

  // Register uploaded fonts so their cards preview in the real typeface
  const fontCss = by.font.filter((a) => /^font\//.test(a.mime ?? "")).map((a) => `@font-face{font-family:"bf-${a.id}";src:url(${href(a)});font-display:swap}`).join("");

  function pick(b: string) { setBrandId(b); try { localStorage.setItem("cz-brand", b); } catch {} }

  async function upload(cat: Cat, list: FileList | null) {
    if (!list?.length) return;
    const fd = new FormData();
    fd.set("category", cat);
    [...list].forEach((f) => fd.append("file", f));
    setUploading((u) => ({ ...u, [cat]: list.length }));
    try { await api(`/api/brands/${brandId}/assets`, { method: "POST", body: fd }); say(t("kit.uploaded")); await loadAssets(); loadBrands(); }
    catch (e) { say((e as Error).message); }
    setUploading((u) => ({ ...u, [cat]: 0 }));
  }

  async function addColor(e: React.FormEvent) {
    e.preventDefault();
    try { await api(`/api/brands/${brandId}/assets`, { method: "POST", json: { category: "color", ...color } }); setColor({ name: "", value: color.value }); loadAssets(); }
    catch (err) { say((err as Error).message); }
  }

  async function remove(a: BrandAsset) {
    if (armed !== a.id) { setArmed(a.id); setTimeout(() => setArmed((x) => (x === a.id ? null : x)), 3500); return; }
    try { await api(`/api/brand-assets/${a.id}`, { method: "DELETE" }); say(t("kit.deleted")); loadAssets(); loadBrands(); }
    catch (e) { say((e as Error).message); }
  }

  async function copy(v: string) {
    try { await navigator.clipboard.writeText(v); } catch {}
    say(t("kit.copied", { v }));
  }

  async function createBrand(e: React.FormEvent) {
    e.preventDefault();
    if (!newBrand) return;
    try { const b = await api<Brand>("/api/brands", { method: "POST", json: newBrand }); setNewBrand(null); await loadBrands(b.id); pick(b.id); }
    catch (err) { say((err as Error).message); }
  }

  async function setBrandColor(c: string) {
    if (!brand) return;
    const id = brand.id;
    setBrands((bs) => (bs ?? []).map((b) => (b.id === id ? { ...b, color: c } : b)));
    clearTimeout(colorT.current);
    colorT.current = setTimeout(() => api(`/api/brands/${id}`, { method: "PATCH", json: { color: c } }).catch((e) => say(e.message)), 400);
  }

  const del = (a: BrandAsset) => isManager && (
    <button type="button" className={`kit-del ${armed === a.id ? "armed" : ""}`} onClick={() => remove(a)} aria-label={t("kit.delete")}>
      {armed === a.id ? t("kit.deleteConfirm") : <I name="trash" />}
    </button>
  );

  function section(s: (typeof SECTIONS)[number]) {
    const items = by[s.k];
    if (!isManager && !items.length) return null;
    const busy = uploading[s.k];
    return (
      <section key={s.k} className="kit-sec" data-flip={`sec-${s.k}`}>
        <div className="group-h">
          <I name={s.icon} />{t(`kit.${s.k}` as Key)}<span style={{ color: "var(--ink-3)", fontWeight: 500 }}>{items.length || ""}</span>
          {isManager && s.k !== "color" && (
            <span className="act">
              <label style={{ cursor: "pointer", display: "inline-flex", gap: 4, alignItems: "center" }}>
                <I name="plus" />{busy ? t("kit.uploading") : t("kit.upload")}
                <input type="file" multiple hidden accept={s.accept} onChange={(e) => { upload(s.k, e.target.files); e.target.value = ""; }} />
              </label>
            </span>
          )}
        </div>

        {s.k === "logo" && (
          <div className="kit-grid logos">
            {items.map((a) => (
              <div key={a.id} className="kit-logo" data-flip={a.id}>
                <a href={href(a)} target="_blank" rel="noopener noreferrer" className="kit-logo-th">
                  {a.mime?.startsWith("image/") ? <img src={href(a)} alt={a.name} loading="lazy" /> : <span className="kit-ext">{ext(a.name)}</span>}
                </a>
                <div className="kit-meta"><span className="kit-name" title={a.name}>{a.name}</span><small>{kb(a.size)}</small></div>
                <div className="kit-acts">
                  <a className="btn btn-gray" href={href(a, true)}><I name="up" className="flip-y" />{t("kit.download")}</a>
                  {del(a)}
                </div>
              </div>
            ))}
            {!items.length && <div className="files-empty">{t("kit.empty")}</div>}
          </div>
        )}

        {s.k === "font" && (
          <div className="group kit-list">
            {items.map((a) => (
              <div key={a.id} className="kit-font" data-flip={a.id}>
                <span className="kit-aa" style={{ fontFamily: `"bf-${a.id}", var(--font)` }}>Aa</span>
                <div className="kit-meta grow">
                  <span className="kit-name" title={a.name}>{a.name}</span>
                  <span className="kit-sample" style={{ fontFamily: `"bf-${a.id}", var(--font)` }}>{t("kit.fontSample")}</span>
                </div>
                <div className="kit-acts">
                  <a className="btn btn-gray" href={href(a, true)}><I name="up" className="flip-y" />{t("kit.download")}</a>
                  {del(a)}
                </div>
              </div>
            ))}
            {!items.length && <div className="files-empty">{t("kit.empty")}</div>}
          </div>
        )}

        {s.k === "color" && (
          <>
            <div className="kit-grid colors">
              {items.map((a) => (
                <div key={a.id} className="kit-color" data-flip={a.id}>
                  <button type="button" className="kit-swatch" style={{ background: a.value ?? "#000" }} onClick={() => copy(a.value ?? "")} aria-label={`${t("kit.copy")} ${a.value}`}>
                    <span>{t("kit.copy")}</span>
                  </button>
                  <div className="kit-meta"><span className="kit-name">{a.name}</span><small className="mono">{a.value}</small></div>
                  {del(a)}
                </div>
              ))}
              {!items.length && !isManager && <div className="files-empty">{t("kit.empty")}</div>}
            </div>
            {isManager && (
              <form className="kit-addcolor group" onSubmit={addColor}>
                <input type="color" id="c-pick" value={color.value} onChange={(e) => setColor({ ...color, value: e.target.value })} aria-label={t("kit.color")} />
                <input type="text" id="c-hex" dir="ltr" className="mono" value={color.value} onChange={(e) => setColor({ ...color, value: e.target.value })} aria-label="HEX" />
                <input type="text" id="c-name" placeholder={t("kit.colorName")} value={color.name} onChange={(e) => setColor({ ...color, name: e.target.value })} />
                <button className="btn btn-primary"><I name="plus" />{t("kit.add")}</button>
              </form>
            )}
          </>
        )}

        {(s.k === "guideline" || s.k === "template" || s.k === "other") && (
          <div className="group kit-list">
            {items.map((a) => (
              <div key={a.id} className="kit-file" data-flip={a.id}>
                <a href={href(a)} target="_blank" rel="noopener noreferrer" className="kit-ico">
                  {a.mime?.startsWith("image/") ? <img src={href(a)} alt="" loading="lazy" /> : <span className="kit-ext">{ext(a.name)}</span>}
                </a>
                <div className="kit-meta grow"><span className="kit-name" title={a.name}>{a.name}</span><small>{kb(a.size)}</small></div>
                <div className="kit-acts">
                  <a className="btn btn-gray" href={href(a, true)}><I name="up" className="flip-y" />{t("kit.download")}</a>
                  {del(a)}
                </div>
              </div>
            ))}
            {!items.length && <div className="files-empty">{t("kit.empty")}</div>}
          </div>
        )}
      </section>
    );
  }

  return (
    <>
      {fontCss && <style>{fontCss}</style>}
      <main className="wrap">
        <section className="head">
          <div>
            <h1>{t("kit.title")}</h1>
            <div className="sub">{t("kit.sub")}</div>
          </div>
          {isManager && (
            <div className="actions">
              <button type="button" className="btn btn-glass" onClick={() => setNewBrand(newBrand ? null : { name: "", color: "#3B47B0" })}><I name="plus" />{t("kit.newBrand")}</button>
            </div>
          )}
        </section>

        {newBrand && (
          <form className="kit-newbrand group enter" onSubmit={createBrand}>
            <input type="color" id="nb-color" value={newBrand.color} onChange={(e) => setNewBrand({ ...newBrand, color: e.target.value })} aria-label={t("kit.color")} />
            <input type="text" id="nb-name" placeholder={t("kit.brandNamePh")} value={newBrand.name} onChange={(e) => setNewBrand({ ...newBrand, name: e.target.value })} autoFocus />
            <button className="btn btn-primary">{t("kit.add")}</button>
          </form>
        )}

        {brands.length > 0 && (
          <div className="brand-tabs">
            <Segmented label={t("field.brand")} value={brandId} onChange={pick} className="brand-seg"
              options={brands.map((b) => ({ value: b.id, label: <><BrandMark brand={b} size={22} />{b.slug === "dym" ? <span className="sr-only">{b.name}</span> : b.name}</> }))} />
          </div>
        )}

        {brand && (
          <div key={brand.id} className="enter">
            <div className="kit-hero glass" style={{ ["--bc" as string]: brand.color }}>
              {brand.slug !== "dym" && <BrandMark brand={brand} size={64} />}
              <div className="grow">
                {brand.slug === "dym" ? <h2 className="sr-only">{brand.name}</h2> : <h2>{brand.name}</h2>}
                {brand.slug === "dym" && <BrandSignature brand={brand} />}
                <div className="sub">{t("kit.files", { n: brand._count?.assets ?? 0 })}</div>
              </div>
              {isManager && (
                <label className="kit-brandcolor" title={t("kit.color")}>
                  <span style={{ background: brand.color }} />
                  <input type="color" value={brand.color} onChange={(e) => setBrandColor(e.target.value)} />
                </label>
              )}
            </div>
            {!isManager && <div className="note" style={{ marginBottom: 12 }}>{t("kit.viewOnly")}</div>}
            {assets === null ? <div className="empty"><p>{t("sheet.loading")}</p></div> : (
              <div className="kit" ref={flipRef}>{SECTIONS.map(section)}</div>
            )}
          </div>
        )}
      </main>
      <Portal><div className={`toast ${toast ? "on" : ""}`} role="status" aria-live="polite">{toast}</div></Portal>
    </>
  );
}
