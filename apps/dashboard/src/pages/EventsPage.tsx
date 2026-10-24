import { useCallback, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Radio } from 'lucide-react';
import { format, startOfDay, subDays } from 'date-fns';
import {
  EventsFilter,
  type EventDateRange,
  type EventStatusFilter,
} from '../components/events/EventsFilter.js';
import { EventsTable } from '../components/events/EventsTable.js';
import { Button } from '../components/ui/Button.js';
import { useEvents, useEventStats } from '../hooks/useEvents.js';

const PAGE_SIZE = 20;

interface StatCardProps {
  label: string;
  value: number | undefined;
  icon: typeof Radio;
  color: string;
  isLoading: boolean;
}

function StatCard({ label, value, icon: Icon, color, isLoading }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-800 bg-[#111827] p-4">
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${color}`}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-gray-500">{label}</p>
        {isLoading ? (
          <div className="mt-1.5 h-5 w-10 animate-pulse rounded bg-gray-800" />
        ) : (
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-white">
            {(value ?? 0).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}

function getDateBounds(
  range: EventDateRange,
  customStart: string,
  customEnd: string,
): { startDate?: string; endDate?: string } {
  const now = new Date();
  if (range === 'today') {
    return { startDate: startOfDay(now).toISOString() };
  }
  if (range === '7d') {
    return { startDate: subDays(now, 7).toISOString() };
  }
  if (range === '30d') {
    return { startDate: subDays(now, 30).toISOString() };
  }
  const startDate = customStart ? new Date(`${customStart}T00:00:00`).toISOString() : undefined;
  const endDate = customEnd ? new Date(`${customEnd}T23:59:59.999`).toISOString() : undefined;
  return { startDate, endDate };
}

export function EventsPage() {
  const [status, setStatus] = useState<EventStatusFilter>('all');
  const [targetUrl, setTargetUrl] = useState('');
  const [dateRange, setDateRange] = useState<EventDateRange>('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [page, setPage] = useState(1);

  const updateTargetUrl = useCallback((value: string) => {
    setTargetUrl(value);
    setPage(1);
  }, []);
  const updateStatus = useCallback((value: EventStatusFilter) => {
    setStatus(value);
    setPage(1);
  }, []);
  const updateDateRange = useCallback((value: EventDateRange) => {
    setDateRange(value);
    setPage(1);
  }, []);
  const updateCustomDates = useCallback((startDate: string, endDate: string) => {
    setCustomStart(startDate);
    setCustomEnd(endDate);
    setPage(1);
  }, []);

  const dateBounds = useMemo(
    () => getDateBounds(dateRange, customStart, customEnd),
    [customEnd, customStart, dateRange],
  );
  const filters = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(status !== 'all' ? { status } : {}),
      ...(targetUrl ? { targetUrl } : {}),
      ...dateBounds,
    }),
    [dateBounds, page, status, targetUrl],
  );
  const eventsQuery = useEvents(filters);
  const statsQuery = useEventStats();
  const data = eventsQuery.data;

  const firstEvent = data && data.total > 0 ? (data.page - 1) * data.limit + 1 : 0;
  const lastEvent = data ? Math.min(data.page * data.limit, data.total) : 0;
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-blue-400">
            Activity
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Events</h1>
          <p className="mt-1.5 text-sm text-gray-500">
            Monitor webhook deliveries across your workspace.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-full border border-green-500/20 bg-green-500/5 px-3 py-1.5 text-xs text-green-400 sm:self-auto">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-50" />
            <span className="relative inline-flex size-2 rounded-full bg-green-500" />
          </span>
          Live updates
        </div>
      </header>

      <section aria-label="Event statistics" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Total today"
          value={statsQuery.data?.totalToday}
          icon={Radio}
          color="bg-blue-500/10 text-blue-400"
          isLoading={statsQuery.isLoading}
        />
        <StatCard
          label="Successful"
          value={statsQuery.data?.successful}
          icon={CheckCircle2}
          color="bg-green-500/10 text-green-400"
          isLoading={statsQuery.isLoading}
        />
        <StatCard
          label="Failed"
          value={statsQuery.data?.failed}
          icon={AlertCircle}
          color="bg-red-500/10 text-red-400"
          isLoading={statsQuery.isLoading}
        />
        <StatCard
          label="Pending"
          value={statsQuery.data?.pending}
          icon={Clock3}
          color="bg-amber-500/10 text-amber-400"
          isLoading={statsQuery.isLoading}
        />
      </section>

      <EventsFilter
        status={status}
        onStatusChange={updateStatus}
        targetUrl={targetUrl}
        onTargetUrlChange={updateTargetUrl}
        dateRange={dateRange}
        onDateRangeChange={updateDateRange}
        startDate={customStart}
        endDate={customEnd}
        onCustomDateChange={updateCustomDates}
      />

      {eventsQuery.isError ? (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center"
        >
          <AlertCircle className="size-6 text-red-400" />
          <div>
            <p className="text-sm font-medium text-gray-200">Could not load events</p>
            <p className="mt-1 text-xs text-gray-500">Check your connection and try again.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void eventsQuery.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <EventsTable
          events={data?.events ?? []}
          isLoading={eventsQuery.isLoading}
          isFetching={eventsQuery.isFetching}
        />
      )}

      {!eventsQuery.isLoading && !eventsQuery.isError && data && data.total > 0 && (
        <footer className="flex flex-col gap-3 border-t border-gray-800/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-500">
            Showing{' '}
            <span className="font-medium text-gray-300">
              {firstEvent}-{lastEvent}
            </span>{' '}
            of <span className="font-medium text-gray-300">{data.total.toLocaleString()}</span>{' '}
            events
            {dateRange !== 'custom' && (
              <span className="ml-1 text-gray-600">
                ·{' '}
                {dateRange === 'today'
                  ? 'Today'
                  : dateRange === '7d'
                    ? 'Last 7 days'
                    : 'Last 30 days'}
              </span>
            )}
            {dateRange === 'custom' && customStart && (
              <span className="ml-1 text-gray-600">
                · Since {format(new Date(`${customStart}T00:00:00`), 'MMM d')}
                {customEnd ? ` through ${format(new Date(`${customEnd}T00:00:00`), 'MMM d')}` : ''}
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1 || eventsQuery.isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <span className="px-2 text-xs tabular-nums text-gray-500">
              Page {page} of {pageCount}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= pageCount || eventsQuery.isFetching}
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            >
              Next
            </Button>
          </div>
        </footer>
      )}
    </div>
  );
}
