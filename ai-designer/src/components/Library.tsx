"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, ago, type CampaignDTO, type DesignDTO } from "@/lib/client";
import { useBrand } from "./BrandCtx";
import { DesignCard, DesignEditor } from "./Design";
import { I } from "./Icons";

const PLAN_LABELS: Record<string, string> = {
  key_message: "الرسالة الأساسية", objective: "الهدف", audience: "الجمهور والاستهداف", channels: "المنصات والأماكن",
  timeline: "التايم لاين", budget_split: "توزيع الميزانية", kpis: "مؤشرات النجاح",
};

export default function Library() {
  const { brand, say } = useBrand();
  const router = useRouter();
  const [data, setData] = useState<{ designs: DesignDTO[]; campaigns: CampaignDTO[] } | null>(null);
  const [filter, setFilter] = useState<"all" | "fav" | "nocamp" | string>("all");
  const [format, setFormat] = useState<string>("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => { api<{ designs: DesignDTO[]; campaigns: CampaignDTO[] }>(`/api/brands/${brand.id}/designs`).then(setData).catch((e) => say(e.message)); }, [brand.id, say]);

  const campaign = data?.campaigns.find((c) => c.id === filter) ?? null;
  const shown = useMemo(() => (data?.designs ?? []).filter((d) =>
    (filter === "all" || (filter === "fav" ? d.favorite : filter === "nocamp" ? !d.campaignId : d.campaignId === filter)) && (!format || d.format === format)), [data, filter, format]);
  const opened = data?.designs.find((d) => d.id === open) ?? null;
  const formats = [...new Set((data?.designs ?? []).map((d) => d.format))];

  if (!data) return <div className="page"><div className="empty">بيحمّل…</div></div>;
  if (!data.designs.length && !data.campaigns.length) {
    return (
      <div className="page"><div className="empty">
        <h3>المكتبة لسه فاضية</h3>
        <p>كل تصميم أو كامبين المصمم يعمله بيتحفظ هنا.</p>
        <button type="button" className="btn primary" onClick={() => router.push(`/brands/${brand.id}`)}><I name="chat" />روح للاستوديو</button>
      </div></div>
    );
  }

  return (
    <div className="page">
      {data.campaigns.length > 0 && (
        <>
          <div className="section-t" style={{ marginBottom: 10 }}>الكامبينز</div>
          <div className="campaigns">
            {data.campaigns.map((c) => (
              <div key={c.id} className="card campaign" role="button" tabIndex={0} aria-pressed={filter === c.id} onClick={() => setFilter(filter === c.id ? "all" : c.id)} onKeyDown={(e) => e.key === "Enter" && setFilter(c.id)}>
                <div className="row"><I name="megaphone" /><h4 className="grow">{c.name}</h4><span className="badge">{c.designs} تصميم</span></div>
                <p>{c.bigIdea}</p>
                <small className="muted">{ago(c.createdAt)}</small>
              </div>
            ))}
          </div>
        </>
      )}

      {campaign && (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 20 }} className="grow">{campaign.name}</h2>
            {campaign.chatId && <button type="button" className="btn sm" onClick={() => router.push(`/brands/${brand.id}?chat=${campaign.chatId}`)}><I name="chat" />افتح المحادثة</button>}
          </div>
          <div className="plan">
            <div className="card" style={{ gridColumn: "1 / -1" }}><b>الفكرة الكبيرة</b><p>{campaign.bigIdea}</p></div>
            {Object.entries(PLAN_LABELS).map(([k, label]) => campaign.plan[k] ? <div key={k} className="card"><b>{label}</b><p>{campaign.plan[k]}</p></div> : null)}
          </div>
        </>
      )}

      <div className="lib-bar">
        <button type="button" className="chip" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>الكل ({data.designs.length})</button>
        <button type="button" className="chip" aria-pressed={filter === "fav"} onClick={() => setFilter("fav")}><I name="star" />المفضلة</button>
        {data.campaigns.length > 0 && <button type="button" className="chip" aria-pressed={filter === "nocamp"} onClick={() => setFilter("nocamp")}>خارج الكامبينز</button>}
        <span className="grow" />
        {formats.length > 1 && formats.map((f) => <button key={f} type="button" className="chip" aria-pressed={format === f} onClick={() => setFormat(format === f ? "" : f)}>{f}</button>)}
      </div>

      {shown.length ? (
        <div className="board">{shown.map((d) => <DesignCard key={d.id} design={d} onOpen={() => setOpen(d.id)} />)}</div>
      ) : <div className="empty">مفيش تصاميم هنا.</div>}

      {opened && (
        <DesignEditor
          design={opened}
          onClose={() => setOpen(null)}
          onChange={(d) => setData((x) => x && { ...x, designs: x.designs.map((y) => (y.id === d.id ? d : y)) })}
          onRemove={(id) => setData((x) => x && { ...x, designs: x.designs.filter((y) => y.id !== id) })}
          onRevise={(d) => router.push(`/brands/${brand.id}?${new URLSearchParams({ ...(d.chatId ? { chat: d.chatId } : {}), revise: d.id, rt: d.title })}`)}
        />
      )}
    </div>
  );
}
