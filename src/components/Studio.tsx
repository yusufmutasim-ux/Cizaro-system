"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Nav } from "./Nav";
import { Avatar } from "./Avatar";
import { I, type IconName } from "./Icons";
import TaskSheet from "./TaskSheet";
import { STATUSES, S, ref, type Status } from "@/lib/vocab";
import { api, dayDiff, dueInfo, fmtLong, isOpen, today, type Task, type User } from "@/lib/client";

type Tile = "today" | "late" | "review" | "mine";
const PRANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

function sortTasks(a: Task, b: Task) {
  const ad = a.due || "9999", bd = b.due || "9999";
  if (ad !== bd) return ad < bd ? -1 : 1;
  const pr = (PRANK[a.priority] ?? 2) - (PRANK[b.priority] ?? 2);
  if (pr) return pr;
  return b.createdAt.localeCompare(a.createdAt);
}

export default function Studio({ me }: { me: User }) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [view, setView] = useState<"board" | "list">("board");
  const [tile, setTile] = useState<Tile | "">("");
  const [q, setQ] = useState("");
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

  const load = useCallback(async () => {
    try { setTasks(await api<Task[]>("/api/tasks")); } catch (e) { say((e as Error).message); }
  }, [say]);

  useEffect(() => {
    load();
    api<User[]>("/api/users").then(setUsers).catch(() => {});
    try { const v = localStorage.getItem("cz-view"); if (v === "board" || v === "list") setView(v); else if (matchMedia("(max-width: 640px)").matches) setView("list"); } catch {}
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 10000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || "");
      if (e.key === "n" && open === null && !/INPUT|TEXTAREA|SELECT/.test(tag)) { e.preventDefault(); setOpen("draft"); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const userById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);
  const all = tasks ?? [];

  const tileMatch = (t: Task, k: Tile) => {
    const td = today();
    if (k === "today") return isOpen(t) && t.due === td;
    if (k === "late") return isOpen(t) && !!t.due && t.due < td;
    if (k === "review") return t.status === "review";
    return isOpen(t) && t.assigneeId === me.id;
  };

  const visible = all.filter((t) => {
    const ql = q.trim().toLowerCase();
    return (!tile || tileMatch(t, tile)) &&
      (!fAssignee || (fAssignee === "_none" ? !t.assigneeId : t.assigneeId === fAssignee)) &&
      (!fType || t.type === fType) &&
      (!ql || [t.title, t.brief, t.type, ref(t.id), userById[t.assigneeId ?? ""]?.name ?? ""].join(" ").toLowerCase().includes(ql));
  });

  async function move(t: Task, to: Status) {
    if (t.status === to) return;
    if (to === "changes") { setOpen(t.id); say("اكتب التعديلات المطلوبة من خانة المراجعة"); return; }
    if (to === "done" && !isManager) { say("الاعتماد للمدير بس. ابعته للمراجعة."); return; }
    setTasks((ts) => ts && ts.map((x) => (x.id === t.id ? { ...x, status: to } : x)));
    try {
      await api(`/api/tasks/${t.id}/status`, { method: "POST", json: { status: to } });
      say(`اتنقل لـ «${S[to].l}»`);
    } catch (e) { say((e as Error).message); }
    load();
  }

  const tiles: { k: Tile; t: string; ic: IconName; c: string }[] = [
    { k: "today", t: "النهارده", ic: "today", c: "var(--blue)" },
    { k: "late", t: "متأخرة", ic: "warn", c: "var(--red)" },
    { k: "review", t: "مستنية مراجعة", ic: "eye", c: "var(--purple)" },
    { k: "mine", t: "تاسكاتي", ic: "person", c: "var(--orange)" },
  ];
  const usedTypes = [...new Set(all.map((t) => t.type))];
  const assigned = [...new Set(all.map((t) => t.assigneeId).filter(Boolean))] as string[];
  const filtered = !!(tile || fAssignee || fType || q);
  const clear = () => { setTile(""); setFAssignee(""); setFType(""); setQ(""); };

  const card = (t: Task) => {
    const di = dueInfo(t);
    const a = t.assigneeId ? userById[t.assigneeId] : null;
    return (
      <article key={t.id} className={`card ${dragId === t.id ? "dragging" : ""}`} tabIndex={0} role="button" draggable
        onDragStart={(e) => { setDragId(t.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(t.id)); }}
        onDragEnd={() => { setDragId(null); setOverCol(null); }}
        onClick={() => setOpen(t.id)} onKeyDown={(e) => { if (e.key === "Enter") setOpen(t.id); }}>
        {t.coverFileId && <div className="cover"><img src={`/api/files/${t.coverFileId}`} alt="" loading="lazy" /></div>}
        <div className="card-top">
          <span>{t.type}</span>
          {t.priority === "urgent" && <span className="flag"><I name="flag" />عاجل</span>}
          {t.priority === "high" && <span className="flag high"><I name="flag" />عالية</span>}
          <span className="ref">{ref(t.id)}</span>
        </div>
        <h3>{t.title}</h3>
        <div className="meta">
          {di && <span className={`chip ${di.cls}`}><I name="cal" />{di.label}</span>}
          {t.size && <span className="chip size">{t.size}</span>}
          {t.revisions > 0 && <span className="chip rev">R{t.revisions}</span>}
          {t._count.files > 0 && <span className="chip"><I name="clip" />{t._count.files}</span>}
          {t._count.activity > 0 && <span className="chip"><I name="list" />{t._count.activity}</span>}
        </div>
        <div className="card-foot"><Avatar user={a} /><span>{a ? a.name : "مش متعيّن"}</span></div>
      </article>
    );
  };

  function board() {
    return (
      <div className="board-scroll"><div className="board">
        {STATUSES.map((s) => {
          const items = visible.filter((t) => t.status === s.k).sort(sortTasks);
          return (
            <section key={s.k} className={`col ${overCol === s.k ? "over" : ""}`} aria-label={s.l}
              onDragOver={(e) => { if (dragId !== null) { e.preventDefault(); setOverCol(s.k); } }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null); }}
              onDrop={(e) => { e.preventDefault(); setOverCol(null); const t = all.find((x) => x.id === dragId); if (t) move(t, s.k); }}>
              <div className="col-h">
                <span className="sd" style={{ background: s.c }} />{s.l}<span className="c">{items.length}</span>
                {s.k === "new" && <button type="button" className="add" aria-label="تاسك جديد" onClick={() => setOpen("draft")}><I name="plus" /></button>}
              </div>
              <div className="col-b">
                {items.length ? items.map(card) : <div className="col-empty">{s.k === "new" ? "مفيش طلبات جديدة" : "اسحب تاسك هنا"}</div>}
              </div>
            </section>
          );
        })}
      </div></div>
    );
  }

  function list() {
    const groups: { t: string; f: (t: Task) => boolean }[] = [
      { t: "متأخرة", f: (t) => isOpen(t) && !!t.due && dayDiff(t.due) < 0 },
      { t: "النهارده وبكرة", f: (t) => isOpen(t) && !!t.due && dayDiff(t.due) >= 0 && dayDiff(t.due) <= 1 },
      { t: "الأسبوع ده", f: (t) => isOpen(t) && !!t.due && dayDiff(t.due) > 1 && dayDiff(t.due) <= 7 },
      { t: "بعدين", f: (t) => isOpen(t) && !!t.due && dayDiff(t.due) > 7 },
      { t: "من غير ميعاد", f: (t) => isOpen(t) && !t.due },
      { t: "اتسلّمت", f: (t) => !isOpen(t) },
    ];
    return (
      <div className="list">
        {groups.map((g) => {
          const items = visible.filter(g.f).sort(sortTasks);
          if (!items.length) return null;
          return (
            <div key={g.t}>
              <div className="list-sec">{g.t} · {items.length}</div>
              {items.map((t) => {
                const di = dueInfo(t), s = S[t.status as Status] ?? S.new, a = t.assigneeId ? userById[t.assigneeId] : null;
                return (
                  <button type="button" key={t.id} className="row" onClick={() => setOpen(t.id)}>
                    <span className={`ring ${t.status === "done" ? "done" : ""}`} style={{ ["--ring" as string]: s.c }}>{t.status === "done" && <I name="check" />}</span>
                    <span style={{ minWidth: 0 }}>
                      <span className="rt">{t.title}</span>
                      <span className="rm">
                        <span className="chip" style={{ color: s.c }}>{s.l}</span>
                        {di && <span className={`chip ${di.cls}`}><I name="cal" />{di.label}</span>}
                        <span className="chip">{t.type}</span>
                        {t.revisions > 0 && <span className="chip rev">R{t.revisions}</span>}
                        {t.priority === "urgent" && <span className="flag"><I name="flag" />عاجل</span>}
                      </span>
                    </span>
                    <span className="rr"><Avatar user={a} /><span className="nm" style={{ color: "var(--label-2)", fontSize: 13 }}>{a?.name}</span></span>
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
  if (tasks === null) content = <div className="empty"><p>بيحمّل التاسكات…</p></div>;
  else if (!all.length) content = (
    <div className="empty"><div className="big"><I name="tray" /></div><h2>لسه مفيش تاسكات</h2>
      <p>ابدأ بأول طلب تصميم: اكتب البريف، حدد المقاس وميعاد التسليم، واختار المصمم. الفريق هيشوفه هنا على طول.</p>
      <button type="button" className="btn btn-primary" onClick={() => setOpen("draft")}><I name="plus" />أول تاسك</button></div>
  );
  else if (!visible.length) content = (
    <div className="empty"><div className="big"><I name="search" /></div><h2>مفيش نتايج</h2><p>مفيش تاسكات بالفلاتر دي.</p>
      <button type="button" className="btn btn-tinted" onClick={clear}>مسح الفلاتر</button></div>
  );
  else content = view === "board" ? board() : list();

  return (
    <>
      <Nav me={me}>
        <label className="search" htmlFor="q"><I name="search" /><input id="q" type="search" placeholder="دوّر في التاسكات" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      </Nav>
      <main className="wrap">
        <section className="head">
          <div>
            <h1>التاسكات</h1>
            <div className="sub">{fmtLong.format(new Date())} · {all.filter(isOpen).length} تاسك مفتوح</div>
          </div>
          <div className="actions">
            <button className="btn btn-primary" type="button" onClick={() => setOpen("draft")}><I name="plus" />تاسك جديد</button>
          </div>
        </section>

        <section className="tiles" aria-label="فلاتر سريعة">
          {tiles.map((x) => (
            <button key={x.k} type="button" className="tile" aria-pressed={tile === x.k} style={{ ["--tile-c" as string]: x.c }} onClick={() => setTile(tile === x.k ? "" : x.k)}>
              <span className="dot" style={{ background: x.c }}><I name={x.ic} /></span>
              <span className="n">{all.filter((t) => tileMatch(t, x.k)).length}</span>
              <span className="t">{x.t}</span>
            </button>
          ))}
        </section>

        <div className="toolbar">
          <div className="seg" role="group" aria-label="طريقة العرض">
            {(["board", "list"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => { setView(v); try { localStorage.setItem("cz-view", v); } catch {} }}>{v === "board" ? "بورد" : "قائمة"}</button>
            ))}
          </div>
          <select className="select" id="fAssignee" aria-label="المصمم" value={fAssignee} onChange={(e) => setFAssignee(e.target.value)}>
            <option value="">كل المصممين</option>
            {assigned.map((id) => <option key={id} value={id}>{userById[id]?.name ?? "عضو"}</option>)}
            <option value="_none">مش متعيّن</option>
          </select>
          <select className="select" id="fType" aria-label="النوع" value={fType} onChange={(e) => setFType(e.target.value)}>
            <option value="">كل الأنواع</option>
            {usedTypes.map((x) => <option key={x}>{x}</option>)}
          </select>
          {filtered && <div className="filter-note"><span>{visible.length} من {all.length}</span><button type="button" onClick={clear}>مسح الفلاتر</button></div>}
        </div>

        <section>{content}</section>
      </main>

      {open !== null && (
        <TaskSheet key={String(open)} id={open} me={me} users={users} userById={userById}
          onClose={() => setOpen(null)} onChanged={load} onCreated={(id) => setOpen(id)} say={say} />
      )}
      <div className={`toast ${toast ? "on" : ""}`} role="status" aria-live="polite">{toast}</div>
    </>
  );
}
