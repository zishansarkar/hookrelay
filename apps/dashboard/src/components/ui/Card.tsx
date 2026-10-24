import type { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx('rounded-xl border border-gray-800 bg-[#111827] p-5 shadow-sm', className)}
      {...props}
    />
  );
}
