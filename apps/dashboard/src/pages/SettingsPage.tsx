import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Copy, KeyRound, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import { useToast } from '../contexts/ToastContext.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';

const planNames: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  team: 'Team',
};

export function SettingsPage() {
  const { developer, refreshDeveloper } = useAuth();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const copyEmail = async () => {
    if (!developer) return;
    try {
      await navigator.clipboard.writeText(developer.email);
      toast('Email address copied.', 'success');
    } catch {
      toast('Could not access the clipboard. Copy the email address manually.', 'error');
    }
  };

  const refreshAccount = async () => {
    setIsRefreshing(true);
    try {
      await refreshDeveloper();
      toast('Account details are up to date.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not refresh account details.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-blue-400">
            Workspace
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Settings</h1>
          <p className="mt-1.5 text-sm text-gray-400">
            Review your account, plan, and security settings.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void refreshAccount()}
          loading={isRefreshing}
        >
          <RefreshCw className="size-4" />
          Refresh account
        </Button>
      </header>

      <section aria-labelledby="account-heading">
        <div className="mb-3 flex items-center gap-2">
          <UserRound className="size-4 text-blue-400" aria-hidden="true" />
          <h2 id="account-heading" className="text-sm font-semibold text-white">
            Account profile
          </h2>
        </div>
        <Card className="divide-y divide-gray-800 p-0">
          <div className="grid gap-1 px-5 py-4 sm:grid-cols-[12rem_1fr_auto] sm:items-center sm:gap-4">
            <span className="text-xs text-gray-500">Email address</span>
            <span className="break-all text-sm text-gray-100">{developer?.email ?? '—'}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void copyEmail()}
              disabled={!developer}
              aria-label="Copy email address"
            >
              <Copy className="size-3.5" />
              Copy
            </Button>
          </div>
          <div className="grid gap-1 px-5 py-4 sm:grid-cols-[12rem_1fr] sm:items-center sm:gap-4">
            <span className="text-xs text-gray-500">Workspace name</span>
            <span className="text-sm text-gray-100">{developer?.companyName || 'Not set'}</span>
          </div>
          <div className="grid gap-1 px-5 py-4 sm:grid-cols-[12rem_1fr] sm:items-center sm:gap-4">
            <span className="text-xs text-gray-500">Account created</span>
            <span className="text-sm text-gray-100">
              {developer
                ? new Intl.DateTimeFormat(undefined, {
                    dateStyle: 'medium',
                    timeZone: 'UTC',
                  }).format(new Date(developer.createdAt))
                : '—'}
            </span>
          </div>
        </Card>
      </section>

      <section aria-labelledby="plan-heading">
        <div className="mb-3 flex items-center gap-2">
          <ArrowUpRight className="size-4 text-blue-400" aria-hidden="true" />
          <h2 id="plan-heading" className="text-sm font-semibold text-white">
            Plan &amp; billing
          </h2>
        </div>
        <Card className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-gray-100">
              {planNames[developer?.plan ?? ''] ?? 'Current'} plan
            </p>
            <p className="mt-1 text-sm text-gray-400">
              View your webhook allowance, usage, and available plans.
            </p>
          </div>
          <Link
            to="/usage"
            className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            Manage plan <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </Card>
      </section>

      <section aria-labelledby="security-heading">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="size-4 text-blue-400" aria-hidden="true" />
          <h2 id="security-heading" className="text-sm font-semibold text-white">
            Security
          </h2>
        </div>
        <Card className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-gray-100">API keys</p>
            <p className="mt-1 text-sm text-gray-400">
              Create or revoke the credentials your applications use to send webhooks.
            </p>
          </div>
          <Link
            to="/api-keys"
            className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <KeyRound className="size-4" aria-hidden="true" />
            Manage API keys
          </Link>
        </Card>
      </section>
    </div>
  );
}
