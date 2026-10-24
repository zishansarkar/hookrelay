import { clsx } from 'clsx';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'card' | 'row' | 'circle';
}

export function Skeleton({ className, variant = 'text' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={clsx(
        'animate-shimmer rounded-md bg-[linear-gradient(100deg,#1f2937_20%,#374151_38%,#1f2937_56%)] bg-[length:200%_100%]',
        variant === 'text' && 'h-4',
        variant === 'card' && 'min-h-32 rounded-xl',
        variant === 'row' && 'h-12 rounded-lg',
        variant === 'circle' && 'size-10 rounded-full',
        className,
      )}
    />
  );
}

export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading page" className="animate-fade-in space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} variant="card" className="h-24" />
        ))}
      </div>
      <Skeleton variant="card" className="h-64" />
    </div>
  );
}
