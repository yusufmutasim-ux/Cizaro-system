export const STATUSES = [
  { k: "new", l: "جديد", c: "var(--gray)" },
  { k: "doing", l: "شغّال عليه", c: "var(--blue)" },
  { k: "review", l: "في المراجعة", c: "var(--purple)" },
  { k: "changes", l: "تعديلات", c: "var(--orange)" },
  { k: "done", l: "اتسلّم", c: "var(--green)" },
] as const;

export type Status = (typeof STATUSES)[number]["k"];
export const STATUS_KEYS = STATUSES.map((s) => s.k) as Status[];
export const S = Object.fromEntries(STATUSES.map((s) => [s.k, s])) as Record<Status, (typeof STATUSES)[number]>;

export const PRIORITY = { low: "منخفضة", normal: "عادية", high: "عالية", urgent: "عاجل" } as const;
export type Priority = keyof typeof PRIORITY;

export const TYPES = ["سوشيال بوست", "ستوري", "ريلز / كافر", "كاروسيل", "كي فيجوال", "هوية / لوجو", "برنت", "باكيدجنج", "موشن", "بانر / ويب", "أخرى"];
export const SIZES = ["1080×1080", "1080×1350", "1080×1920", "1920×1080", "1200×628", "A4", "A3", "A5"];

export const ref = (id: number) => "CZ-" + id;
