"use client";
import { useEffect, useState } from "react";
import { Nav } from "./Nav";
import { Avatar } from "./Avatar";
import { I } from "./Icons";
import { api, type User } from "@/lib/client";

export default function Team({ me }: { me: User }) {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "DESIGNER" });
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [newPass, setNewPass] = useState("");

  const load = () => api<User[]>("/api/users").then(setUsers).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setMsg("");
    try {
      await api("/api/users", { method: "POST", json: form });
      setMsg(`اتضاف ${form.name}. ابعتله الإيميل والباسورد عشان يدخل.`);
      setForm({ name: "", email: "", password: "", role: "DESIGNER" });
      load();
    } catch (e) { setErr((e as Error).message); }
  }

  async function update(id: string, data: Record<string, unknown>) {
    setErr(""); setMsg("");
    try { await api(`/api/users/${id}`, { method: "PATCH", json: data }); load(); return true; }
    catch (e) { setErr((e as Error).message); return false; }
  }

  return (
    <>
      <Nav me={me} />
      <main className="wrap">
        <section className="head">
          <div>
            <h1>الفريق</h1>
            <div className="sub">{users.filter((u) => u.active).length} عضو نشط · المصممين بيقدروا يشتغلوا ويبعتوا للمراجعة، والمدير بس اللي بيعتمد ويطلب تعديلات</div>
          </div>
        </section>
        <div className="team-grid">
          <div className="group">
            {users.map((u) => (
              <div key={u.id} className={`member ${u.active ? "" : "off"}`}>
                <Avatar user={u} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{u.name}{u.id === me.id ? " (انت)" : ""}</div>
                  <div className="em">{u.email}</div>
                  {resetFor === u.id && (
                    <div className="link-row" style={{ padding: "8px 0 0" }}>
                      <input id={`np-${u.id}`} type="text" placeholder="باسورد جديد (8 حروف+)" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
                      <button type="button" className="btn btn-primary" style={{ height: 34 }} onClick={async () => { if (await update(u.id, { password: newPass })) { setMsg(`الباسورد اتغيّر لـ ${u.name}`); setResetFor(null); setNewPass(""); } }}>حفظ</button>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <select className="select" aria-label="الدور" value={u.role} disabled={u.id === me.id} onChange={(e) => update(u.id, { role: e.target.value })}>
                    <option value="DESIGNER">مصمم</option>
                    <option value="MANAGER">مدير</option>
                  </select>
                  <button type="button" className="btn btn-gray" style={{ height: 30, paddingInline: 10, fontSize: 13 }} onClick={() => { setResetFor(resetFor === u.id ? null : u.id); setNewPass(""); }}>باسورد</button>
                  {u.id !== me.id && (
                    <button type="button" className={`btn ${u.active ? "btn-danger" : "btn-tinted"}`} style={{ height: 30, paddingInline: 10, fontSize: 13 }} onClick={() => update(u.id, { active: !u.active })}>
                      {u.active ? "إيقاف" : "تفعيل"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <form className="form-col" onSubmit={add}>
            <div className="group-h"><I name="plus" />إضافة عضو</div>
            <div className="inset">
              <input id="n-name" placeholder="الاسم" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <input id="n-email" type="email" dir="ltr" placeholder="الإيميل" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              <input id="n-pass" type="text" dir="ltr" placeholder="باسورد مبدئي (8 حروف+)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
              <select id="n-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="DESIGNER">مصمم</option>
                <option value="MANAGER">مدير</option>
              </select>
            </div>
            <div className="err" role="alert">{err}</div>
            {msg && <div style={{ color: "var(--green)", fontSize: 13.5 }}>{msg}</div>}
            <button className="btn btn-primary" style={{ height: 42 }}>إضافة</button>
          </form>
        </div>
      </main>
    </>
  );
}
