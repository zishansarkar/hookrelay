import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setMounted(true);
      setClosing(false);
      window.requestAnimationFrame(() => {
        const focusable = dialogRef.current?.querySelector<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        );
        focusable?.focus();
      });
    } else if (!closing) {
      setMounted(false);
    }
    return () => window.clearTimeout(closeTimer.current);
  }, [open]);

  const close = () => {
    if (closing) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
      onClose();
      if (previousFocus.current?.isConnected) previousFocus.current.focus();
    }, 140);
  };

  useEffect(() => {
    if (!mounted) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mounted, closing]);

  if (!mounted) return null;
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-0 backdrop-blur-sm sm:p-4 ${
        closing ? 'animate-fade-out' : 'animate-fade-in'
      }`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`flex max-h-[100dvh] w-full max-w-lg flex-col overflow-auto rounded-none border border-gray-700 bg-[#111827] shadow-2xl sm:max-h-[90vh] sm:rounded-2xl ${
          closing ? 'animate-scale-out' : 'animate-scale-in'
        }`}
      >
        <header className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
          <h2 id="modal-title" className="text-base font-semibold text-white">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={close}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <footer className="border-t border-gray-800 px-5 py-4">{footer}</footer>}
      </section>
    </div>
  );
}
