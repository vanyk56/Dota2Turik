'use client';

// [Phase: MVP v1] Client Helpers for Custom Lobby Room (Live Auto-Refresh, Copy Credentials, Access Mode Selector)
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check, RefreshCw, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function LobbyAutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  React.useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        router.refresh();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [active, router]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={handleManualRefresh}
      title="Обновить состояние слотов"
    >
      <RefreshCw className={`h-3.5 w-3.5 text-accent ${isRefreshing ? 'animate-spin' : ''}`} />
      <span>Обновить</span>
    </Button>
  );
}

export function CopyableField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback ignored
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-glass-border bg-bg/90 px-3 py-2">
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-text-muted">
          {label}
        </div>
        <div className="font-mono text-sm font-semibold text-text truncate">
          {value}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="shrink-0"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-success" />
            <span className="text-xs text-success">Скопировано</span>
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5 text-accent" />
            <span className="text-xs">Копировать</span>
          </>
        )}
      </Button>
    </div>
  );
}

export function LobbyAccessSelector() {
  const [mode, setMode] = React.useState<'open' | 'password'>('open');

  return (
    <div className="space-y-4">
      <input type="hidden" name="accessType" value={mode} />

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
          Тип входа в лобби *
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode('open')}
            className={`flex items-start gap-3 rounded-md border p-4 text-left transition-all ${
              mode === 'open'
                ? 'border-success bg-success/10 shadow-[0_0_20px_rgba(34,197,94,0.15)]'
                : 'border-glass-border bg-bg-elevated hover:border-white/20'
            }`}
          >
            <Unlock
              className={`h-5 w-5 shrink-0 mt-0.5 ${
                mode === 'open' ? 'text-success' : 'text-text-muted'
              }`}
            />
            <div>
              <div className="text-sm font-bold text-text">
                Свободный вход (Открытый лобак)
              </div>
              <div className="text-xs text-text-muted mt-1">
                Любой авторизованный игрок может зайти и занять свободный слот без ввода пароля.
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMode('password')}
            className={`flex items-start gap-3 rounded-md border p-4 text-left transition-all ${
              mode === 'password'
                ? 'border-accent bg-accent/15 shadow-accent-glow'
                : 'border-glass-border bg-bg-elevated hover:border-white/20'
            }`}
          >
            <Lock
              className={`h-5 w-5 shrink-0 mt-0.5 ${
                mode === 'password' ? 'text-accent' : 'text-text-muted'
              }`}
            />
            <div>
              <div className="text-sm font-bold text-text">
                По паролю (Закрытый лобак)
              </div>
              <div className="text-xs text-text-muted mt-1">
                Для подключения к комнате и просмотра данных лобби игрокам потребуется ввести ваш пароль.
              </div>
            </div>
          </button>
        </div>
      </div>

      {mode === 'password' && (
        <div className="rounded-md border border-accent/40 bg-accent/10 p-4 space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-accent">
            Пароль для подключения к лобби *
          </label>
          <Input
            name="password"
            type="text"
            placeholder="Введите пароль (от 2 символов), например: dota123"
            minLength={2}
            maxLength={64}
            required
          />
          <p className="text-xs text-text-muted">
            Передайте этот пароль друзьям или участникам матча — без него занять слот в лобби нельзя.
          </p>
        </div>
      )}
    </div>
  );
}
