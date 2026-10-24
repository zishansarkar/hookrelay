import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { Card } from './Card.js';

interface EmptyStateProps {
  title: string;
  message: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, message, icon, action }: EmptyStateProps) {
  return (
    <Card className="flex min-h-64 flex-col items-center justify-center text-center">
      <div className="mb-4 rounded-xl border border-gray-800 bg-gray-900 p-3 text-gray-400">
        {icon ?? <Inbox className="size-6" />}
      </div>
      <h3 className="text-sm font-semibold text-gray-100">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-gray-500">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}
