// [Phase: MVP v1] next-intl Server Configuration (RU / EN via cookie)
import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export const SUPPORTED_LOCALES = ['ru', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const LOCALE_COOKIE = 'dota2_locale';

export async function getActiveLocale(): Promise<SupportedLocale> {
  const cookieStore = cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;
  if (value === 'en' || value === 'ru') {
    return value;
  }
  return 'ru';
}

export default getRequestConfig(async () => {
  const locale = await getActiveLocale();
  const messages = (await import(`./messages/${locale}.json`)).default;
  return {
    locale,
    messages,
  };
});
