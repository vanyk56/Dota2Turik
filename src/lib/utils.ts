// [Phase: MVP v1] Universal Client/Server Shared Utilities
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { PLATFORM_CONFIG } from './config';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0400-\u04ff\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getCountryFlag(countryCode: string): string {
  const found = PLATFORM_CONFIG.countries.find(
    (c) => c.code.toUpperCase() === countryCode.toUpperCase(),
  );
  return found?.flag ?? '🌐';
}

export function formatDate(date: Date | string | null | undefined, locale = 'ru'): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(date: Date | string | null | undefined, locale = 'ru'): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
