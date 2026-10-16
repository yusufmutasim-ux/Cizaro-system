import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale, type Locale } from "./i18n";

/** Locale for requests without a signed-in user (login page, login errors). */
export async function cookieLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : "ar";
}
