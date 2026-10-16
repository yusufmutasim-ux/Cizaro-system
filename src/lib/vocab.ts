import { STATUS_LABELS, PRIORITY_LABELS, type Locale } from "./i18n";

export const STATUSES = [
  { k: "new", c: "var(--gray)" },
  { k: "doing", c: "var(--blue)" },
  { k: "review", c: "var(--purple)" },
  { k: "changes", c: "var(--orange)" },
  { k: "done", c: "var(--green)" },
] as const;

export type Status = (typeof STATUSES)[number]["k"];
export const STATUS_KEYS = STATUSES.map((s) => s.k) as Status[];
export const statusColor = (k: string) => STATUSES.find((s) => s.k === k)?.c ?? "var(--gray)";
export const statusLabel = (k: string, l: Locale) => (STATUS_LABELS[k as Status] ?? STATUS_LABELS.new)[l];

export type Priority = keyof typeof PRIORITY_LABELS;
export const PRIORITY_KEYS = Object.keys(PRIORITY_LABELS) as Priority[];

export const SIZES = ["1080×1080", "1080×1350", "1080×1920", "1920×1080", "1200×628", "A4", "A3", "A5"];

export const ref = (id: number) => "CZ-" + id;
