"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { I } from "./Icons";
import { PRIORITY, S, SIZES, STATUSES, TYPES, ref, type Status } from "@/lib/vocab";
import { ago, api, kb, type Activity, type FileRow, type Task, type User } from "@/lib/client";

type Props = {
  id: number | "draft";
  me: User;
  users: User[];
  userById: Record<string, User>;
  onClose: () => void;
  onChanged: () => void;
  onCreated: (id: number) => void;
  say: (m: string) => void;
};

type Form = { title: string; brief: string; type: string; size: string; due: string; priority: string; assigneeId: string };
const fromTask = (t: Task): Form => ({ title: t.title, brief: t.brief, type: t.type, size: t.size, due: t.due ?? "", priority: t.priority, assigneeId: t.assigneeId ?? "" });

export default function TaskSheet({ id, me, users, userById, onClose, onChanged, onCreated, say }: Props) {
  const isDraft = id === "draft";
  const isManager = me.role === "MANAGER";
  const [on, setOn] = useState(false);
  const [task, setTask] = useState<Task | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [pending, setPending] = useState<FileRow[]>([]);
  const [form, setForm] = useState<Form>({ title: "", brief: "", type: TYPES[0], size: "1080×1350", due: "", priority: "normal", assigneeId: "" });
  const [note, setNote] = useState("");
  const [comment, setComment] = useState("");
  const [links, setLinks] = useState({ ref: "", delivery: "" });
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const focused = useRef<keyof Form | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const timers = useRef<Partial<Record<keyof Form, ReturnType<typeof setTimeout>>>>({});

  const close = useCallback(() => { setOn(false); setTimeout(onClose, 380); }, [onClose]);

  const load = useCallback(async () => {
    if (isDraft) return;
    try {
      const d = await api<{ task: Task; activity: Activity[]; files: FileRow[] }>(`/api/tasks/${id}`);
      setTask(d.task); setActivity(d.activity); setFiles(d.files);
      setForm((f) => {
        const n = fromTask(d.task);
        if (focused.current) n[focused.current] = f[focused.current];
        return n;
      });
    } catch (e) { say((e as Error).message); close(); }
  }, [id, isDraft, say, close]);

  useEffect(() => {
    requestAnimationFrame(() => setOn(true));
    document.body.style.overflow = "hidden";
    load();
    const t = isDraft ? undefined : setInterval(() => { if (document.visibilityState === "visible") load(); }, 6000);
    if (isDraft) setTimeout(() => titleRef.current?.focus(), 350);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => { clearInterval(t); document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); };
  }, [load, isDraft, close]);

  useEffect(() => {
    const el = titleRef.current;
    if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
  }, [form.title]);

  async function save(field: keyof Form, value: string) {
    if (isDraft || !task) return;
    if ((fromTask(task)[field] ?? "") === value) return;
    if (field === "title" && !value.trim()) { setForm((f) => ({ ...f, title: task.title })); return; }
    try {
      const t = await api<Task>(`/api/tasks/${task.id}`, { method: "PATCH", json: { [field]: field === "assigneeId" ? value || null : value } });
      setTask(t); onChanged();
    } catch (e) { say((e as Error).message); }
  }

  function set(field: keyof Form, value: string, mode: "now" | "debounce" | "local" = "now") {
    setForm((f) => ({ ...f, [field]: value }));
    clearTimeout(timers.current[field]);
    if (mode === "now") save(field, value);
    if (mode === "debounce") timers.current[field] = setTimeout(() => save(field, value), 800);
  }
  const bind = (field: keyof Form) => ({
    onFocus: () => { focused.current = field; },
    onBlur: () => { focused.current = null; clearTimeout(timers.current[field]); save(field, form[field]); },
  });

  async function create() {
    if (!form.title.trim()) { say("اكتب اسم للتاسك"); titleRef.current?.focus(); return; }
    setBusy(true);
    try {
      const t = await api<Task>("/api/tasks", { method: "POST", json: { ...form, assigneeId: form.assigneeId || null } });
      say("التاسك اتضاف"); onChanged(); onCreated(t.id);
    } catch (e) { say((e as Error).message); setBusy(false); }
  }

  async function status(to: Status, withNote?: string) {
    if (!task) return;
    try {
      await api(`/api/tasks/${task.id}/status`, { method: "POST", json: { status: to, note: withNote } });
      say(to === "done" ? "اتعمد واتقفل" : to === "changes" ? "اتبعت للتعديل" : `اتنقل لـ «${S[to].l}»`);
      setNote(""); load(); onChanged();
    } catch (e) { say((e as Error).message); }
  }

  async function sendComment() {
    const text = comment.trim(); if (!text || !task) return;
    setComment("");
    try { await api(`/api/tasks/${task.id}/comments`, { method: "POST", json: { text } }); load(); onChanged(); }
    catch (e) { say((e as Error).message); setComment(text); }
  }

  async function upload(list: FileList | null, slot: "ref" | "delivery") {
    if (!task || !list?.length) return;
    const arr = [...list];
    const temp: FileRow[] = arr.map((f, i) => ({ id: `p${Date.now()}${i}`, slot, kind: "upload", name: f.name, href: "#", mime: f.type, size: f.size, uploadedById: me.id, createdAt: new Date().toISOString(), pending: true }));
    setPending((p) => [...p, ...temp]);
    const fd = new FormData();
    fd.set("slot", slot);
    arr.forEach((f) => fd.append("file", f));
    try { await api(`/api/tasks/${task.id}/files`, { method: "POST", body: fd }); say(arr.length > 1 ? `اترفع ${arr.length} ملفات` : "الملف اترفع"); }
    catch (e) { say((e as Error).message); }
    setPending((p) => p.filter((x) => !temp.includes(x)));
    load(); onChanged();
  }

  async function addLink(slot: "ref" | "delivery") {
    if (!task) return;
    try { await api(`/api/tasks/${task.id}/files`, { method: "POST", json: { slot, url: links[slot].trim() } }); setLinks((l) => ({ ...l, [slot]: "" })); say("اللينك اتضاف"); load(); onChanged(); }
    catch (e) { say((e as Error).message); }
  }

  async function removeFile(fid: string) {
    try { await api(`/api/files/${fid}`, { method: "DELETE" }); say("الملف اتشال"); load(); onChanged(); }
    catch (e) { say((e as Error).message); }
  }

  async function del() {
    if (!task) return;
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 4000); return; }
    try { await api(`/api/tasks/${task.id}`, { method: "DELETE" }); say("التاسك اتحذف"); onChanged(); close(); }
    catch (e) { say((e as Error).message); }
  }

  const st = task ? (S[task.status as Status] ?? S.new) : null;
  const person = (uid: string | null) => (uid ? userById[uid] : null);

  function fileTile(f: FileRow) {
    const canDel = !f.pending && (f.uploadedById === me.id || isManager);
    const isImg = f.mime?.startsWith("image/"), isVid = f.mime?.startsWith("video/");
    return (
      <div key={f.id} className={`file ${f.pending ? "uploading" : ""} ${task?.coverFileId === f.id ? "cover-on" : ""}`}>
        <a href={f.href} target="_blank" rel="noopener noreferrer">
          <div className="th">
            {f.kind === "link" ? <I name="link" /> : f.pending ? <I name="up" /> : isImg ? <img src={f.href} alt="" loading="lazy" /> : isVid ? <video src={f.href} muted preload="metadata" /> : <I name="doc" />}
          </div>
          <div className="fn" title={f.name}>{f.name}<small>{person(f.uploadedById)?.name ?? ""} · {f.pending ? "بيترفع…" : ago(f.createdAt)}{f.size ? " · " + kb(f.size) : ""}</small></div>
        </a>
        {canDel && <button type="button" className="x" aria-label="شيل الملف" onClick={() => removeFile(f.id)}><I name="x" /></button>}
      </div>
    );
  }

  function fileGroup(slot: "ref" | "delivery") {
    const items = [...files.filter((f) => f.slot === slot), ...pending.filter((f) => f.slot === slot)];
    return (
      <div>
        <div className="group-h">
          <I name={slot === "delivery" ? "photo" : "clip"} />{slot === "delivery" ? "التسليمات" : "المراجع"}
          <span className="act">
            <label style={{ cursor: "pointer", display: "inline-flex", gap: 4, alignItems: "center" }}>
              <I name="plus" />رفع
              <input type="file" multiple hidden onChange={(e) => { upload(e.target.files, slot); e.target.value = ""; }} />
            </label>
          </span>
        </div>
        <div className="group">
          {items.length ? <div className="files">{items.map(fileTile)}</div>
            : <div className="files-empty">{slot === "delivery" ? "ارفع هنا نسخ التصميم: PNG / JPG / PDF / MP4، أو ملفات المصدر PSD / AI." : "صور مرجعية، لوجوهات، أو لينكات Drive للملفات الكبيرة."}</div>}
          <div className="link-row">
            <input id={`lnk-${slot}`} type="url" placeholder="https://drive.google.com/…" aria-label="لينك" value={links[slot]} onChange={(e) => setLinks({ ...links, [slot]: e.target.value })} />
            <button type="button" className="btn btn-gray" style={{ height: 34 }} onClick={() => addLink(slot)}><I name="link" />لينك</button>
          </div>
        </div>
      </div>
    );
  }

  function reviewBox() {
    if (!task) return null;
    if (task.status === "review") {
      if (!isManager) return <div className="review-card"><div style={{ fontWeight: 600 }}>مستني المراجعة</div><p>المدير هيراجع التصميم ويعتمده أو يبعت تعديلات.</p></div>;
      return (
        <div className="review-card">
          <div style={{ fontWeight: 600 }}>التصميم مستني رأيك</div>
          <p>اعتمده لو تمام، أو اكتب التعديلات المطلوبة وهيرجع للمصمم كمراجعة رقم {task.revisions + 1}.</p>
          <textarea id="chNote" placeholder="التعديلات المطلوبة: كبّر اللوجو، غيّر لون الخلفية…" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="rb">
            <button type="button" className="btn btn-orange" onClick={() => { if (!note.trim()) { say("اكتب التعديلات المطلوبة الأول"); return; } status("changes", note.trim()); }}><I name="redo" />طلب تعديلات</button>
            <button type="button" className="btn btn-green" onClick={() => status("done", note.trim() || undefined)}><I name="check" />اعتماد</button>
          </div>
        </div>
      );
    }
    if (task.status === "doing" || task.status === "changes") {
      return (
        <div className="review-card">
          <div style={{ fontWeight: 600 }}>{task.status === "changes" ? "في تعديلات مطلوبة" : "خلّصت التصميم؟"}</div>
          <p>ارفع النسخة الجديدة في التسليمات، وبعدها ابعتها للمراجعة.</p>
          <div className="rb"><button type="button" className="btn btn-primary" onClick={() => status("review")}><I name="eye" />ابعت للمراجعة</button></div>
        </div>
      );
    }
    if (task.status === "new") {
      return (
        <div className="review-card"><p>التاسك لسه جديد. لما المصمم يبدأ فيه يحوّله لـ «شغّال عليه».</p>
          <div className="rb"><button type="button" className="btn btn-tinted" onClick={() => status("doing")}>ابدأ الشغل</button></div></div>
      );
    }
    return null;
  }

  function feedItem(a: Activity) {
    const u = person(a.userId);
    const head = <><span className="who">{u?.name ?? "عضو سابق"}</span><span className="when">{ago(a.createdAt)}</span></>;
    if (a.kind === "status" || a.kind === "created" || a.kind === "file") {
      const to = a.toStatus ? S[a.toStatus as Status] : null;
      return (
        <div key={a.id} className="ev sys"><Avatar user={u} size="lg" /><div>{head}
          <div className="txt">{a.kind === "created" ? "عمل التاسك" : a.kind === "file" ? a.text : <>نقل التاسك لـ <b style={{ color: to?.c }}>{to?.l}</b></>}</div></div></div>
      );
    }
    const badge =
      a.kind === "changes" ? <div className="badge changes"><I name="redo" />طلب تعديلات{a.round ? ` · R${a.round}` : ""}</div>
      : a.kind === "approved" ? <div className="badge approved"><I name="check" />اتعمد</div>
      : a.kind === "submitted" ? <div className="badge" style={{ background: "color-mix(in srgb,var(--purple) 15%,transparent)", color: "var(--purple)" }}><I name="eye" />اتبعت للمراجعة</div>
      : null;
    return (
      <div key={a.id} className="ev"><Avatar user={u} size="lg" /><div>{head}<div>{badge}</div>{a.text && <div className="txt">{a.text}</div>}</div></div>
    );
  }

  const ready = isDraft || task;

  return (
    <>
      <div className={`scrim ${on ? "on" : ""}`} onClick={close} />
      <div className={`sheet ${on ? "on" : ""}`} role="dialog" aria-modal="true" aria-label="تفاصيل التاسك">
        <div className="sheet-bar">
          <span className="grab" />
          <div className="ttl">
            {isDraft ? "تاسك جديد" : task && st && (
              <><span className="ref">{ref(task.id)}</span><span className="chip" style={{ color: st.c }}>{st.l}</span>{task.revisions > 0 && <span className="chip rev">R{task.revisions}</span>}</>
            )}
          </div>
          {isDraft
            ? <button type="button" className="done-btn" style={{ color: "var(--label-2)", fontWeight: 400 }} onClick={close}>إلغاء</button>
            : <button type="button" className="done-btn" onClick={close}>تم</button>}
        </div>
        {!ready ? <div className="empty"><p>بيحمّل…</p></div> : (
          <div className="sheet-body">
            <div className="main">
              <textarea ref={titleRef} className="title-in" id="tTitle" rows={1} placeholder="اسم التاسك، مثلاً: بوست عرض الجمعة"
                value={form.title} {...bind("title")} onChange={(e) => set("title", e.target.value, isDraft ? "local" : "debounce")}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("tBrief")?.focus(); } }} />
              {!isDraft && task && (
                <div className="status-pills" role="group" aria-label="الحالة">
                  {STATUSES.map((x) => {
                    const locked = !isManager && (x.k === "done" || x.k === "changes");
                    return (
                      <button key={x.k} type="button" className="sp" aria-pressed={task.status === x.k} disabled={locked} title={locked ? "للمدير بس" : undefined}
                        style={{ ["--pc" as string]: x.c, opacity: locked && task.status !== x.k ? 0.45 : 1 }}
                        onClick={() => { if (x.k === "changes") { say("اكتب التعديلات من خانة المراجعة"); document.getElementById("chNote")?.focus(); return; } status(x.k); }}>
                        <span className="sd" style={{ background: x.c }} />{x.l}
                      </button>
                    );
                  })}
                </div>
              )}
              <div>
                <div className="group-h">البريف</div>
                <textarea className="brief" id="tBrief" placeholder="الفكرة، النص اللي على التصميم، الألوان، المراجع، أي ملاحظات للمصمم"
                  value={form.brief} {...bind("brief")} onChange={(e) => set("brief", e.target.value, isDraft ? "local" : "debounce")} />
              </div>
              {isDraft ? (
                <div className="banner" style={{ margin: 0 }}><I name="clip" /><span>بعد ما تضيف التاسك تقدر ترفع المراجع والملفات عليه.</span></div>
              ) : (
                <>
                  {reviewBox()}
                  {fileGroup("delivery")}
                  {fileGroup("ref")}
                  <div>
                    <div className="group-h"><I name="clock" />النشاط</div>
                    <div className="group">
                      <div className="feed">{activity.length ? activity.map(feedItem) : <div className="files-empty">مفيش نشاط لسه.</div>}</div>
                      <div className="composer">
                        <textarea id="cmt" rows={1} placeholder="اكتب تعليق…" value={comment} onChange={(e) => setComment(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendComment(); } }} />
                        <button type="button" className="send" disabled={!comment.trim()} aria-label="إرسال" onClick={sendComment}><I name="up" /></button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="side">
              <div className="group">
                <div className="field"><span className="fi" style={{ background: "var(--blue)" }}><I name="person" /></span><label htmlFor="fAs">المصمم</label>
                  <div className="fv">
                    {form.assigneeId && <Avatar user={userById[form.assigneeId]} />}
                    <select id="fAs" value={form.assigneeId} onChange={(e) => set("assigneeId", e.target.value, isDraft ? "local" : "now")}>
                      <option value="">مش متعيّن</option>
                      {users.filter((u) => u.active !== false || u.id === form.assigneeId).map((u) => <option key={u.id} value={u.id}>{u.name}{u.id === me.id ? " (انت)" : ""}</option>)}
                    </select>
                  </div></div>
                <div className="field"><span className="fi" style={{ background: "var(--red)" }}><I name="cal" /></span><label htmlFor="fDue">التسليم</label>
                  <div className="fv"><input type="date" id="fDue" value={form.due} onChange={(e) => set("due", e.target.value, isDraft ? "local" : "now")} /></div></div>
                <div className="field"><span className="fi" style={{ background: "var(--orange)" }}><I name="flag" /></span><label htmlFor="fPri">الأولوية</label>
                  <div className="fv"><select id="fPri" value={form.priority} onChange={(e) => set("priority", e.target.value, isDraft ? "local" : "now")}>
                    {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select></div></div>
              </div>
              <div className="group">
                <div className="field"><span className="fi" style={{ background: "var(--purple)" }}><I name="tag" /></span><label htmlFor="fTypeIn">النوع</label>
                  <div className="fv"><select id="fTypeIn" value={form.type} onChange={(e) => set("type", e.target.value, isDraft ? "local" : "now")}>
                    {TYPES.map((x) => <option key={x}>{x}</option>)}
                  </select></div></div>
                <div className="field"><span className="fi" style={{ background: "var(--gray)" }}><I name="ruler" /></span><label htmlFor="fSize">المقاس</label>
                  <div className="fv"><input type="text" id="fSize" list="sizes" placeholder="1080×1350" dir="ltr" value={form.size} {...bind("size")} onChange={(e) => set("size", e.target.value, "local")} /></div></div>
              </div>
              <datalist id="sizes">{SIZES.map((x) => <option key={x} value={x} />)}</datalist>
              {isDraft ? (
                <button type="button" className="btn btn-primary" style={{ height: 44 }} disabled={busy} onClick={create}><I name="plus" />إضافة التاسك</button>
              ) : task && (
                <>
                  <div style={{ color: "var(--label-3)", fontSize: 12.5, padding: "0 4px" }}>اتعمل {ago(task.createdAt)} بواسطة {person(task.createdById)?.name ?? "عضو سابق"}</div>
                  {isManager && <div className="danger-zone"><button type="button" className="btn btn-danger" onClick={del}><I name="trash" />{armed ? "متأكد؟ اضغط تاني للحذف" : "حذف التاسك"}</button></div>}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

