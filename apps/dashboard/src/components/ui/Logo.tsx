import { Link } from 'react-router-dom';
import { clsx } from 'clsx';

interface LogoProps {
  compact?: boolean;
  className?: string;
  to?: string;
  ariaLabel?: string;
  onClick?(): void;
}

export function Logo({
  compact = false,
  className,
  to = '/events',
  ariaLabel = 'HookRelay dashboard',
  onClick,
}: LogoProps) {
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-label={ariaLabel}
      className={clsx('inline-flex items-center gap-2.5', className)}
    >
      <span className="flex size-9 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/15 text-blue-300 shadow-sm shadow-blue-950/40">
        <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" opacity=".55" />
          <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M2.5 12H9m5.5 0h7M12 2.5V6m0 12v3.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="m10 12 1.4 1.4L14.8 10"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {!compact && (
        <span className="text-sm font-semibold tracking-tight text-white">HookRelay</span>
      )}
    </Link>
  );
}
