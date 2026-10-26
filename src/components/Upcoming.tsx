"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Portal } from "./Portal";
import { I } from "./Icons";
import { useI18n } from "./I18n";
import { BrandMark } from "./BrandMark";
import { DatePicker, Picker } from "./Pickers";
import { useData, revalidate } from "@/lib/cache";
import { api, dayDiff, intlTag, parseYmd, type Brand, type Upcoming } from "@/lib/client";

export type UpcomingFilter = { brand: string; branch: string };

/** Items for the current brand/branch tab. Brand-less and branch-less items show everywhere. */
export function visibleUpcoming(items: Upcoming[], f: UpcomingFilter) {
  return items.filter((x) => (f.brand === "all" || !x.brandId || x.brandId === f.brand) && (f.branch === "all" || !x.branchId || x.branchId === f.branch));
}
const sortUp = (a: Upcoming, b: Upcoming) => (a.date || "9999").localeCompare(b.date || "9999") || a.createdAt.localeCompare(b.createdAt);

function useWhen() {
  const { t } = useI18n();
  return useCallback((date: string | null) => {
    if (!date) return { label: t("upc.noDate"), d: null as number | null, cls: "none" };
    const d = dayDiff(date);
    const label = d < 0 ? t("upc.past") : d === 0 ? t("upc.today") : d === 1 ? t("upc.tomorrow")
      : d === 2 ? t("upc.inTwoDays") : d <= 10 ? t("upc.inDaysFew", { n: d }) : d <= 59 ? t("upc.inDaysMany", { n: d })
      : Math.round(d / 30) === 2 ? t("upc.inTwoMonths") : t("upc.inMonths", { n: Math.round(d / 30) });
    return { label, d, cls: d < 0 ? "past" : d <= 3 ? "soon" : d <= 14 ? "near" : "" };
  }, [t]);
}

/** The moving strip on the board. */
export function UpcomingTicker({ items, brands, canAdd, onOpen }: { items: Upcoming[]; brands: Brand[]; canAdd: boolean; onOpen: (add?: boolean) => void }) {
  const { t } = useI18n();
  const when = useWhen();
  const list = items.filter((x) => !x.date || dayDiff(x.date) >= 0).sort(sortUp);
  const brandById = useMemo(() => Object.fromEntries(brands.map((b) => [b.id, b])), [brands]);
  const view = useRef<HTMLDivElement>(null);
  const group = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState<{ reps: number; dur: number }>({ reps: 1, dur: 30 });

  // Repeat the items until one copy is wider than the strip, so it always scrolls; speed stays constant
  useLayoutEffect(() => {
    const v = view.current, g = group.current;
    if (!v || !g) return;
    const measure = () => setRun((r) => {
      const one = g.scrollWidth / r.reps;
      if (!one) return r;
      const reps = Math.max(1, Math.ceil((v.clientWidth + 40) / one));
      const dur = Math.max(14, (one * reps) / 40);
      return reps === r.reps && Math.abs(dur - r.dur) < 0.5 ? r : { reps, dur };
    });
    measure();
    const ro = new ResizeObserver(measure); ro.observe(v); ro.observe(g);
    return () => ro.disconnect();
  }, [list.length]);

  if (!list.length && !canAdd) return null;
  const items1 = (k: number) => list.map((x) => {
    const w = when(x.date), b = x.brandId ? brandById[x.brandId] : null;
    return (
      <button key={`${k}-${x.id}`} type="button" className="upc-item" tabIndex={k ? -1 : 0} onClick={() => onOpen()}>
        {b && <BrandMark brand={b} size={18} />}
        <span className="upc-t">{x.title}</span>
        <span className={`upc-when ${w.cls}`}>{w.label}</span>
      </button>
    );
  });

  return (
    <section className={`upc glass ${list.length ? "run" : ""}`} aria-label={t("upc.title")}>
      <button type="button" className="upc-label" onClick={() => onOpen()}>
        <span className="upc-pulse" aria-hidden="true" /><span>{t("upc.label")}</span>
        {list.length > 0 && <span className="upc-n">{list.length}</span>}
      </button>
      <div className="upc-view" ref={view}>
        {list.length ? (
          <div className="upc-track" style={{ ["--upc-dur" as string]: `${run.dur}s` }}>
            <div className="upc-group" ref={group}>{Array.from({ length: run.reps }, (_, k) => items1(k))}</div>
            <div className="upc-group" aria-hidden="true" inert>{Array.from({ length: run.reps }, (_, k) => items1(k + 1))}</div>
          </div>
        ) : <button type="button" className="upc-emptyline" onClick={() => onOpen(true)}>{t("upc.emptyManager")}</button>}
      </div>
      {canAdd && <button type="button" className="upc-add" onClick={() => onOpen(true)} aria-label={t("upc.addTitle")}><I name="plus" /></button>}
    </section>
  );
}

