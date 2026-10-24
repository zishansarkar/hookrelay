import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { Spinner } from './Spinner.js';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white shadow-sm shadow-blue-950/40 hover:bg-blue-500',
  secondary: 'border border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700',
  danger: 'bg-red-600 text-white hover:bg-red-500',
  ghost: 'text-gray-400 hover:bg-gray-800 hover:text-white',
};
const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-8 gap-1.5 px-3 text-xs',
  md: 'min-h-10 gap-2 px-4 text-sm',
  lg: 'min-h-12 gap-2 px-5 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Spinner className="size-3.5" />}
      {children}
    </button>
  );
});
