// [Phase: MVP v1] Top Navigation Bar with Steam OpenID Login, Locale Switcher & Role Links
import * as React from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  Swords,
  Users,
  Trophy,
  ShieldCheck,
  LogOut,
  User as UserIcon,
  Globe,
  Plus,
} from 'lucide-react';
import { getCurrentUser } from '@/modules/auth/service';
import { getActiveLocale } from '@/lib/i18n/request';
import { setLocaleAction } from '@/lib/i18n/actions';
import { logoutAction } from '@/modules/auth/actions';
import { Button } from '@/components/ui/button';

export async function Navbar() {
  const [user, locale, t] = await Promise.all([
    getCurrentUser(),
    getActiveLocale(),
    getTranslations('nav'),
  ]);

  const nextLocale = locale === 'ru' ? 'en' : 'ru';

  return (
    <header className="sticky top-0 z-40 border-b border-glass-border bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 gap-4">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-base font-bold tracking-tight text-text hover:text-accent transition-colors"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon.png"
              alt="Dota turnir"
              className="h-9 w-9 object-contain drop-shadow-[0_0_12px_rgba(139,92,246,0.45)]"
            />
            <span>Dota turnir</span>
          </Link>

          {/* Main Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/tournaments"
              className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-text-muted hover:text-text hover:bg-white/[0.04] transition-colors"
            >
              <Swords className="h-4 w-4 text-accent" />
              {t('tournaments')}
            </Link>
            <Link
              href="/teams"
              className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-text-muted hover:text-text hover:bg-white/[0.04] transition-colors"
            >
              <Users className="h-4 w-4 text-accent" />
              {t('teams')}
            </Link>
            <Link
              href="/leaderboard"
              className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-text-muted hover:text-text hover:bg-white/[0.04] transition-colors"
            >
              <Trophy className="h-4 w-4 text-accent" />
              {t('leaderboard')}
            </Link>
            {user && (user.role === 'admin' || user.role === 'moderator') && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-warning hover:bg-warning/10 transition-colors"
              >
                <ShieldCheck className="h-4 w-4" />
                {t('admin')}
              </Link>
            )}
          </nav>
        </div>

        {/* Right Actions: Locale Switcher + Auth */}
        <div className="flex items-center gap-2.5">
          <form
            action={async () => {
              'use server';
              await setLocaleAction(nextLocale);
            }}
          >
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              aria-label="Переключить язык RU / EN"
            >
              <Globe className="h-3.5 w-3.5 text-accent" />
              <span className="uppercase font-mono text-xs">{locale}</span>
            </Button>
          </form>

          {user ? (
            <div className="flex items-center gap-2">
              <Link href="/teams/new" className="hidden sm:inline-flex">
                <Button variant="secondary" size="sm">
                  <Plus className="h-3.5 w-3.5 text-accent" />
                  {t('createTeam')}
                </Button>
              </Link>

              <Link
                href={`/players/${user.steamId64}`}
                className="flex items-center gap-2 rounded-md border border-glass-border bg-bg-elevated px-3 py-1.5 text-xs font-medium text-text hover:border-accent transition-colors"
              >
                <UserIcon className="h-3.5 w-3.5 text-accent" />
                <span className="max-w-[120px] truncate">{user.nickname}</span>
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
            </div>
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
