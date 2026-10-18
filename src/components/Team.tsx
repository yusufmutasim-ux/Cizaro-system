"use client";
import { useEffect, useState } from "react";
import { useApp } from "./App";
import { Picker } from "./Pickers";
import { useRouter } from "next/navigation";
import { useData } from "@/lib/cache";
import type { Brand } from "@/lib/client";
import { Avatar } from "./Avatar";
import { I } from "./Icons";
import { useI18n } from "./I18n";
import { api, type User } from "@/lib/client";

export default function Team() {
  const { me } = useApp();
  const router = useRouter();
  useEffect(() => { if (me.role !== "MANAGER") router.replace("/"); }, [me.role, router]);
  const { t } = useI18n();
  const usersQ = useData<User[]>("/api/users");
  const brands = useData<Brand[]>("/api/brands").data ?? [];
  const { l } = useI18n();
  const branchOpts = [{ value: "", label: t("branch.none") }, ...brands.flatMap((b) => (b.branches ?? []).map((br) => ({
    value: br.id, label: `${b.name} · ${l === "ar" ? br.name : br.nameEn}`, icon: <span className="branch-code">{br.code}</span>,
  })))];
  const users = usersQ.data ?? [];
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "DESIGNER" });
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [newPass, setNewPass] = useState("");

  const load = () => usersQ.reload().catch((e) => setErr(e.message));

  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setMsg("");
    try {
      await api("/api/users", { method: "POST", json: form });
      setMsg(t("team.added", { name: form.name }));
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
      <main className="wrap">
        <section className="head">
          <div>
            <h1>{t("team.title")}</h1>
            <div className="sub">{t("team.sub", { n: users.filter((u) => u.active).length })}</div>
          </div>
        </section>
        <div className="team-grid">
          <div className="group glass" style={{ background: "var(--glass)" }}>
            {users.map((u) => (
              <div key={u.id} className={`member ${u.active ? "" : "off"}`}>
                <Avatar user={u} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 650 }}>{u.name}{u.id === me.id ? ` ${t("field.you")}` : ""}</div>
                  <div className="em">{u.email}</div>
                  {(u.branchId || u.leadId || users.some((x) => x.leadId === u.id)) && (
                    <div className="reports-line">
                      {u.branchId && <span>{t("field.branch")} <b>{brands.flatMap((b) => b.branches ?? []).find((x) => x.id === u.branchId)?.[l === "ar" ? "name" : "nameEn"]}</b></span>}
                      {u.leadId && <span>{t("team.reportsTo")} <b>{users.find((x) => x.id === u.leadId)?.name ?? "—"}</b></span>}
                      {users.some((x) => x.leadId === u.id) && <span>{t("team.leads", { n: users.filter((x) => x.leadId === u.id).length })}</span>}
                    </div>
                  )}
                  {resetFor === u.id && (
                    <div className="link-row" style={{ padding: "8px 0 0" }}>
                      <input id={`np-${u.id}`} type="text" placeholder={t("team.newPass")} value={newPass} onChange={(e) => setNewPass(e.target.value)} />
                      <button type="button" className="btn btn-primary" style={{ height: 38 }} onClick={async () => { if (await update(u.id, { password: newPass })) { setMsg(t("team.passChanged", { name: u.name })); setResetFor(null); setNewPass(""); } }}>{t("team.save")}</button>
                    </div>
                  )}
                </div>
                <div className="acts">
                  {branchOpts.length > 1 && <>
                    <span className="acts-label">{t("field.branch")}</span>
                    <Picker variant="pill" label={t("field.branch")} value={u.branchId ?? ""} onChange={(v) => update(u.id, { branchId: v || null })} options={branchOpts} />
                  </>}
                  <span className="acts-label">{t("team.reportsTo")}</span>
                  <Picker variant="pill" label={t("team.reportsTo")} value={u.leadId ?? ""} onChange={(v) => update(u.id, { leadId: v || null })}
                    options={[{ value: "", label: t("team.noLead"), icon: <Avatar user={null} /> },
                      ...users.filter((x) => x.id !== u.id && x.active).map((x) => ({ value: x.id, label: x.name, icon: <Avatar user={x} /> }))]} />
                  <Picker variant="pill" label={t("team.role")} value={u.role} disabled={u.id === me.id} onChange={(v) => update(u.id, { role: v })}
                    options={[{ value: "DESIGNER", label: t("team.designer") }, { value: "MANAGER", label: t("team.manager") }]} />
                  <button type="button" className="btn btn-gray" onClick={() => { setResetFor(resetFor === u.id ? null : u.id); setNewPass(""); }}>{t("team.password")}</button>
                  {u.id !== me.id && (
                    <button type="button" className={`btn ${u.active ? "btn-danger" : "btn-tinted"}`} onClick={() => update(u.id, { active: !u.active })}>
                      {u.active ? t("team.disable") : t("team.enable")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <form className="form-col" onSubmit={add}>
            <div className="group-h"><I name="plus" />{t("team.add")}</div>
            <div className="inset">
              <input id="n-name" placeholder={t("team.name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <input id="n-email" type="email" dir="ltr" placeholder={t("team.email")} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              <input id="n-pass" type="text" dir="ltr" placeholder={t("team.tempPass")} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
              <div className="inset-pick"><Picker id="n-role" label={t("team.role")} value={form.role} onChange={(v) => setForm({ ...form, role: v })}
                options={[{ value: "DESIGNER", label: t("team.designer") }, { value: "MANAGER", label: t("team.manager") }]} /></div>
            </div>
            <div className="err" role="alert">{err}</div>
            {msg && <div style={{ color: "var(--green)", fontSize: 13.5 }}>{msg}</div>}
            <button className="btn btn-primary" style={{ height: 46 }}>{t("team.submit")}</button>
          </form>
        </div>
      </main>
    </>
  );
}
