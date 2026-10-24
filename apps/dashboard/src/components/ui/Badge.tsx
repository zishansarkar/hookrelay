import type { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

type BadgeVariant = 'success' | 'pending' | 'failed' | 'dead-letter' | 'neutral' | 'info';
interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const styles: Record<BadgeVariant, string> = {
  success: 'border-green-500/20 bg-green-500/10 text-green-400',
  pending: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  failed: 'border-red-500/20 bg-red-500/10 text-red-400',
  'dead-letter': 'border-gray-600 bg-gray-700/50 text-gray-300',
  neutral: 'border-gray-700 bg-gray-800 text-gray-300',
  info: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
};

export function Badge({ variant = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize',
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}
