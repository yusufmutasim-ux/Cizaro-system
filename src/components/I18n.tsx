"use client";
import { createContext, useContext, useMemo } from "react";
import { t as tr, type Key, type Locale, STATUS_LABELS, PRIORITY_LABELS, typeLabel } from "@/lib/i18n";
import { dayDiff, intlTag, isOpen, parseYmd, type Task } from "@/lib/client";

function make(l: Locale) {
  const fmtDay = new Intl.DateTimeFormat(intlTag(l), { day: "numeric", month: "short" });
  const fmtLong = new Intl.DateTimeFormat(intlTag(l), { weekday: "long", day: "numeric", month: "long" });
  const rtf = new Intl.RelativeTimeFormat(intlTag(l), { numeric: "auto" });
  const t = (key: Key, vars?: Record<string, string | number>) => tr(l, key, vars);
  return {
    l, t,
    dir: l === "ar" ? "rtl" : "ltr",
    status: (k: string) => (STATUS_LABELS[k as keyof typeof STATUS_LABELS] ?? STATUS_LABELS.new)[l],
    priority: (k: string) => (PRIORITY_LABELS[k as keyof typeof PRIORITY_LABELS] ?? PRIORITY_LABELS.normal)[l],
    type: (k: string) => typeLabel(k, l),
    longDate: (d: Date) => fmtLong.format(d),
    due(task: Task) {
      if (!task.due) return null;
      const d = dayDiff(task.due);
      const label = d === 0 ? t("date.today") : d === 1 ? t("date.tomorrow") : d === -1 ? t("date.yesterday") : fmtDay.format(parseYmd(task.due));
      const cls = isOpen(task) ? (d < 0 ? "late" : d <= 1 ? "soon" : "") : "";
      return { label, cls, d };
    },
    ago(iso: string) {
      const ts = new Date(iso).getTime();
      const s = (ts - Date.now()) / 1000, a = Math.abs(s);
      if (a < 45) return t("time.now");
      if (a < 3600) return rtf.format(Math.round(s / 60), "minute");
      if (a < 86400) return rtf.format(Math.round(s / 3600), "hour");
      if (a < 604800) return rtf.format(Math.round(s / 86400), "day");
      return fmtDay.format(new Date(ts));
    },
  };
}

export type I18n = ReturnType<typeof make>;
const Ctx = createContext<I18n>(make("ar"));

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo(() => make(locale), [locale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
