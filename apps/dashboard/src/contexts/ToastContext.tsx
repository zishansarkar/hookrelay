import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';
import { clsx } from 'clsx';

type ToastKind = 'success' | 'error' | 'warning' | 'info';
interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}
interface ToastContextValue {
  toast(message: string, kind?: ToastKind): void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
let nextToastId = 0;

const icons = {
  success: CheckCircle2,
  error: XCircle,
  warning: TriangleAlert,
  info: Info,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);
  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = ++nextToastId;
    setItems((current) => [...current, { id, message, kind }]);
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 5000);
  }, []);
  useEffect(() => {
    const handleConnectionLost = () => toast('Connection lost. Retrying…', 'warning');
    window.addEventListener('hookrelay:connection-lost', handleConnectionLost);
    return () => window.removeEventListener('hookrelay:connection-lost', handleConnectionLost);
  }, [toast]);
  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {items.map((item) => {
          const Icon = icons[item.kind];
          return (
            <div
              key={item.id}
              role="status"
              className={clsx(
                'pointer-events-auto animate-toast-in flex items-start gap-3 rounded-xl border bg-[#111827] p-4 shadow-2xl',
                item.kind === 'success' && 'border-green-500/30',
                item.kind === 'error' && 'border-red-500/30',
                item.kind === 'warning' && 'border-amber-500/30',
                item.kind === 'info' && 'border-blue-500/30',
              )}
            >
              <Icon
                className={clsx(
                  'mt-0.5 size-5 shrink-0',
                  item.kind === 'success' && 'text-green-400',
                  item.kind === 'error' && 'text-red-400',
                  item.kind === 'warning' && 'text-amber-400',
                  item.kind === 'info' && 'text-blue-400',
                )}
              />
              <p className="min-w-0 flex-1 text-sm text-gray-200">{item.message}</p>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => dismiss(item.id)}
                className="rounded p-0.5 text-gray-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
