import { EventRow } from './EventRow.js';
import type { ListedWebhookEvent } from '../../lib/api.js';
import { EmptyState } from '../ui/EmptyState.js';
import { Spinner } from '../ui/Spinner.js';

interface EventsTableProps {
  events: ListedWebhookEvent[];
  isLoading: boolean;
  isFetching: boolean;
}

const columns = [
  'Status',
  'Event ID',
  'Target URL',
  'Method',
  'Response',
  'Duration',
  'Attempts',
  'Created',
];

function LoadingRows() {
  return (
    <div className="divide-y divide-gray-800/80" aria-label="Loading events">
      {Array.from({ length: 7 }, (_, index) => (
        <div key={index} className="grid grid-cols-4 items-center gap-4 px-4 py-4 sm:grid-cols-8">
          {Array.from({ length: 8 }, (_, cellIndex) => (
            <div
              key={cellIndex}
              className={`h-4 animate-pulse rounded bg-gray-800 ${
                cellIndex === 2 ? 'col-span-2 sm:col-span-1' : ''
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EventsTable({ events, isLoading, isFetching }: EventsTableProps) {
  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-xl border border-gray-800 bg-[#111827]">
        <LoadingRows />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <EmptyState
        title="No events yet"
        message="Send your first webhook using the API. Your delivery activity will show up here."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-800 bg-[#111827]">
      {isFetching && (
        <div className="flex items-center justify-end gap-2 border-b border-gray-800 px-4 py-2 text-[11px] text-gray-500">
          <Spinner className="size-3 text-blue-400" />
          Updating
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] border-collapse text-left">
          <thead className="border-b border-gray-800 bg-[#0e1524]">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
