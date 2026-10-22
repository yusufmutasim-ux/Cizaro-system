"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api, type BrandDTO } from "@/lib/client";
import { TopBar } from "./TopBar";
import { BrandMark, Palette } from "./BrandMark";
import { I } from "./Icons";

export default function Home(props: { brands: BrandDTO[]; ready: { claude: boolean; mcp: boolean } }) {
  return <Suspense><HomeInner {...props} /></Suspense>;
}

function HomeInner({ brands, ready }: { brands: BrandDTO[]; ready: { claude: boolean; mcp: boolean } }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [form, setForm] = useState<{ name: string; color: string } | null>(sp.get("new") || !brands.length ? { name: "", color: "#7C6CFF" } : null);
  const [err, setErr] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    try {
      const b = await api<BrandDTO>("/api/brands", { method: "POST", json: form });
      router.push(`/brands/${b.id}?tab=book`);
    } catch (e) { setErr((e as Error).message); }
  }

  return (
    <>
      <TopBar brands={brands} />
      <main className="home">
        <h1>مصمم الإعلانات بتاعك</h1>
        <p>كل براند ليه تاب وبراند بوك. اطلب أي إعلان أو كامبين، والمصمم يعمله ملتزم بالهوية بالظبط.</p>

        {(!ready.claude || !ready.mcp) && (
          <div className="notice" style={{ marginBottom: 20 }}>
            <I name="spark" />
            <span className="grow">{!ready.claude ? "لسه محتاج تضيف مفتاح Claude API عشان المصمم يشتغل." : "اربط Higgsfield MCP عشان المصمم يولّد الصور بنفسه."}</span>
            <Link href="/settings">الإعدادات</Link>
          </div>
        )}

        <div className="brand-cards">
          {brands.map((b) => (
            <Link key={b.id} href={`/brands/${b.id}`} className="card brand-card" style={{ ["--bc" as string]: b.color }}>
              <div className="row"><BrandMark brand={b} size={46} /><div className="grow"><b style={{ fontSize: 17 }}>{b.name}</b><div className="muted" style={{ fontSize: 13 }}>{b.book.tagline || b.book.industry || "—"}</div></div></div>
              <div className="row muted" style={{ fontSize: 13 }}><span>{b.designs} تصميم</span><span>·</span><span>{b.campaigns} كامبين</span></div>
              <Palette colors={b.book.colors} />
            </Link>
          ))}
          {form ? (
            <form className="card brand-card" onSubmit={create} style={{ borderStyle: "dashed" }}>
              <b>براند جديد</b>
              <div className="row">
                <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} aria-label="لون التاب" style={{ width: 40, height: 38, border: 0, background: "none" }} />
                <input className="input" autoFocus placeholder="اسم البراند" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              {err && <div className="error-note">{err}</div>}
              <div className="row"><button className="btn primary grow">إنشاء</button>{brands.length > 0 && <button type="button" className="btn ghost" onClick={() => setForm(null)}>إلغاء</button>}</div>
            </form>
          ) : (
            <button type="button" className="card brand-card" onClick={() => setForm({ name: "", color: "#7C6CFF" })} style={{ borderStyle: "dashed", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--ink-2)" }}>
              <I name="plus" /> براند جديد
            </button>
          )}
        </div>
      </main>
    </>
  );
}
