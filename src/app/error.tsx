'use client';

// [Phase: MVP v1] Global Error Boundary — Never exposes stack traces to the user (Section 12 & 14)
import * as React from 'react';
import { ErrorState } from '@/components/ui/states';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="py-12">
      <ErrorState
        title="Не удалось выполнить операцию"
        message="Произошла непредвиденная ошибка при обработке запроса. Подробности записаны в серверный журнал."
        requestId={error.digest ?? 'ERR_SERVER_ACTION'}
        onRetry={reset}
      />
    </div>
  );
}
