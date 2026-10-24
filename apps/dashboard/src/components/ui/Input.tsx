import { forwardRef, type InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, className, ...props },
  ref,
) {
  const inputId = id ?? props.name;
  const messageId = inputId ? `${inputId}-message` : undefined;
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-300">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={messageId}
        className={clsx(
          'min-h-10 w-full rounded-lg border bg-[#0a0f1e] px-3.5 text-sm text-gray-100 placeholder:text-gray-600 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
          error ? 'border-red-500/70' : 'border-gray-700',
          className,
        )}
        {...props}
      />
      {(error || hint) && (
        <p
          id={messageId}
          className={clsx('text-xs', error ? 'text-red-400' : 'text-gray-500')}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
});
