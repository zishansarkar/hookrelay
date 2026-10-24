import { AlertCircle, Check, Zap } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { PLAN_LIMITS, type Plan } from '@hookrelay/shared';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { Spinner } from '../components/ui/Spinner.js';
import { useDailyUsage, useUsage } from '../hooks/useUsage.js';

const planOrder: Plan[] = ['free', 'pro', 'team'];
const planNames: Record<Plan, string> = { free: 'Free', pro: 'Pro', team: 'Team' };
const planPrices: Record<Plan, string> = { free: '$0', pro: '$15', team: '$49' };
const planFeatures: Record<Plan, string[]> = {
  free: ['10,000 webhooks / month', '7-day log history', 'Standard retry schedule'],
  pro: ['250,000 webhooks / month', '30-day log history', 'Failure email alerts'],
  team: [
    '1,000,000 webhooks / month',
    '90-day log history',
    'Custom retry schedules',
    'Unlimited team members',
  ],
};

function formatCount(value: number): string {
  return value.toLocaleString();
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  const date = typeof label === 'string' ? new Date(`${label}T00:00:00Z`) : null;
  return (
    <div className="rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 shadow-xl">
      <p className="text-xs text-gray-400">{date ? format(date, 'MMM d, yyyy') : label}</p>
      <p className="mt-1 text-sm font-semibold text-blue-300">
        {formatCount(Number(payload[0]?.value ?? 0))} webhooks
      </p>
    </div>
  );
}

export function UsagePage() {
  const usageQuery = useUsage();
  const dailyQuery = useDailyUsage();
  const usage = usageQuery.data;
  const progress = usage ? (usage.limit > 0 ? (usage.used / usage.limit) * 100 : 0) : 0;
  const progressColor =
    progress >= 80 ? 'bg-red-500' : progress >= 50 ? 'bg-amber-400' : 'bg-green-500';
  const resetDate = usage ? new Date(usage.resetDate) : null;

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-blue-400">
            Billing &amp; limits
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Usage</h1>
          <p className="mt-1.5 text-sm text-gray-500">
            Track webhook volume and manage your plan.
          </p>
        </div>
        {usage && (
          <Badge variant="info" className="self-start text-sm">
            {planNames[usage.plan]} plan
          </Badge>
        )}
      </header>

      {usageQuery.isLoading ? (
        <Card className="flex min-h-52 items-center justify-center">
          <Spinner className="size-6 text-blue-400" />
        </Card>
      ) : usageQuery.isError || !usage ? (
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertCircle className="size-6 text-red-400" />
          <p role="alert" className="text-sm text-red-300">
            Could not load your usage. Please refresh the page to try again.
          </p>
          <Button variant="secondary" size="sm" onClick={() => void usageQuery.refetch()}>
            Try again
          </Button>
        </Card>
      ) : (
        <Card className="space-y-5">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
            <div>
              <h2 className="text-sm font-semibold text-white">Monthly webhook usage</h2>
              <p className="mt-1 text-sm text-gray-400">
                <span className="font-semibold text-gray-100">{formatCount(usage.used)}</span>
                {' / '}
                {formatCount(usage.limit)} webhooks used this month
              </p>
            </div>
            <span className="text-xs text-gray-500">
              {resetDate && (
                <>
                  Resets on {format(resetDate, 'MMMM d, yyyy')}
                  <span className="ml-1 text-gray-600">
                    ({formatDistanceToNow(resetDate, { addSuffix: true })})
                  </span>
                </>
              )}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Monthly webhook usage"
            aria-valuenow={Math.min(100, Math.round(progress))}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-3 overflow-hidden rounded-full bg-gray-800"
          >
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${progressColor}`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>{Math.min(100, progress).toFixed(1)}% used</span>
            <span>{formatCount(Math.max(0, usage.limit - usage.used))} remaining</span>
          </div>
        </Card>
      )}

      <section aria-labelledby="daily-usage-heading">
        <div className="mb-4">
          <h2 id="daily-usage-heading" className="text-base font-semibold text-white">
            Daily webhook volume
          </h2>
          <p className="mt-1 text-sm text-gray-500">Your webhook activity over the last 30 days.</p>
        </div>
        <Card className="min-h-80">
          {dailyQuery.isLoading ? (
            <div className="flex h-72 items-center justify-center">
              <Spinner className="size-6 text-blue-400" />
            </div>
          ) : dailyQuery.isError ? (
            <div className="flex h-72 flex-col items-center justify-center gap-3 text-center">
              <AlertCircle className="size-6 text-red-400" />
              <p role="alert" className="text-sm text-red-300">Could not load daily usage data.</p>
              <Button variant="secondary" size="sm" onClick={() => void dailyQuery.refetch()}>
                Try again
              </Button>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={dailyQuery.data ?? []}
                margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                barCategoryGap="25%"
              >
                <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date: string) => format(new Date(`${date}T00:00:00Z`), 'MMM d')}
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={{ stroke: '#374151' }}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  allowDecimals={false}
                  tickFormatter={(value: number) => formatCount(value)}
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#1e3a5f', opacity: 0.25 }} />
                <Bar
                  dataKey="count"
                  name="Webhooks"
                  fill="#3b82f6"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </section>

      <section aria-labelledby="plans-heading">
        <div className="mb-4">
          <h2 id="plans-heading" className="text-base font-semibold text-white">
            Plans &amp; features
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Choose a plan that fits your delivery volume.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {planOrder.map((plan) => {
            const isCurrent = usage?.plan === plan;
            const limits = PLAN_LIMITS[plan];
            return (
              <Card
                key={plan}
                className={`relative flex flex-col ${
                  isCurrent ? 'border-blue-500/50 bg-blue-500/[0.04] ring-1 ring-blue-500/20' : ''
                }`}
              >
                {isCurrent && (
                  <Badge variant="info" className="absolute right-4 top-4">
                    Current plan
                  </Badge>
                )}
                <h3 className="text-sm font-semibold text-white">{planNames[plan]}</h3>
                <p className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tracking-tight text-white">
                    {planPrices[plan]}
                  </span>
                  <span className="text-xs text-gray-500">/ month</span>
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {formatCount(limits.monthlyWebhooks)} webhooks included
                </p>
                <ul className="my-5 flex-1 space-y-3 border-t border-gray-800 pt-4">
                  {planFeatures[plan].map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs text-gray-300">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-green-400" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <Button variant="secondary" disabled>
                    Current plan
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    disabled
                    title="Plan upgrades will be available in a future release."
                  >
                    <Zap className="size-4" /> Upgrade
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
