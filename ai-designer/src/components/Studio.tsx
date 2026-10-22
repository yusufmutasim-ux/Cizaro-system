"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { api, ago, upload, type ChatSummary, type ChatView, type DesignDTO } from "@/lib/client";
import { useBrand } from "./BrandCtx";
import { DesignCard, DesignEditor } from "./Design";
import { I } from "./Icons";

type Live = { text: string; tools: { name: string; live: boolean; error?: boolean }[]; thinking: string; designIds: string[]; error: string };
type Pending = { id: string; url: string; name: string };

const QUICK = [
  { label: "Social ad", text: "Make a social media ad (4:5 feed) for: " },
  { label: "Full campaign", text: "I want a full campaign.\nProduct/service: \nGoal: \nDuration: \nApprox. budget: \nPlatforms: " },
  { label: "Story / Reel", text: "Make a 9:16 story for: " },
  { label: "Product post", text: "Make a post for this product (photo attached) highlighting: " },
  { label: "3 A/B angles", text: "Give me 3 ads with different angles to A/B test for: " },
  { label: "Offer / sale", text: "Make an offer ad: ___% off ___ until ___" },
  { label: "Key visual", text: "Make a key visual for the season/occasion: " },
];

const STARTERS = [
  { t: "Launch campaign", d: "Full plan + an ad set for every platform", p: "I want a launch campaign for a new product. Ask me what you need, then build the plan and the ads." },
  { t: "Offer ad", d: "A conversion ad with a clear offer and strong CTA", p: "Make an offer ad for Facebook and Instagram (feed + story) for: " },
  { t: "This month's content", d: "A consistent set of post ideas", p: "Suggest 6 on-brand posts for this month and produce the first 3." },
  { t: "Product shots", d: "Professional lifestyle shots of your product", p: "I've attached the product photo. Make professional lifestyle shots of it in 3 different scenes." },
];

function Prose({ text }: { text: string }) {
  const inline = (s: string, k: number) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={`${k}-${i}`}>{p.slice(2, -2)}</strong> : <Fragment key={`${k}-${i}`}>{p}</Fragment>));
  return (
    <div className="prose">
      {text.split("\n").map((line, i) => {
        const h = line.match(/^#{1,4}\s+(.*)/);
        if (h) return <div key={i} style={{ fontWeight: 800, marginTop: 6 }}>{inline(h[1], i)}</div>;
        const li = line.match(/^\s*[-*•]\s+(.*)/);
        if (li) return <div key={i} style={{ paddingInlineStart: 14, textIndent: -10 }}>• {inline(li[1], i)}</div>;
        return <div key={i}>{line ? inline(line, i) : " "}</div>;
      })}
    </div>
  );
}

const toolLabel = (n: string) => (/status|result|get|poll|check|job/i.test(n) ? "Checking generation" : /video/i.test(n) ? "Generating video" : /present_designs/.test(n) ? "Preparing designs" : /image|generat|create|soul|seedream|flux|nano/i.test(n) ? "Generating image" : n);

