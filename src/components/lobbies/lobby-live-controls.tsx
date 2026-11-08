'use client';

// Client helpers for the lobby room
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
    }, 8000);
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
      variant="ghost"
      size="sm"
      onClick={handleManualRefresh}
      title="Обновить"
    >
      <RefreshCw
        className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
      />
      Обновить
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
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-glass-border bg-bg-elevated px-3 py-2">
      <div className="min-w-0">
        <div className="text-[11px] text-text-muted">{label}</div>
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
        title="Копировать"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-success" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}

export function LobbyAccessSelector() {
  const [mode, setMode] = React.useState<'open' | 'password'>('open');

  const options = [
    { id: 'open' as const, title: 'Свободный вход', icon: Unlock },
    { id: 'password' as const, title: 'По паролю', icon: Lock },
  ];

  return (
    <div className="space-y-3">
      <input type="hidden" name="accessType" value={mode} />

      <div className="grid grid-cols-2 gap-3">
        {options.map(({ id, title, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={`flex items-center gap-3 rounded-md border px-4 py-3 text-left text-sm font-medium transition-colors ${
              mode === id
                ? 'border-accent bg-accent-soft text-text'
                : 'border-glass-border bg-bg-elevated text-text-muted hover:border-accent/40'
            }`}
          >
            <Icon
              className={`h-4 w-4 ${
                mode === id ? 'text-accent-light' : 'text-text-muted'
              }`}
            />
            {title}
          </button>
        ))}
      </div>

      {mode === 'password' && (
        <Input
          name="password"
          type="text"
          placeholder="Пароль (от 2 символов)"
          minLength={2}
          maxLength={64}
          required
        />
      )}
    </div>
  );
}
