'use server';

// [Phase: MVP v1] Server Action to toggle RU / EN interface language
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { LOCALE_COOKIE, type SupportedLocale } from './request';

export async function setLocaleAction(locale: SupportedLocale) {
  if (locale !== 'ru' && locale !== 'en') return;
  const cookieStore = cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
  revalidatePath('/', 'layout');
}
