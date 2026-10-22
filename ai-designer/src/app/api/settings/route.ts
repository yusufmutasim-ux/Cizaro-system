import { route, json } from "@/lib/api";
import { getConfig, saveSettings, mask, type SettingKey } from "@/lib/settings";

const view = async () => {
  const c = await getConfig();
  return {
    anthropicKey: mask(c.anthropicKey), mcpUrl: c.mcpUrl, mcpToken: mask(c.mcpToken), appUrl: c.appUrl,
    has: { anthropicKey: !!c.anthropicKey, mcpUrl: !!c.mcpUrl, mcpToken: !!c.mcpToken, appUrl: !!c.appUrl },
    fromEnv: c.fromEnv,
  };
};

export const GET = route(async () => json(await view()));

// Secrets are only overwritten when a new value is typed (masked values come back unchanged)
export const PUT = route(async (req) => {
  const b = await req.json().catch(() => ({}));
  const values: Partial<Record<SettingKey, string>> = {};
  for (const k of ["anthropicKey", "mcpUrl", "mcpToken", "appUrl"] as SettingKey[]) {
    if (typeof b[k] === "string" && !b[k].includes("••••")) values[k] = b[k];
  }
  if (values.mcpUrl && !/^https:\/\//.test(values.mcpUrl.trim())) return json({ error: "رابط الـ MCP لازم يبدأ بـ https://" }, 400);
  await saveSettings(values);
  return json(await view());
});
