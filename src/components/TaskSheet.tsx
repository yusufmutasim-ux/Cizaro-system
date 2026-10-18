"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { I } from "./Icons";
import { useI18n } from "./I18n";
import { SIZES, STATUSES, PRIORITY_KEYS, ref, statusColor, type Status } from "@/lib/vocab";
import { TYPE_KEYS } from "@/lib/i18n";
import { api, kb, type Activity, type Brand, type FileRow, type Task, type User } from "@/lib/client";
import { BrandMark } from "./BrandMark";
import { Picker, DatePicker } from "./Pickers";
import { Portal } from "./Portal";

type Props = {
  id: number | "draft";
  me: User;
  users: User[];
  userById: Record<string, User>;
  brands: Brand[];
  defaultBrandId?: string;
  onClose: () => void;
  onChanged: () => void;
  onCreated: (id: number) => void;
  say: (m: string) => void;
};

type Form = { title: string; brief: string; type: string; size: string; due: string; priority: string; assigneeId: string; brandId: string };
const fromTask = (x: Task): Form => ({ brandId: x.brandId ?? "", title: x.title, brief: x.brief, type: x.type, size: x.size, due: x.due ?? "", priority: x.priority, assigneeId: x.assigneeId ?? "" });

export default function TaskSheet({ id, me, users, userById, brands, defaultBrandId, onClose, onChanged, onCreated, say }: Props) {
  const i = useI18n();
  const { t } = i;
  const isDraft = id === "draft";
  const isManager = me.role === "MANAGER";
  const [on, setOn] = useState(false);
  const [task, setTask] = useState<Task | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [pending, setPending] = useState<FileRow[]>([]);
  const [form, setForm] = useState<Form>({ brandId: defaultBrandId ?? "", title: "", brief: "", type: "social", size: "1080×1350", due: "", priority: "normal", assigneeId: "" });
  const [note, setNote] = useState("");
  const [comment, setComment] = useState("");
  const [links, setLinks] = useState({ ref: "", delivery: "" });
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const [customSize, setCustomSize] = useState(false);
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
    const iv = isDraft ? undefined : setInterval(() => { if (document.visibilityState === "visible") load(); }, 6000);
    if (isDraft) setTimeout(() => titleRef.current?.focus(), 380);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => { clearInterval(iv); document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); };
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
      const x = await api<Task>(`/api/tasks/${task.id}`, { method: "PATCH", json: { [field]: field === "assigneeId" ? value || null : value } });
      setTask(x); onChanged();
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
  const mode = (m: "now" | "debounce") => (isDraft ? "local" : m);

  async function create() {
    if (!form.title.trim()) { say(t("toast.needTitle")); titleRef.current?.focus(); return; }
    setBusy(true);
    try {
      const x = await api<Task>("/api/tasks", { method: "POST", json: { ...form, assigneeId: form.assigneeId || null } });
      say(t("toast.added")); onChanged(); onCreated(x.id);
    } catch (e) { say((e as Error).message); setBusy(false); }
  }

  async function status(to: Status, withNote?: string) {
    if (!task) return;
    try {
      await api(`/api/tasks/${task.id}/status`, { method: "POST", json: { status: to, note: withNote } });
      say(to === "done" ? t("toast.approved") : to === "changes" ? t("toast.sentBack") : t("toast.moved", { s: i.status(to) }));
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
    const temp: FileRow[] = arr.map((f, n) => ({ id: `p${Date.now()}${n}`, slot, kind: "upload", name: f.name, href: "#", mime: f.type, size: f.size, uploadedById: me.id, createdAt: new Date().toISOString(), pending: true }));
    setPending((p) => [...p, ...temp]);
    const fd = new FormData();
    fd.set("slot", slot);
    arr.forEach((f) => fd.append("file", f));
    try { await api(`/api/tasks/${task.id}/files`, { method: "POST", body: fd }); say(arr.length > 1 ? t("toast.uploadedMany", { n: arr.length }) : t("toast.uploaded")); }
    catch (e) { say((e as Error).message); }
    setPending((p) => p.filter((x) => !temp.includes(x)));
    load(); onChanged();
  }

  async function addLink(slot: "ref" | "delivery") {
    if (!task) return;
    try { await api(`/api/tasks/${task.id}/files`, { method: "POST", json: { slot, url: links[slot].trim() } }); setLinks((l) => ({ ...l, [slot]: "" })); say(t("toast.linkAdded")); load(); onChanged(); }
    catch (e) { say((e as Error).message); }
  }

  async function removeFile(fid: string) {
    try { await api(`/api/files/${fid}`, { method: "DELETE" }); say(t("toast.fileRemoved")); load(); onChanged(); }
    catch (e) { say((e as Error).message); }
  }

  async function del() {
    if (!task) return;
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 4000); return; }
    try { await api(`/api/tasks/${task.id}`, { method: "DELETE" }); say(t("toast.deleted")); onChanged(); close(); }
    catch (e) { say((e as Error).message); }
  }

  const person = (uid: string | null) => (uid ? userById[uid] : null);

  function fileTile(f: FileRow) {
    const canDel = !f.pending && (f.uploadedById === me.id || isManager);
    const isImg = f.mime?.startsWith("image/"), isVid = f.mime?.startsWith("video/");
    return (
      <div key={f.id} className={`file ${f.pending ? "uploading" : ""}`}>
        <a href={f.href} target="_blank" rel="noopener noreferrer">
          <div className="th">
            {f.kind === "link" ? <I name="link" /> : f.pending ? <I name="up" /> : isImg ? <img src={f.href} alt="" loading="lazy" /> : isVid ? <video src={f.href} muted preload="metadata" /> : <I name="doc" />}
          </div>
          <div className="fn" title={f.name}>{f.name}<small>{person(f.uploadedById)?.name ?? ""} · {f.pending ? t("files.uploading") : i.ago(f.createdAt)}{f.size ? " · " + kb(f.size) : ""}</small></div>
        </a>
        {task?.coverFileId === f.id && <span className="cover-tag">{t("files.cover")}</span>}
        {canDel && <button type="button" className="x" aria-label={t("files.remove")} onClick={() => removeFile(f.id)}><I name="x" /></button>}
      </div>
    );
  }

  function fileGroup(slot: "ref" | "delivery") {
    const items = [...files.filter((f) => f.slot === slot), ...pending.filter((f) => f.slot === slot)];
    return (
      <div>
        <div className="group-h">
          <I name={slot === "delivery" ? "photo" : "clip"} />{t(slot === "delivery" ? "files.deliveries" : "files.refs")}
          <span className="act">
            <label style={{ cursor: "pointer", display: "inline-flex", gap: 4, alignItems: "center" }}>
              <I name="plus" />{t("files.upload")}
              <input type="file" multiple hidden onChange={(e) => { upload(e.target.files, slot); e.target.value = ""; }} />
            </label>
          </span>
        </div>
        <div className="group">
          {items.length ? <div className="files">{items.map(fileTile)}</div>
            : <div className="files-empty">{t(slot === "delivery" ? "files.emptyDeliveries" : "files.emptyRefs")}</div>}
          <div className="link-row">
            <input id={`lnk-${slot}`} type="url" placeholder={t("files.linkPh")} aria-label={t("files.link")} value={links[slot]} onChange={(e) => setLinks({ ...links, [slot]: e.target.value })} />
            <button type="button" className="btn btn-gray" style={{ height: 38 }} onClick={() => addLink(slot)}><I name="link" />{t("files.link")}</button>
          </div>
        </div>
      </div>
    );
  }

  function reviewBox() {
    if (!task) return null;
    if (task.status === "review") {
      if (!isManager) return <div className="review-card"><div className="rt">{t("review.waiting")}</div><p>{t("review.waitingBody")}</p></div>;
      return (
        <div className="review-card">
          <div className="rt">{t("review.waitingYou")}</div>
          <p>{t("review.waitingYouBody", { n: task.revisions + 1 })}</p>
          <textarea id="chNote" placeholder={t("review.notePh")} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="rb">
            <button type="button" className="btn btn-orange" onClick={() => { if (!note.trim()) { say(t("toast.needNote")); return; } status("changes", note.trim()); }}><I name="redo" />{t("review.requestChanges")}</button>
            <button type="button" className="btn btn-green" onClick={() => status("done", note.trim() || undefined)}><I name="check" />{t("review.approve")}</button>
          </div>
        </div>
      );
    }
    if (task.status === "doing" || task.status === "changes") {
      return (
        <div className="review-card">
          <div className="rt">{t(task.status === "changes" ? "review.changesTitle" : "review.doneTitle")}</div>
          <p>{t("review.uploadHint")}</p>
          <div className="rb"><button type="button" className="btn btn-primary" onClick={() => status("review")}><I name="eye" />{t("review.submit")}</button></div>
        </div>
      );
    }
    if (task.status === "new") {
      return (
        <div className="review-card"><p>{t("review.newHint")}</p>
          <div className="rb"><button type="button" className="btn btn-tinted" onClick={() => status("doing")}>{t("review.start")}</button></div></div>
      );
    }
    return null;
  }

  function feedItem(a: Activity) {
    const u = person(a.userId);
    const head = <><span className="who">{u?.name ?? t("activity.formerMember")}</span><span className="when">{i.ago(a.createdAt)}</span></>;
    const slot = a.toStatus === "delivery" ? t("activity.slotDelivery") : t("activity.slotRef");
    let sys: React.ReactNode = null;
    if (a.kind === "created") sys = t("activity.created");
    else if (a.kind === "status") sys = <>{t("activity.moved")} <b style={{ color: statusColor(a.toStatus ?? "") }}>{i.status(a.toStatus ?? "new")}</b></>;
    else if (a.kind === "file") sys = a.toStatus ? t("activity.uploaded", { slot, name: a.text ?? "" }) : a.text;
    else if (a.kind === "link") sys = t("activity.linked", { slot, name: a.text ?? "" });
    if (sys !== null) return <div key={a.id} className="ev sys"><Avatar user={u} size="lg" /><div>{head}<div className="txt">{sys}</div></div></div>;
    const badge =
      a.kind === "changes" ? <div className="badge changes"><I name="redo" />{t("activity.changes")}{a.round ? ` · R${a.round}` : ""}</div>
      : a.kind === "approved" ? <div className="badge approved"><I name="check" />{t("activity.approved")}</div>
      : a.kind === "submitted" ? <div className="badge submitted"><I name="eye" />{t("activity.submitted")}</div>
      : null;
    return <div key={a.id} className="ev"><Avatar user={u} size="lg" /><div>{head}<div>{badge}</div>{a.text && <div className="txt">{a.text}</div>}</div></div>;
  }

  const ready = isDraft || task;

  return (
    <Portal>
      <div className={`scrim ${on ? "on" : ""}`} onClick={close} />
      <div className={`sheet ${on ? "on" : ""}`} role="dialog" aria-modal="true" aria-label={task?.title ?? t("sheet.new")}>
        <div className="sheet-bar">
          <span className="grab" />
          <div className="ttl">
            {isDraft ? t("sheet.new") : task && (
              <><span className="ref">{ref(task.id)}</span><span className="chip" style={{ color: statusColor(task.status) }}>{i.status(task.status)}</span>{task.revisions > 0 && <span className="chip rev">R{task.revisions}</span>}</>
            )}
          </div>
          {isDraft
            ? <button type="button" className="done-btn quiet" onClick={close}>{t("sheet.cancel")}</button>
            : <button type="button" className="done-btn" onClick={close}>{t("sheet.done")}</button>}
        </div>
        {!ready ? <div className="empty"><p>{t("sheet.loading")}</p></div> : (
          <div className="sheet-body">
            <div className="main">
              <textarea ref={titleRef} className="title-in" id="tTitle" rows={1} placeholder={t("sheet.titlePh")}
                value={form.title} {...bind("title")} onChange={(e) => set("title", e.target.value, mode("debounce"))}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("tBrief")?.focus(); } }} />
              {!isDraft && task && (
                <div className="status-pills" role="group" aria-label={t("field.status")}>
                  {STATUSES.map((x) => {
                    const locked = !isManager && (x.k === "done" || x.k === "changes");
                    return (
                      <button key={x.k} type="button" className="sp" aria-pressed={task.status === x.k} disabled={locked} title={locked ? t("sheet.managerOnly") : undefined}
                        style={{ ["--pc" as string]: x.c, opacity: locked && task.status !== x.k ? 0.45 : 1 }}
                        onClick={() => { if (x.k === "changes") { say(t("toast.writeChanges")); document.getElementById("chNote")?.focus(); return; } status(x.k); }}>
                        <span className="sd" style={{ background: x.c }} />{i.status(x.k)}
                      </button>
                    );
                  })}
                </div>
              )}
              <div>
                <div className="group-h">{t("sheet.brief")}</div>
                <textarea className="brief" id="tBrief" placeholder={t("sheet.briefPh")}
                  value={form.brief} {...bind("brief")} onChange={(e) => set("brief", e.target.value, mode("debounce"))} />
              </div>
              {isDraft ? (
                <div className="banner"><I name="clip" /><span>{t("sheet.afterCreate")}</span></div>
              ) : (
                <>
                  {reviewBox()}
                  {fileGroup("delivery")}
                  {fileGroup("ref")}
                  <div>
                    <div className="group-h"><I name="clock" />{t("activity.title")}</div>
                    <div className="group">
                      <div className="feed">{activity.length ? activity.map(feedItem) : <div className="files-empty">{t("activity.empty")}</div>}</div>
                      <div className="composer">
                        <textarea id="cmt" rows={1} placeholder={t("comment.placeholder")} value={comment} onChange={(e) => setComment(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendComment(); } }} />
                        <button type="button" className="send" disabled={!comment.trim()} aria-label={t("comment.send")} onClick={sendComment}><I name="up" /></button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="side">
              <div className="group">
                {brands.length > 0 && (
                  <div className="field"><span className="fi" style={{ background: brands.find((b) => b.id === form.brandId)?.color ?? "var(--brand)" }}><I name="tag" /></span><label htmlFor="fBrand">{t("field.brand")}</label>
                    <div className="fv">
                      <Picker id="fBrand" label={t("field.brand")} value={form.brandId} onChange={(v) => set("brandId", v, mode("now"))}
                        options={brands.map((b) => ({ value: b.id, label: b.name, iconOnly: b.slug === "dym", icon: <BrandMark brand={b} size={20} /> }))} />
                    </div></div>
                )}
                <div className="field"><span className="fi" style={{ background: "var(--blue)" }}><I name="person" /></span><label htmlFor="fAs">{t("field.designer")}</label>
                  <div className="fv">
                    <Picker id="fAs" label={t("field.designer")} value={form.assigneeId} onChange={(v) => set("assigneeId", v, mode("now"))}
                      options={[{ value: "", label: t("card.unassigned"), icon: <Avatar user={null} /> },
                        ...users.filter((u) => u.active !== false || u.id === form.assigneeId).map((u) => ({ value: u.id, label: u.name + (u.id === me.id ? ` ${t("field.you")}` : ""), icon: <Avatar user={u} /> }))]} />
                  </div></div>
                <div className="field"><span className="fi" style={{ background: "var(--red)" }}><I name="cal" /></span><label htmlFor="fDue">{t("field.due")}</label>
                  <div className="fv"><DatePicker id="fDue" label={t("field.due")} value={form.due} onChange={(v) => set("due", v, mode("now"))} /></div></div>
                <div className="field"><span className="fi" style={{ background: "var(--orange)" }}><I name="flag" /></span><label htmlFor="fPri">{t("field.priority")}</label>
                  <div className="fv"><Picker id="fPri" label={t("field.priority")} value={form.priority} onChange={(v) => set("priority", v, mode("now"))}
                    options={PRIORITY_KEYS.map((k) => ({ value: k, label: i.priority(k), icon: <span className={`pri-dot ${k}`} /> }))} /></div></div>
              </div>
              <div className="group">
                <div className="field"><span className="fi" style={{ background: "var(--purple)" }}><I name="tag" /></span><label htmlFor="fTypeIn">{t("field.type")}</label>
                  <div className="fv"><Picker id="fTypeIn" label={t("field.type")} value={form.type} onChange={(v) => set("type", v, mode("now"))}
                    options={TYPE_KEYS.map((k) => ({ value: k, label: i.type(k) }))} /></div></div>
                <div className="field"><span className="fi" style={{ background: "var(--gray)" }}><I name="ruler" /></span><label htmlFor="fSize">{t("field.size")}</label>
                  <div className="fv">
                    {customSize
                      ? <input type="text" id="fSize" autoFocus placeholder={t("size.customPh")} dir="ltr" value={form.size} {...bind("size")}
                          onBlur={() => { focused.current = null; setCustomSize(false); save("size", form.size.trim()); }}
                          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                          onChange={(e) => set("size", e.target.value, "local")} />
                      : <Picker id="fSize" ltr label={t("field.size")} value={form.size} placeholder="—"
                          onChange={(v) => { if (v === "__custom") { setCustomSize(true); return; } set("size", v, mode("now")); }}
                          options={[...(form.size && !SIZES.includes(form.size) ? [form.size] : []), ...SIZES].map((x) => ({ value: x, label: x }))
                            .concat([{ value: "__custom", label: t("size.custom") }])} />}
                  </div></div>
              </div>
              {isDraft ? (
                <button type="button" className="btn btn-primary" style={{ height: 48 }} disabled={busy} onClick={create}><I name="plus" />{t("sheet.create")}</button>
              ) : task && (
                <>
                  <div style={{ color: "var(--ink-3)", fontSize: 12.5, padding: "0 6px" }}>{t("sheet.created", { when: i.ago(task.createdAt), who: person(task.createdById)?.name ?? t("activity.formerMember") })}</div>
                  {isManager && <div className="danger-zone"><button type="button" className="btn btn-danger" onClick={del}><I name="trash" />{armed ? t("sheet.deleteConfirm") : t("sheet.delete")}</button></div>}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Portal>
  );
}