export default function Studio() {
  const { brand, ready, say, files } = useBrand();
  const router = useRouter();
  const sp = useSearchParams();
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [chatId, setChatId] = useState<string | null>(sp.get("chat"));
  const [view, setView] = useState<ChatView[]>([]);
  const [designs, setDesigns] = useState<Record<string, DesignDTO>>({});
  const [live, setLive] = useState<Live | null>(null);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const busy = !!live && !live.error;

  const loadChats = useCallback(() => api<ChatSummary[]>(`/api/brands/${brand.id}/chats`).then((c) => { setChats(c); return c; }), [brand.id]);
  const loadChat = useCallback(async (id: string) => {
    const c = await api<{ messages: ChatView[]; designs: DesignDTO[] }>(`/api/chats/${id}`);
    setView(c.messages);
    setDesigns((m) => ({ ...m, ...Object.fromEntries(c.designs.map((d) => [d.id, d])) }));
  }, []);

  useEffect(() => { loadChats().then((c) => { if (!sp.get("chat") && c[0]) setChatId(c[0].id); }).catch((e) => say(e.message)); }, [loadChats]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (chatId && !busy) loadChat(chatId).catch(() => setView([])); else if (!chatId) setView([]); }, [chatId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const id = sp.get("revise"), title = sp.get("rt");
    if (id) { setText(`Revise the design "${title ?? ""}" (id: ${id}): `); setTimeout(() => input.current?.focus(), 50); }
  }, [sp]);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight }); }, [view, live?.text, live?.tools.length, live?.designIds.length]);

  function pickChat(id: string | null) {
    if (busy) return;
    setChatId(id);
    router.replace(`/brands/${brand.id}${id ? `?chat=${id}` : ""}`, { scroll: false });
  }

  async function addFiles(list: FileList | File[] | null) {
    const imgs = [...(list ?? [])].filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    setUploading(true);
    try {
      const out = await upload(brand.id, "attachment", imgs);
      setPending((p) => [...p, ...out.map((f) => ({ id: f.id, url: f.url, name: f.name }))].slice(0, 10));
    } catch (e) { say((e as Error).message); }
    setUploading(false);
  }

  async function send(msg = text) {
    const body = msg.trim();
    if ((!body && !pending.length) || busy) return;
    setLive(null);
    if (!ready.claude) { say("Add your Claude API key in Settings first"); return; }
    let id = chatId;
    if (!id) {
      const c = await api<ChatSummary>(`/api/brands/${brand.id}/chats`, { method: "POST" });
      id = c.id; setChatId(id); setChats((cs) => [c, ...(cs ?? [])]);
      router.replace(`/brands/${brand.id}?chat=${id}`, { scroll: false });
    }
    const atts = pending;
    setText(""); setPending([]);
    setView((v) => [...v, { role: "user", text: body, images: atts.map((a) => a.url), tools: [], designIds: [] }]);
    const state: Live = { text: "", tools: [], thinking: "", designIds: [], error: "" };
    setLive({ ...state });
    const push = () => setLive({ ...state, tools: [...state.tools], designIds: [...state.designIds] });

    try {
      const res = await fetch(`/api/chats/${id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: body, fileIds: atts.map((a) => a.id) }) });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error || `Error ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
          if (!line.trim()) continue;
          const e = JSON.parse(line);
          if (e.t === "text") { state.text += e.d; state.thinking = ""; }
          else if (e.t === "thinking") state.thinking = (state.thinking + e.d).slice(-240);
          else if (e.t === "step") { if (state.text && !state.text.endsWith("\n\n")) state.text += "\n\n"; }
          else if (e.t === "tool") {
            if (e.phase === "start") state.tools.push({ name: e.name, live: true });
            else { const t = [...state.tools].reverse().find((x) => x.live); if (t) { t.live = false; t.error = e.phase === "error"; } }
          } else if (e.t === "designs") {
            state.tools.forEach((t) => (t.live = false));
            setDesigns((m) => ({ ...m, ...Object.fromEntries((e.designs as DesignDTO[]).map((d) => [d.id, d])) }));
            state.designIds.push(...(e.designs as DesignDTO[]).map((d) => d.id));
            state.designIds = state.designIds.filter((x) => !(e.replaced as string[]).includes(x));
          } else if (e.t === "error") state.error = e.message;
          push();
        }
      }
    } catch (e) { state.error = (e as Error).message; push(); }

    try { await loadChat(id); } catch {}
    // The saved transcript now holds the reply; keep only an error note on screen if something failed.
    setLive(state.error ? { text: "", tools: [], thinking: "", designIds: [], error: state.error } : null);
    loadChats().catch(() => {});
  }

  async function removeChat(id: string) {
    if (!confirm("Delete this chat? Its designs stay in the library.")) return;
    await api(`/api/chats/${id}`, { method: "DELETE" });
    setChats((cs) => (cs ?? []).filter((c) => c.id !== id));
    if (chatId === id) pickChat(null);
  }

  const board = (ids: string[]) => {
    const list = ids.map((id) => designs[id]).filter(Boolean);
    return list.length ? <div className="board">{list.map((d) => <DesignCard key={d.id} design={d} onOpen={() => setOpen(d.id)} />)}</div> : null;
  };
  const tools = (names: { name: string; live?: boolean; error?: boolean }[]) => {
    if (!names.length) return null;
    const collapsed = names.reduce<{ name: string; n: number; live?: boolean; error?: boolean }[]>((acc, t) => {
      const label = toolLabel(t.name || "tool"); const last = acc[acc.length - 1];
      if (last && last.name === label) { last.n++; last.live = t.live; last.error = last.error || t.error; } else acc.push({ name: label, n: 1, live: t.live, error: t.error });
      return acc;
    }, []);
    return <div className="tools">{collapsed.map((t, i) => <span key={i} className={`tool-pill ${t.live ? "live" : ""}`}>{t.error ? "⚠︎ " : t.live ? "" : "✓ "}{t.name}{t.n > 1 ? ` ×${t.n}` : ""}</span>)}</div>;
  };

  const empty = !view.length && !live;
  const opened = open ? designs[open] : null;
  const hasLogo = files.some((f) => f.kind === "logo");
  const bookEmpty = !brand.book.description && !brand.book.colors.length;

  return (
    <div className="studio">
      <aside className="card chats">
        <button type="button" className="btn primary" onClick={() => pickChat(null)} disabled={busy}><I name="plus" />New request</button>
        <div className="chats-list">
          {chats === null && <div className="muted" style={{ padding: 10, fontSize: 13 }}>Loading…</div>}
          {chats?.map((c) => (
            <div key={c.id} className="chat-item" aria-current={c.id === chatId} onClick={() => pickChat(c.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && pickChat(c.id)}>
              <span className="t">{c.title || "New chat"}</span>
              <small className="muted">{ago(c.updatedAt)}</small>
              <button type="button" className="btn sm icon ghost del" onClick={(e) => { e.stopPropagation(); removeChat(c.id); }} aria-label="Delete"><I name="trash" /></button>
            </div>
          ))}
        </div>
      </aside>

      <section className="card thread">
        <div className="messages" ref={scroller}>
          {empty && (
            <div className="welcome">
              <span className="logo-mark" style={{ width: 52, height: 52, borderRadius: 16, margin: "0 auto", display: "grid" }} />
              <h2>What should we make for {brand.name} today?</h2>
              <p>Write a brief or pick a starter. The designer follows the brand book, generates visuals on Higgsfield and hands you ready-to-post ads.</p>
              {(bookEmpty || !hasLogo || !ready.mcp) && (
                <div className="stack" style={{ marginBottom: 18 }}>
                  {bookEmpty && <div className="notice"><I name="book" /><span className="grow">The brand book is empty — fill it in (or upload your guidelines to auto-fill it) so the designer stays on brand.</span><Link href={`/brands/${brand.id}?tab=book`}>Brand book</Link></div>}
                  {!bookEmpty && !hasLogo && <div className="notice"><I name="image" /><span className="grow">Upload your logo so it goes on every design.</span><Link href={`/brands/${brand.id}?tab=book`}>Upload</Link></div>}
                  {!ready.mcp && <div className="notice"><I name="spark" /><span className="grow">Higgsfield isn't connected: you'll get the copy and image prompt, and can upload the image yourself.</span><Link href="/settings">Connect</Link></div>}
                </div>
              )}
              <div className="starters">
                {STARTERS.map((s) => <button key={s.t} type="button" className="starter" onClick={() => { setText(s.p); input.current?.focus(); }}><b>{s.t}</b><span>{s.d}</span></button>)}
              </div>
            </div>
          )}

          {view.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              {m.role === "assistant" && <div className="avatar" />}
              <div className="bubble">
                {m.images.length > 0 && <div className="attachments">{m.images.map((u) => <img key={u} src={u} alt="" />)}</div>}
                {m.role === "assistant" && tools(m.tools.map((name) => ({ name })))}
                {m.text && (m.role === "assistant" ? <Prose text={m.text} /> : <div className="prose">{m.text}</div>)}
                {board(m.designIds)}
              </div>
            </div>
          ))}

          {live && (
            <div className="msg assistant">
              <div className="avatar" />
              <div className="bubble">
                {tools(live.tools)}
                {live.text ? <Prose text={live.text} /> : null}
                {!live.error && (live.thinking || (!live.text && !live.tools.some((t) => t.live))) && (
                  <div className="thinking"><span className="dots"><i /><i /><i /></span>{live.thinking ? live.thinking.split("\n").filter(Boolean).pop()?.slice(0, 140) : "Working on the idea…"}</div>
                )}
                {board(live.designIds)}
                {live.error && <div className="error-note">{live.error}</div>}
              </div>
            </div>
          )}
        </div>

        <div className="composer">
          <div className="composer-inner">
            <div className="quick">{QUICK.map((q) => <button key={q.label} type="button" className="chip" onClick={() => { setText(q.text); input.current?.focus(); }}>{q.label}</button>)}</div>
            <div className="composer-box" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}>
              <label className="btn icon ghost" title="Attach images (product, reference…)" aria-label="Attach images">
                <I name="clip" />
                <input type="file" hidden multiple accept="image/*" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              </label>
              <div className="grow">
                {(pending.length > 0 || uploading) && (
                  <div className="pending-files">
                    {pending.map((p) => <div key={p.id} className="pf"><img src={p.url} alt={p.name} /><button type="button" onClick={() => setPending((x) => x.filter((y) => y.id !== p.id))} aria-label="Remove">×</button></div>)}
                    {uploading && <span className="muted" style={{ fontSize: 12, alignSelf: "center" }}>Uploading…</span>}
                  </div>
                )}
                <textarea
                  ref={input} rows={1} value={text} placeholder={`Write a brief for ${brand.name}…`}
                  onChange={(e) => { setText(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(200, e.target.scrollHeight) + "px"; }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
                  onPaste={(e) => { const f = [...e.clipboardData.files]; if (f.length) { e.preventDefault(); addFiles(f); } }}
                  style={{ width: "100%" }}
                />
              </div>
              <button type="button" className="btn primary icon" onClick={() => send()} disabled={busy || (!text.trim() && !pending.length)} aria-label="Send"><I name="send" className="flip" /></button>
            </div>
            <div className="hint">Enter to send · Shift+Enter for a new line · Drop product photos here</div>
          </div>
        </div>
      </section>

      {opened && (
        <DesignEditor
          design={opened}
          onClose={() => setOpen(null)}
          onChange={(d) => setDesigns((m) => ({ ...m, [d.id]: d }))}
          onRemove={(id) => { setDesigns((m) => { const n = { ...m }; delete n[id]; return n; }); }}
          onRevise={(d) => { setText(`Revise the design "${d.title}" (id: ${d.id}): `); setTimeout(() => input.current?.focus(), 50); }}
        />
      )}
    </div>
  );
}
