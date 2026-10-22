"use client";
import { useEffect, useState } from "react";
import { api, type BrandDTO } from "@/lib/client";
import { TopBar } from "./TopBar";
import { I } from "./Icons";

type View = { anthropicKey: string; mcpUrl: string; mcpToken: string; appUrl: string; has: Record<string, boolean>; fromEnv: Record<string, boolean> };
type Test = { claude: boolean | null; mcp: boolean | null; tools?: string; error?: string };

export default function Settings({ brands, auth }: { brands: BrandDTO[]; auth: boolean }) {
  const [v, setV] = useState<View | null>(null);
  const [form, setForm] = useState({ anthropicKey: "", mcpUrl: "", mcpToken: "", appUrl: "" });
  const [msg, setMsg] = useState("");
  const [test, setTest] = useState<Test | null>(null);
  const [testing, setTesting] = useState(false);

  const load = (x: View) => { setV(x); setForm({ anthropicKey: x.anthropicKey, mcpUrl: x.mcpUrl, mcpToken: x.mcpToken, appUrl: x.appUrl }); };
  useEffect(() => { api<View>("/api/settings").then(load).catch((e) => setMsg(e.message)); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try { load(await api<View>("/api/settings", { method: "PUT", json: form })); setMsg("اتحفظ ✓"); setTest(null); }
    catch (err) { setMsg((err as Error).message); }
    setTimeout(() => setMsg(""), 2500);
  }
  async function runTest() {
    setTesting(true); setTest(null);
    try { setTest(await api<Test>("/api/settings/test", { method: "POST" })); } catch (e) { setTest({ claude: false, mcp: null, error: (e as Error).message }); }
    setTesting(false);
  }

  const env = (k: string) => v?.fromEnv[k] ? <small className="muted">متحدد من متغيرات السيرفر</small> : null;
  const dot = (ok: boolean | null | undefined) => <span className={`status-dot ${ok ? "on" : ok === false ? "off" : ""}`} />;

  return (
    <>
      <TopBar brands={brands} />
      <main className="narrow">
        <h1 style={{ margin: 0 }}>الإعدادات</h1>

        <form className="card book-section" onSubmit={save}>
          <h3><I name="spark" />Claude (المخ: الأفكار، الكوبي، الإخراج الفني)</h3>
          <label className="field">
            <span>Claude API Key</span>
            <input className="input mono" value={form.anthropicKey} onChange={(e) => setForm({ ...form, anthropicKey: e.target.value })} placeholder="sk-ant-…" disabled={v?.fromEnv.anthropicKey} autoComplete="off" />
            {env("anthropicKey")}<small>من console.anthropic.com ← API Keys.</small>
          </label>

          <h3 style={{ marginTop: 8 }}><I name="image" />Higgsfield MCP (توليد الصور)</h3>
          <label className="field">
            <span>رابط الـ MCP Server</span>
            <input className="input mono" value={form.mcpUrl} onChange={(e) => setForm({ ...form, mcpUrl: e.target.value })} placeholder="https://…/mcp" disabled={v?.fromEnv.mcpUrl} />
            {env("mcpUrl")}<small>رابط Higgsfield MCP زي ما هو في حسابك على Higgsfield (Remote MCP / Streamable HTTP).</small>
          </label>
          <label className="field">
            <span>Access Token</span>
            <input className="input mono" value={form.mcpToken} onChange={(e) => setForm({ ...form, mcpToken: e.target.value })} placeholder="التوكن أو الـ API key" disabled={v?.fromEnv.mcpToken} autoComplete="off" />
            {env("mcpToken")}<small>بيتبعت كـ Bearer token للسيرفر. سيبه فاضي لو الرابط نفسه فيه المفتاح.</small>
          </label>

          <h3 style={{ marginTop: 8 }}><I name="out" />رابط التطبيق</h3>
          <label className="field">
            <span>APP_URL</span>
            <input className="input mono" value={form.appUrl} onChange={(e) => setForm({ ...form, appUrl: e.target.value })} placeholder="https://designer.example.com" disabled={v?.fromEnv.appUrl} />
            {env("appUrl")}<small>لما يكون متحدد، Higgsfield يقدر يستخدم اللوجو وصور المنتجات والمراجع كـ reference وهو بيولّد.</small>
          </label>

          <div className="row">
            <button className="btn primary">حفظ</button>
            <button type="button" className="btn" onClick={runTest} disabled={testing}>{testing ? "بيجرّب…" : "جرّب الاتصال"}</button>
            <span className="muted">{msg}</span>
          </div>

          {test && (
            <div className="check-box">
              <div className="row">{dot(test.claude)} Claude {test.claude ? "شغال" : test.claude === false ? "مش شغال" : ""}</div>
              <div className="row">{dot(test.mcp)} Higgsfield MCP {test.mcp ? "متوصل" : test.mcp === false ? "مش متوصل" : "مش متحدد"}</div>
              {test.tools && <div className="muted mono" style={{ fontSize: 12.5 }}>{test.tools}</div>}
              {test.error && <div className="error-note">{test.error}</div>}
            </div>
          )}
        </form>

        {auth && (
          <div className="card book-section">
            <h3><I name="out" />الخروج</h3>
            <div><button type="button" className="btn" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); location.href = "/login"; }}>تسجيل الخروج</button></div>
          </div>
        )}
      </main>
    </>
  );
}
