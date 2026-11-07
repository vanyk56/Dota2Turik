// [Phase: MVP v1] Global Skeleton Loading State (Section 12)
import { Skeleton } from '@/components/ui/states';

export default function GlobalLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Загрузка страницы">
      <div className="space-y-2 pb-6 border-b border-glass-border">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
