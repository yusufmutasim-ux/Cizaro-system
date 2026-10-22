// Single shared password. The cookie holds an HMAC so it can be checked in middleware (Web Crypto) and in routes.
export const COOKIE = "ad_session";

const secret = () => process.env.SESSION_SECRET || "dev-only-secret";
export const authEnabled = () => !!process.env.APP_PASSWORD;

async function hmac(text: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(text));
  let bin = "";
  for (const b of new Uint8Array(sig)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const sessionToken = () => hmac("session:" + (process.env.APP_PASSWORD || ""));
export async function validSession(v: string | undefined) {
  if (!authEnabled()) return true;
  return !!v && v === (await sessionToken());
}

/** Stable signed token for a file, so Higgsfield can fetch brand references without logging in. */
export const fileToken = async (fileId: string) => `${fileId}.${(await hmac("file:" + fileId)).slice(0, 32)}`;
export async function verifyFileToken(token: string) {
  const [id, sig] = token.split(".");
  if (!id || !sig) return null;
  return (await fileToken(id)) === token ? id : null;
}
