"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "./App";
import { useData } from "@/lib/cache";
import { Avatar } from "./Avatar";
import { I, type IconName } from "./Icons";
import { useI18n } from "./I18n";
import TaskSheet from "./TaskSheet";
import { Segmented, useFlip } from "./Motion";
import { BrandMark, BrandSignature, useBrandTheme } from "./BrandMark";
import { STATUSES, ref, statusColor, type Status } from "@/lib/vocab";
import { api, dayDiff, isOpen, today, type Brand, type Task, type User } from "@/lib/client";

type Tile = "today" | "late" | "review" | "mine";
const PRANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

function sortTasks(a: Task, b: Task) {
  const ad = a.due || "9999", bd = b.due || "9999";
  if (ad !== bd) return ad < bd ? -1 : 1;
  const pr = (PRANK[a.priority] ?? 2) - (PRANK[b.priority] ?? 2);
  if (pr) return pr;
  return b.createdAt.localeCompare(a.createdAt);
}

export default function Studio() {
  const { me, query: q, newTick, storageWarning } = useApp();
  const i = useI18n();
  const { t } = i;
  const router = useRouter();
  const params = useSearchParams();
  const tasksQ = useData<Task[]>("/api/tasks", 10000);
  const tasks = tasksQ.data ?? null;
  const users = useData<User[]>("/api/users").data ?? [];
  const brands = useData<Brand[]>("/api/brands").data ?? [];
  const [brand, setBrand] = useState<string>(() => { try { return localStorage.getItem("cz-brand") || "all"; } catch { return "all"; } });
  const [view, setView] = useState<"board" | "list">("board");
  const [tile, setTile] = useState<Tile | "">("");
  const [fAssignee, setFAssignee] = useState("");
  const [fType, setFType] = useState("");
  const [open, setOpen] = useState<number | "draft" | null>(null);
  const [toast, setToast] = useState("");
  const [dragId, setDragId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isManager = me.role === "MANAGER";

  const say = useCallback((m: string) => {
    setToast(m);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(""), 2600);
  }, []);

  const load = useCallback(() => { tasksQ.reload().catch((e) => say((e as Error).message)); }, [tasksQ, say]);

  // Fall back to the first brand when the remembered one no longer exists
  useEffect(() => {
    if (brands.length && brand !== "all" && !brands.some((x) => x.id === brand)) setBrand(brands[0].id);
  }, [brands, brand]);

  useEffect(() => {
    try { const v = localStorage.getItem("cz-view"); if (v === "board" || v === "list") setView(v); else if (matchMedia("(max-width: 640px)").matches) setView("list"); } catch {}
  }, []);

  // The floating + button lives in the app frame
  const firstTick = useRef(newTick);
  useEffect(() => { if (newTick !== firstTick.current) setOpen("draft"); }, [newTick]);

  // Opening a notification lands on /?task=<id>
  useEffect(() => {
    const id = Number(params.get("task"));
    if (id) { setOpen(id); router.replace("/", { scroll: false }); }
  }, [params, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName || "";
      if (e.key === "n" && open === null && !/INPUT|TEXTAREA|SELECT/.test(tag)) { e.preventDefault(); setOpen("draft"); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const userById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);
  const brandById = useMemo(() => Object.fromEntries(brands.map((b) => [b.id, b])), [brands]);
  const all = (tasks ?? []).filter((x) => brand === "all" || x.brandId === brand);
  const current = brand === "all" ? null : brandById[brand];
  useBrandTheme(current);
  const pickBrand = (b: string) => { setBrand(b); try { localStorage.setItem("cz-brand", b); } catch {} };

  const tileMatch = (x: Task, k: Tile) => {
    const td = today();
    if (k === "today") return isOpen(x) && x.due === td;
    if (k === "late") return isOpen(x) && !!x.due && x.due < td;
    if (k === "review") return x.status === "review";
    return isOpen(x) && x.assigneeId === me.id;
  };

  const ql = q.trim().toLowerCase();
  const visible = all.filter((x) =>
    (!tile || tileMatch(x, tile)) &&
    (!fAssignee || (fAssignee === "_none" ? !x.assigneeId : x.assigneeId === fAssignee)) &&
    (!fType || x.type === fType) &&
    (!ql || [x.title, x.brief, i.type(x.type), ref(x.id), userById[x.assigneeId ?? ""]?.name ?? ""].join(" ").toLowerCase().includes(ql)));

  const flipKey = brand + "|" + view + "|" + visible.map((x) => `${x.id}:${x.status}:${x.due}`).join(",");
  const boardRef = useFlip<HTMLDivElement>(flipKey);
  const listRef = useFlip<HTMLDivElement>(flipKey);

  async function move(x: Task, to: Status) {
    if (x.status === to) return;
    if (to === "changes") { setOpen(x.id); say(t("toast.writeChanges")); return; }
    if (to === "done" && !isManager) { say(t("toast.approveManager")); return; }
    tasksQ.mutate((ts) => (ts ?? []).map((y) => (y.id === x.id ? { ...y, status: to } : y)));
    try {
      await api(`/api/tasks/${x.id}/status`, { method: "POST", json: { status: to } });
      say(t("toast.moved", { s: i.status(to) }));
    } catch (e) { say((e as Error).message); }
    load();
  }

  const tiles: { k: Tile; ic: IconName; c: string }[] = [
    { k: "today", ic: "today", c: "var(--blue)" },
    { k: "late", ic: "warn", c: "var(--red)" },
    { k: "review", ic: "eye", c: "var(--purple)" },
    { k: "mine", ic: "person", c: "var(--orange)" },
  ];
  const usedTypes = [...new Set(all.map((x) => x.type))];
  const assigned = [...new Set(all.map((x) => x.assigneeId).filter(Boolean))] as string[];
  const filtered = !!(tile || fAssignee || fType || q);
  const { setQuery } = useApp();
  const clear = () => { setTile(""); setFAssignee(""); setFType(""); setQuery(""); };

  const card = (x: Task) => {
    const di = i.due(x);
    const a = x.assigneeId ? userById[x.assigneeId] : null;
    return (
      <article key={x.id} data-flip={x.id} className={`card ${dragId === x.id ? "dragging" : ""}`} tabIndex={0} role="button" draggable
        onDragStart={(e) => { setDragId(x.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(x.id)); }}
        onDragEnd={() => { setDragId(null); setOverCol(null); }}
        onClick={() => setOpen(x.id)} onKeyDown={(e) => { if (e.key === "Enter") setOpen(x.id); }}>
        {x.coverFileId && <div className="cover"><img src={`/api/files/${x.coverFileId}`} alt="" loading="lazy" /></div>}
        <div className="card-top">
          {brand === "all" && brandById[x.brandId ?? ""] && <BrandMark brand={brandById[x.brandId!]} size={16} />}
          <span>{i.type(x.type)}</span>
          {x.priority === "urgent" && <span className="flag"><I name="flag" />{i.priority("urgent")}</span>}
          {x.priority === "high" && <span className="flag high"><I name="flag" />{i.priority("high")}</span>}
          <span className="ref">{ref(x.id)}</span>
        </div>
        <h3>{x.title}</h3>
        <div className="meta">
          {di && <span className={`chip ${di.cls}`}><I name="cal" />{di.label}</span>}
          {x.size && <span className="chip size">{x.size}</span>}
          {x.revisions > 0 && <span className="chip rev">R{x.revisions}</span>}
          {x._count.files > 0 && <span className="chip"><I name="clip" />{x._count.files}</span>}
          {x._count.activity > 0 && <span className="chip"><I name="list" />{x._count.activity}</span>}
        </div>
        <div className="card-foot"><Avatar user={a} /><span>{a ? a.name : t("card.unassigned")}</span></div>
      </article>
    );
  };

  function board() {
    return (
      <div className="board-scroll"><div className="board" ref={boardRef}>
        {STATUSES.map((s) => {
          const items = visible.filter((x) => x.status === s.k).sort(sortTasks);
          return (
            <section key={s.k} className={`col ${overCol === s.k ? "over" : ""}`} aria-label={i.status(s.k)}
              onDragOver={(e) => { if (dragId !== null) { e.preventDefault(); setOverCol(s.k); } }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null); }}
              onDrop={(e) => { e.preventDefault(); setOverCol(null); const x = all.find((y) => y.id === dragId); if (x) move(x, s.k); }}>
              <div className="col-h">
                <span className="sd" style={{ background: s.c, color: s.c }} />{i.status(s.k)}<span className="c">{items.length}</span>
                {s.k === "new" && <button type="button" className="add" aria-label={t("nav.new")} onClick={() => setOpen("draft")}><I name="plus" /></button>}
              </div>
              <div className="col-b">
                {items.length ? items.map(card) : <div className="col-empty">{s.k === "new" ? t("col.emptyNew") : t("col.emptyDrop")}</div>}
              </div>
            </section>
          );
        })}
      </div></div>
    );
  }

  function list() {
    const groups: { k: Parameters<typeof t>[0]; f: (x: Task) => boolean }[] = [
      { k: "list.late", f: (x) => isOpen(x) && !!x.due && dayDiff(x.due) < 0 },
      { k: "list.soon", f: (x) => isOpen(x) && !!x.due && dayDiff(x.due) >= 0 && dayDiff(x.due) <= 1 },
      { k: "list.week", f: (x) => isOpen(x) && !!x.due && dayDiff(x.due) > 1 && dayDiff(x.due) <= 7 },
      { k: "list.later", f: (x) => isOpen(x) && !!x.due && dayDiff(x.due) > 7 },
      { k: "list.noDate", f: (x) => isOpen(x) && !x.due },
      { k: "list.done", f: (x) => !isOpen(x) },
    ];
    return (
      <div className="list" ref={listRef}>
        {groups.map((g) => {
          const items = visible.filter(g.f).sort(sortTasks);
          if (!items.length) return null;
          return (
            <div key={g.k}>
              <div className="list-sec">{t(g.k)} · {items.length}</div>
              {items.map((x) => {
                const di = i.due(x), c = statusColor(x.status), a = x.assigneeId ? userById[x.assigneeId] : null;
                return (
                  <button type="button" key={x.id} data-flip={x.id} className="row" onClick={() => setOpen(x.id)}>
                    <span className={`ring ${x.status === "done" ? "done" : ""}`} style={{ ["--ring" as string]: c }}>{x.status === "done" && <I name="check" />}</span>
                    <span style={{ minWidth: 0 }}>
                      <span className="rt">{x.title}</span>
                      <span className="rm">
                        <span className="chip" style={{ color: c }}>{i.status(x.status)}</span>
                        {di && <span className={`chip ${di.cls}`}><I name="cal" />{di.label}</span>}
                        {brand === "all" && brandById[x.brandId ?? ""] && <span className="chip"><BrandMark brand={brandById[x.brandId!]} size={14} />{brandById[x.brandId!].name}</span>}
                        <span className="chip">{i.type(x.type)}</span>
                        {x.revisions > 0 && <span className="chip rev">R{x.revisions}</span>}
                        {x.priority === "urgent" && <span className="flag"><I name="flag" />{i.priority("urgent")}</span>}
                      </span>
                    </span>
                    <span className="rr"><Avatar user={a} /><span className="nm" style={{ color: "var(--ink-2)", fontSize: 13 }}>{a?.name}</span></span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  let content: React.ReactNode;
  if (tasks === null) content = <div className="empty"><p>{t("empty.loading")}</p></div>;
  else if (!all.length) content = (
    <div className="empty"><div className="big"><I name="tray" /></div><h2>{t("empty.title")}</h2>
      <p>{t("empty.body")}</p>
      <button type="button" className="btn btn-primary" onClick={() => setOpen("draft")}><I name="plus" />{t("empty.cta")}</button></div>
  );
  else if (!visible.length) content = (
    <div className="empty"><div className="big"><I name="search" /></div><h2>{t("empty.noResults")}</h2><p>{t("empty.noResultsBody")}</p>
      <button type="button" className="btn btn-tinted" onClick={clear}>{t("filter.clear")}</button></div>
  );
  else content = view === "board" ? board() : list();

  return (
    <>
      <main className="wrap">
        <section className="head">
          <div>
            {current && <BrandSignature key={current.id} brand={current} />}
            <h1>{t("tasks.title")}</h1>
            <div className="sub">{i.longDate(new Date())} · {t("tasks.openCount", { n: all.filter(isOpen).length })}</div>
          </div>
          <div className="actions">
            <button className="btn btn-primary" type="button" onClick={() => setOpen("draft")}><I name="plus" />{t("nav.new")}</button>
          </div>
        </section>

        {storageWarning && (
          <div className="banner danger" role="alert"><I name="warn" /><span><b>{t("warn.storageTitle")}</b> {t("warn.storageBody")}</span></div>
        )}

        {brands.length > 0 && (
          <div className="brand-tabs">
            <Segmented label={t("field.brand")} value={brand} onChange={pickBrand} className="brand-seg"
              options={[...brands.map((b) => ({ value: b.id, label: <><BrandMark brand={b} size={22} />{b.slug === "dym" ? <span className="sr-only">{b.name}</span> : b.name}</> })), { value: "all", label: t("brand.all") }]} />
          </div>
        )}

        <section className="tiles" key={`tiles-${brand}`} aria-label={t("tasks.title")}>
          {tiles.map((x) => (
            <button key={x.k} type="button" className="tile" aria-pressed={tile === x.k} style={{ ["--tile-c" as string]: x.c }} onClick={() => setTile(tile === x.k ? "" : x.k)}>
              <span className="dot" style={{ background: x.c }}><I name={x.ic} /></span>
              <span className="n">{all.filter((y) => tileMatch(y, x.k)).length}</span>
              <span className="t">{t(`tile.${x.k}`)}</span>
            </button>
          ))}
        </section>

        <div className="toolbar">
          <Segmented label={t("view.board")} value={view} onChange={(v) => { setView(v); try { localStorage.setItem("cz-view", v); } catch {} }}
            options={[{ value: "board", label: t("view.board") }, { value: "list", label: t("view.list") }]} />
          <select className="select" id="fAssignee" aria-label={t("field.designer")} value={fAssignee} onChange={(e) => setFAssignee(e.target.value)}>
            <option value="">{t("filter.allDesigners")}</option>
            {assigned.map((id) => <option key={id} value={id}>{userById[id]?.name ?? "—"}</option>)}
            <option value="_none">{t("filter.unassigned")}</option>
          </select>
          <select className="select" id="fType" aria-label={t("field.type")} value={fType} onChange={(e) => setFType(e.target.value)}>
            <option value="">{t("filter.allTypes")}</option>
            {usedTypes.map((x) => <option key={x} value={x}>{i.type(x)}</option>)}
          </select>
          {filtered && <div className="filter-note"><span>{t("filter.count", { shown: visible.length, total: all.length })}</span><button type="button" onClick={clear}>{t("filter.clear")}</button></div>}
        </div>

        <section key={`content-${brand}-${view}`} className="enter">{content}</section>
      </main>

      {open !== null && (
        <TaskSheet key={String(open)} id={open} me={me} users={users} userById={userById} brands={brands} defaultBrandId={brand !== "all" ? brand : brands[0]?.id}
          onClose={() => setOpen(null)} onChanged={load} onCreated={(id) => setOpen(id)} say={say} />
      )}
      <div className={`toast ${toast ? "on" : ""}`} role="status" aria-live="polite">{toast}</div>
    </>
  );
}
