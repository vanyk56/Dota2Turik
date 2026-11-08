// Top navigation bar
import * as React from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  Swords,
  Gamepad2,
  Users,
  Trophy,
  ShieldCheck,
  LogOut,
  Globe,
  Plus,
} from 'lucide-react';
import { getCurrentUser } from '@/modules/auth/service';
import { getActiveLocale } from '@/lib/i18n/request';
import { setLocaleAction } from '@/lib/i18n/actions';
import { logoutAction } from '@/modules/auth/actions';
import { Button } from '@/components/ui/button';

const navLinkClass =
  'flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-text-muted hover:text-text hover:bg-accent-soft transition-colors';

export async function Navbar() {
  const [user, locale, t] = await Promise.all([
    getCurrentUser(),
    getActiveLocale(),
    getTranslations('nav'),
  ]);

  const nextLocale = locale === 'ru' ? 'en' : 'ru';

  return (
    <header className="sticky top-0 z-40 border-b border-glass-border bg-bg/90">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 gap-4">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 whitespace-nowrap text-base font-bold tracking-tight text-text"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon.png"
              alt="Dota turnir"
              className="h-9 w-9 object-contain drop-shadow-[0_0_12px_rgba(139,92,246,0.5)]"
            />
            <span>Dota turnir</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <Link href="/tournaments" className={navLinkClass}>
              <Swords className="h-4 w-4 text-accent-light" />
              {t('tournaments')}
            </Link>
            <Link href="/lobbies" className={navLinkClass}>
              <Gamepad2 className="h-4 w-4 text-accent-light" />
              {t('lobbies')}
            </Link>
            <Link href="/teams" className={navLinkClass}>
              <Users className="h-4 w-4 text-accent-light" />
              {t('teams')}
            </Link>
            <Link href="/leaderboard" className={navLinkClass}>
              <Trophy className="h-4 w-4 text-accent-light" />
              {t('leaderboard')}
            </Link>
            {user?.role === 'admin' && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-warning hover:bg-warning/10 transition-colors"
              >
                <ShieldCheck className="h-4 w-4" />
                {t('admin')}
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <form
            action={async () => {
              'use server';
              await setLocaleAction(nextLocale);
            }}
          >
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              aria-label="RU / EN"
            >
              <Globe className="h-3.5 w-3.5" />
              <span className="uppercase font-mono text-xs">{locale}</span>
            </Button>
          </form>

          {user ? (
            <>
              <Link href="/lobbies/new" className="hidden sm:inline-flex">
                <Button variant="primary" size="sm">
                  <Plus className="h-3.5 w-3.5" />
                  {t('createLobby')}
                </Button>
              </Link>

              <Link
                href={`/players/${user.steamId64}`}
                className="flex items-center gap-2 rounded-md border border-glass-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text hover:border-accent/50 transition-colors"
              >
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="h-5 w-5 rounded-full"
                  />
                ) : null}
                <span className="max-w-[110px] truncate">{user.nickname}</span>
              </Link>

              <form action={logoutAction}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  title={t('signOut')}
                  aria-label={t('signOut')}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </form>
            </>
          ) : (
            <a href="/api/auth/steam/login">
              <Button variant="primary" size="sm">
                {t('signInSteam')}
              </Button>
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
