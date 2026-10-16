import webpush from "web-push";
import { prisma } from "./db";
import { t, type Key, type Locale, isLocale } from "./i18n";

let ready: Promise<string> | null = null;

/** VAPID keys come from env if set, otherwise they're generated once and kept in the database. */
async function setup(): Promise<string> {
  let pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    const row = await prisma.setting.findUnique({ where: { key: "vapid" } });
    if (row) ({ publicKey: pub, privateKey: priv } = JSON.parse(row.value));
    else {
      const k = webpush.generateVAPIDKeys();
      await prisma.setting.create({ data: { key: "vapid", value: JSON.stringify(k) } });
      pub = k.publicKey; priv = k.privateKey;
    }
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@cizaro.app", pub!, priv!);
  return pub!;
}

export const publicKey = () => (ready ??= setup());

type Message = { title: Key; body?: Key; text?: string; vars?: Record<string, string>; url?: string; tag?: string };

/** Sends a localized notification to each user's devices. Never throws; dead subscriptions are removed. */
export async function notify(userIds: (string | null | undefined)[], msg: Message, exceptId?: string) {
  const ids = [...new Set(userIds.filter((x): x is string => !!x && x !== exceptId))];
  if (!ids.length) return;
  try {
    await publicKey();
    const users = await prisma.user.findMany({ where: { id: { in: ids }, active: true }, select: { id: true, locale: true, pushSubs: true } });
    await Promise.all(users.flatMap((u) => {
      const l: Locale = isLocale(u.locale) ? u.locale : "ar";
      const payload = JSON.stringify({
        title: t(l, msg.title, msg.vars),
        body: msg.text ?? (msg.body ? t(l, msg.body, msg.vars) : ""),
        url: msg.url ?? "/",
        tag: msg.tag,
      });
      return u.pushSubs.map((s) =>
        webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 })
          .catch(async (err: { statusCode?: number }) => {
            if (err.statusCode === 404 || err.statusCode === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
            else console.error("push failed", err.statusCode);
          }));
    }));
  } catch (err) {
    console.error("notify", err);
  }
}

export const managerIds = async () => (await prisma.user.findMany({ where: { role: "MANAGER", active: true }, select: { id: true } })).map((u) => u.id);