type Form = { title: string; note: string; date: string; brandId: string; branchId: string; notify: boolean };
const blank = (brandId: string): Form => ({ title: "", note: "", date: "", brandId, branchId: "", notify: true });

/** Full list: grouped by how soon, with add/edit/delete for managers and "start a task" for everyone. */
export function UpcomingSheet({ items, brands, isManager, defaultBrand, startAdding, onClose, onStartTask, say }: {
  items: Upcoming[]; brands: Brand[]; isManager: boolean; defaultBrand: string; startAdding: boolean;
  onClose: () => void; onStartTask: (x: Upcoming) => void; say: (m: string) => void;
}) {
  const i = useI18n(); const { t } = i;
  const when = useWhen();
  const [on, setOn] = useState(false);
  const [form, setForm] = useState<Form | null>(startAdding && isManager ? blank(defaultBrand) : null);
  const [editing, setEditing] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const brandById = useMemo(() => Object.fromEntries(brands.map((b) => [b.id, b])), [brands]);
  const branchById = useMemo(() => Object.fromEntries(brands.flatMap((b) => b.branches ?? []).map((b) => [b.id, b])), [brands]);

  useEffect(() => { requestAnimationFrame(() => setOn(true)); }, []);
  const close = useCallback(() => { setOn(false); setTimeout(onClose, 380); }, [onClose]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [close]);
  useEffect(() => { if (form) setTimeout(() => titleRef.current?.focus(), 420); }, [form === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const g: Record<"week" | "month" | "later" | "noDate" | "past", Upcoming[]> = { week: [], month: [], later: [], noDate: [], past: [] };
    [...items].sort(sortUp).forEach((x) => {
      if (!x.date) return g.noDate.push(x);
      const d = dayDiff(x.date);
      (d < 0 ? g.past : d <= 7 ? g.week : d <= 31 ? g.month : g.later).push(x);
    });
    g.past.reverse();
    return g;
  }, [items]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      const body = { title: form.title, note: form.note, date: form.date || null, brandId: form.brandId || null, branchId: form.branchId || null };
      if (editing) await api(`/api/upcoming/${editing}`, { method: "PATCH", json: body });
      else await api("/api/upcoming", { method: "POST", json: { ...body, notify: form.notify } });
      say(editing ? t("upc.saved") : t("upc.added"));
      setForm(null); setEditing(null);
      await revalidate("/api/upcoming");
    } catch (err) { say((err as Error).message); }
    setBusy(false);
  }

  async function remove(x: Upcoming) {
    if (armed !== x.id) { setArmed(x.id); setTimeout(() => setArmed((a) => (a === x.id ? null : a)), 3500); return; }
    try { await api(`/api/upcoming/${x.id}`, { method: "DELETE" }); say(t("upc.deleted")); await revalidate("/api/upcoming"); }
    catch (err) { say((err as Error).message); }
  }

  const edit = (x: Upcoming) => { setEditing(x.id); setForm({ title: x.title, note: x.note, date: x.date ?? "", brandId: x.brandId ?? "", branchId: x.branchId ?? "", notify: false }); };
  const formBranches = form?.brandId ? brandById[form.brandId]?.branches ?? [] : [];
  const fmtDay = new Intl.DateTimeFormat(intlTag(i.l), { day: "numeric" }), fmtMon = new Intl.DateTimeFormat(intlTag(i.l), { month: "short" });

  const row = (x: Upcoming) => {
    const w = when(x.date), b = x.brandId ? brandById[x.brandId] : null, br = x.branchId ? branchById[x.branchId] : null;
    return (
      <div key={x.id} className={`upc-row ${w.cls}`}>
        <div className="upc-date" aria-hidden="true">
          {x.date ? <><b>{fmtDay.format(parseYmd(x.date))}</b><small>{fmtMon.format(parseYmd(x.date))}</small></> : <I name="clock" />}
        </div>
        <div className="grow upc-body">
          <div className="upc-rt">{x.title}</div>
          {x.note && <div className="upc-note">{x.note}</div>}
          <div className="upc-meta">
            <span className={`upc-when ${w.cls}`}>{w.label}</span>
            {b && <span className="chip">{<BrandMark brand={b} size={16} />}{b.slug === "dym" ? null : b.name}</span>}
            {br && <span className="branch-code" title={i.l === "ar" ? br.name : br.nameEn}>{br.code}</span>}
          </div>
        </div>
        <div className="upc-acts">
          <button type="button" className="btn btn-tinted" onClick={() => onStartTask(x)}><I name="plus" />{t("upc.startTask")}</button>
          {isManager && <>
            <button type="button" className="btn btn-gray" onClick={() => edit(x)}>{t("upc.edit")}</button>
            <button type="button" className={`kit-del ${armed === x.id ? "armed" : ""}`} onClick={() => remove(x)} aria-label={t("kit.delete")}>
              {armed === x.id ? t("kit.deleteConfirm") : <I name="trash" />}
            </button>
          </>}
        </div>
      </div>
    );
  };

  return (
    <Portal>
      <div className={`scrim ${on ? "on" : ""}`} onClick={close} />
      <div className={`sheet narrow upc-sheet ${on ? "on" : ""}`} role="dialog" aria-modal="true" aria-label={t("upc.title")}>
        <div className="sheet-bar">
          <span className="grab" />
          <div className="ttl"><span className="upc-pulse" aria-hidden="true" />{t("upc.title")}</div>
          <button type="button" className="done-btn" onClick={close}>{t("sheet.done")}</button>
        </div>
        <div className="sheet-body single">
          <div className="main">
            <div className="upc-sub">{t("upc.sub")}</div>
            {isManager && (form ? (
              <form className="group upc-form enter" onSubmit={save}>
                <input ref={titleRef} id="upTitle" className="upc-in" placeholder={t("upc.titlePh")} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} />
                <textarea id="upNote" className="upc-in upc-ta" rows={2} placeholder={t("upc.notePh")} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                <div className="upc-fields">
                  <DatePicker id="upDate" label={t("upc.date")} value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
                  <Picker id="upBrand" label={t("field.brand")} value={form.brandId} onChange={(v) => setForm({ ...form, brandId: v, branchId: "" })}
                    options={[{ value: "", label: t("upc.allBrands") }, ...brands.map((b) => ({ value: b.id, label: b.name, iconOnly: b.slug === "dym", icon: <BrandMark brand={b} size={20} /> }))]} />
                  {formBranches.length > 0 && (
                    <Picker id="upBranch" label={t("field.branch")} value={form.branchId} onChange={(v) => setForm({ ...form, branchId: v })}
                      options={[{ value: "", label: t("upc.allBranches") }, ...formBranches.map((b) => ({ value: b.id, label: i.l === "ar" ? b.name : b.nameEn, icon: <span className="branch-code">{b.code}</span> }))]} />
                  )}
                </div>
                <div className="upc-form-foot">
                  {!editing && (
                    <label className="upc-check"><input type="checkbox" checked={form.notify} onChange={(e) => setForm({ ...form, notify: e.target.checked })} />{t("upc.notify")}</label>
                  )}
                  <span className="grow" />
                  <button type="button" className="btn btn-gray" onClick={() => { setForm(null); setEditing(null); }}>{t("upc.cancel")}</button>
                  <button className="btn btn-primary" disabled={busy || !form.title.trim()}>{editing ? t("upc.save") : <><I name="plus" />{t("upc.add")}</>}</button>
                </div>
              </form>
            ) : (
              <button type="button" className="btn btn-glass upc-new" onClick={() => setForm(blank(defaultBrand))}><I name="plus" />{t("upc.addTitle")}</button>
            ))}
            {!items.length && !form && <div className="empty"><p>{isManager ? t("upc.emptyManager") : t("upc.empty")}</p></div>}
            {(["week", "month", "later", "noDate", "past"] as const).map((k) => groups[k].length > 0 && (
              <section key={k} className="upc-sec">
                <div className="list-sec">{t(`upc.g.${k}`)} · {groups[k].length}</div>
                <div className="group upc-list">{groups[k].map(row)}</div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </Portal>
  );
}
