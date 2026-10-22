import { prisma } from "./db";

// Each value can come from the environment (wins) or from the Settings page (stored in the database).
const KEYS = {
  anthropicKey: "ANTHROPIC_API_KEY",
  mcpUrl: "HIGGSFIELD_MCP_URL",
  mcpToken: "HIGGSFIELD_MCP_TOKEN",
  appUrl: "APP_URL",
} as const;
export type SettingKey = keyof typeof KEYS;
export type Config = Record<SettingKey, string> & { fromEnv: Record<SettingKey, boolean> };

export async function getConfig(): Promise<Config> {
  const rows = await prisma.setting.findMany({ where: { key: { in: Object.keys(KEYS) } } });
  const db = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const out = { fromEnv: {} } as Config;
  for (const [k, env] of Object.entries(KEYS) as [SettingKey, string][]) {
    const e = process.env[env]?.trim();
    out[k] = e || db[k] || "";
    out.fromEnv[k] = !!e;
  }
  out.appUrl = out.appUrl.replace(/\/+$/, "");
  return out;
}

export async function saveSettings(values: Partial<Record<SettingKey, string>>) {
  for (const k of Object.keys(KEYS) as SettingKey[]) {
    const v = values[k];
    if (typeof v !== "string") continue;
    if (v.trim()) await prisma.setting.upsert({ where: { key: k }, update: { value: v.trim() }, create: { key: k, value: v.trim() } });
    else await prisma.setting.deleteMany({ where: { key: k } });
  }
}

export const mask = (v: string) => (!v ? "" : v.length <= 8 ? "••••" : `${v.slice(0, 4)}••••${v.slice(-4)}`);
