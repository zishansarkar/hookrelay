import { AlertTriangle } from 'lucide-react';
import { Button } from './Button.js';
import { Card } from './Card.js';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?(): void;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'We could not load this content. Check your connection and try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <Card
      role="alert"
      className="flex min-h-56 flex-col items-center justify-center gap-3 px-4 text-center"
    >
      <span className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-red-300">
        <AlertTriangle className="size-5" aria-hidden="true" />
      </span>
      <div>
        <h2 className="text-sm font-semibold text-gray-100">{title}</h2>
        <p className="mt-1 max-w-md text-sm text-gray-400">{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </Card>
  );
}
