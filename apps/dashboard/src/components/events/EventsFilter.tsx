import { useEffect, useState } from 'react';
import { CalendarDays, Search, X } from 'lucide-react';
import { DeliveryStatus } from '@hookrelay/shared';
import { Input } from '../ui/Input.js';

export type EventStatusFilter = DeliveryStatus | 'all';
export type EventDateRange = 'today' | '7d' | '30d' | 'custom';

interface EventsFilterProps {
  status: EventStatusFilter;
  onStatusChange(status: EventStatusFilter): void;
  targetUrl: string;
  onTargetUrlChange(targetUrl: string): void;
  dateRange: EventDateRange;
  onDateRangeChange(range: EventDateRange): void;
  startDate: string;
  endDate: string;
  onCustomDateChange(startDate: string, endDate: string): void;
}

const statusFilters: Array<{ label: string; value: EventStatusFilter }> = [
  { label: 'All events', value: 'all' },
  { label: 'Success', value: DeliveryStatus.SUCCESS },
  { label: 'Pending', value: DeliveryStatus.PENDING },
  { label: 'Failed', value: DeliveryStatus.FAILED },
  { label: 'Dead letter', value: DeliveryStatus.DEAD_LETTER },
];

export function EventsFilter({
  status,
  onStatusChange,
  targetUrl,
  onTargetUrlChange,
  dateRange,
  onDateRangeChange,
  startDate,
  endDate,
  onCustomDateChange,
}: EventsFilterProps) {
  const [searchValue, setSearchValue] = useState(targetUrl);

  useEffect(() => {
    const timer = window.setTimeout(() => onTargetUrlChange(searchValue.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [onTargetUrlChange, searchValue]);

  useEffect(() => {
    setSearchValue(targetUrl);
  }, [targetUrl]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div
          role="tablist"
          aria-label="Filter events by status"
          className="flex w-full gap-1 overflow-x-auto rounded-lg border border-gray-800 bg-[#0d1423] p-1 xl:w-auto"
        >
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              role="tab"
              aria-selected={status === filter.value}
              onClick={() => onStatusChange(filter.value)}
              className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                status === filter.value
                  ? 'bg-gray-800 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-500" />
            <Input
              aria-label="Search target URL"
              name="targetUrlSearch"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search target URL"
              className="min-h-10 pl-9 pr-9"
            />
            {searchValue && (
              <button
                type="button"
                aria-label="Clear target URL search"
                onClick={() => setSearchValue('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:text-gray-200"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <label className="flex min-h-10 items-center gap-2 rounded-lg border border-gray-700 bg-[#0a0f1e] px-3 text-sm text-gray-300">
            <CalendarDays className="size-4 text-gray-500" />
            <span className="sr-only">Date range</span>
            <select
              aria-label="Date range"
              value={dateRange}
              onChange={(event) => onDateRangeChange(event.target.value as EventDateRange)}
              className="min-w-28 bg-transparent text-sm outline-none"
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="custom">Custom range</option>
            </select>
          </label>
        </div>
      </div>
      {dateRange === 'custom' && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-500">
            From
            <input
              type="date"
              aria-label="Start date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => onCustomDateChange(event.target.value, endDate)}
              className="min-h-9 rounded-lg border border-gray-700 bg-[#0a0f1e] px-3 text-sm text-gray-300"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-500">
            To
            <input
              type="date"
              aria-label="End date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => onCustomDateChange(startDate, event.target.value)}
              className="min-h-9 rounded-lg border border-gray-700 bg-[#0a0f1e] px-3 text-sm text-gray-300"
            />
          </label>
        </div>
      )}
    </div>
  );
}
