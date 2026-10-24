import { useEffect, useState } from 'react';
import { CheckCircle2, LoaderCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.js';

const planNames = { pro: 'Pro', team: 'Team', free: null } as const;

export function BillingSuccessPage() {
  const { developer, refreshDeveloper } = useAuth();
  const navigate = useNavigate();
  const [refreshFailed, setRefreshFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void refreshDeveloper().catch(() => {
        setRefreshFailed(true);
      });
    };
    refresh();
    const refreshTimer = window.setInterval(refresh, 1_000);
    const redirectTimer = window.setTimeout(() => {
      if (active) navigate('/events', { replace: true });
    }, 3_000);

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      window.clearTimeout(redirectTimer);
    };
  }, [navigate, refreshDeveloper]);

  const planName = developer ? planNames[developer.plan] : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0f1e] px-4">
      <section className="w-full max-w-md rounded-2xl border border-gray-800 bg-[#111827] p-8 text-center shadow-2xl">
        {planName ? (
          <CheckCircle2 className="mx-auto size-12 text-green-400" />
        ) : (
          <LoaderCircle className="mx-auto size-12 animate-spin text-blue-400" />
        )}
        <h1 className="mt-5 text-2xl font-semibold text-white">
          {planName ? `Welcome to the ${planName} plan! 🎉` : 'Confirming your subscription'}
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          {refreshFailed && !planName
            ? 'We could not refresh your account yet. Stripe will retry the confirmation shortly.'
            : planName
              ? 'Your billing is set up. Taking you back to HookRelay…'
              : 'Your payment succeeded. Your plan will appear here as soon as Stripe confirms it.'}
        </p>
      </section>
    </main>
  );
}
