// [Phase: MVP v1] Global 404 Not Found State (Section 12)
import Link from 'next/link';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  return (
    <div className="py-16 flex flex-col items-center justify-center text-center">
      <div className="h-14 w-14 rounded-full bg-accent-soft border border-accent/30 flex items-center justify-center text-accent mb-4">
        <Compass className="h-6 w-6" />
      </div>
      <h1 className="text-2xl font-bold text-text mb-1">
        404 — Страница не найдена
      </h1>
      <p className="text-sm text-text-muted max-w-md mb-6">
        Запрашиваемая команда, турнир или профиль игрока не существуют либо были перемещены.
      </p>
      <div className="flex items-center gap-3">
        <Link href="/">
          <Button variant="primary" size="sm">
            На главную
          </Button>
        </Link>
        <Link href="/tournaments">
          <Button variant="secondary" size="sm">
            Все турниры
          </Button>
        </Link>
      </div>
    </div>
  );
}
